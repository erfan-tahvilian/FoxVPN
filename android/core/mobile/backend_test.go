// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"bufio"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httptrace"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

type testHost struct {
	mu    sync.Mutex
	saved string
	fail  bool
}

func (h *testHost) Save(value string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.fail {
		return errors.New("Keystore unavailable")
	}
	h.saved = value
	return nil
}
func (*testHost) Changed(string)       {}
func (*testHost) Protect(int32) bool   { return true }
func (*testHost) DNSAddress() string   { return "127.0.0.1" }
func (*testHost) Certificates() string { return "" }
func TestDesktopAuthenticationCompatibility(t *testing.T) {
	if result := passwordHash("user@example.com", "sample password"); result != "e07930e948638b7bda1b8a7916a8392af7ca2783dd00c36dd474fb93521318eb" {
		t.Fatal(result)
	}
	header, err := hawk("POST", "https://api.accounts.firefox.com/v1/oauth/token", strings.Repeat("ab", 32), `{"scope":"profile"}`, 1700000000, "testnonce")
	expected := `Hawk id="d36adccff00b16274cd9be5aa570fd8fada54aa5413e6c902d25f656303b1ef6", ts="1700000000", nonce="testnonce", mac="hNV/0xv5i9Da/zSw1VgtWXEUFJRLroVr94bx9Fe9uD0=", hash="YwruefnMjYYwttGgJiKyYdrB5Fl1pNEX8F4ngEc+KCM="`
	if err != nil || header != expected {
		t.Fatalf("Authentication differs from desktop: %v %s", err, header)
	}
	if _, err = hawk("POST", "https://example.com", "invalid", "{}", 1, "x"); err == nil {
		t.Fatal("Accepted invalid session")
	}
}
func TestVaultFailureAndRendererIsolation(t *testing.T) {
	host := &testHost{}
	b := NewBackend(host, "{}")
	secret := object{"access_token": "private-access", "refresh_token": "private-refresh", "email": "user@example.com", "expiresAt": millis() + 100000}
	if err := b.setAuth(secret); err != nil {
		t.Fatal(err)
	}
	snapshot := b.Snapshot()
	if strings.Contains(snapshot, "private-access") || strings.Contains(snapshot, "private-refresh") {
		t.Fatal("Credentials reached renderer")
	}
	host.fail = true
	if err := b.setAuth(object{"email": "other@example.com"}); err == nil {
		t.Fatal("Accepted failed secure persistence")
	}
	if !strings.Contains(b.Snapshot(), "user@example.com") {
		t.Fatal("Previous session was not preserved")
	}
	var bad object
	json.Unmarshal([]byte(b.Call("openLink", `["file:///data/secret"]`)), &bad)
	if yes(bad, "ok") {
		t.Fatal("Core accepted arbitrary navigation")
	}
}

type flushWriter struct{ http.ResponseWriter }

func (w flushWriter) Write(p []byte) (int, error) {
	n, e := w.ResponseWriter.Write(p)
	w.ResponseWriter.(http.Flusher).Flush()
	return n, e
}
func protocolTunnel(t *testing.T) (*proxyTunnel, *httptest.Server) {
	t.Helper()
	origin := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("tunneled-response")) }))
	t.Cleanup(origin.Close)
	proxyServer := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "CONNECT" || r.Header.Get("Proxy-Authorization") != "Bearer fixture-pass" {
			w.WriteHeader(403)
			return
		}
		if r.Host != strings.TrimPrefix(origin.URL, "https://") {
			w.WriteHeader(400)
			return
		}
		conn, err := net.Dial("tcp", r.Host)
		if err != nil {
			w.WriteHeader(502)
			return
		}
		defer conn.Close()
		w.WriteHeader(200)
		w.(http.Flusher).Flush()
		done := make(chan struct{})
		go func() { io.Copy(conn, r.Body); conn.Close(); close(done) }()
		io.Copy(flushWriter{w}, conn)
		r.Body.Close()
		<-done
	}))
	proxyServer.EnableHTTP2 = true
	proxyServer.StartTLS()
	t.Cleanup(proxyServer.Close)
	b := NewBackend(&testHost{}, "{}")
	b.roots = x509.NewCertPool()
	b.roots.AddCert(proxyServer.Certificate())
	b.roots.AddCert(origin.Certificate())
	host, port, _ := net.SplitHostPort(strings.TrimPrefix(proxyServer.URL, "https://"))
	n, _ := strconv.Atoi(port)
	settings := defaults()
	settings["socksPort"] = 0
	tunnel := newTunnel(b, settings, object{"host": host, "port": n}, "fixture-pass", context.Background())
	t.Cleanup(tunnel.close)
	return tunnel, origin
}
func TestRealHTTP2AndNestedTLS(t *testing.T) {
	tunnel, origin := protocolTunnel(t)
	body, err := tunnel.request(context.Background(), origin.URL, nil, "")
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "tunneled-response" {
		t.Fatal(string(body))
	}
	if tunnel.up.Load() == 0 || tunnel.down.Load() == 0 {
		t.Fatal("Traffic counters did not record the real stream")
	}
}
func TestFragmentedSOCKS5AndDisconnect(t *testing.T) {
	tunnel, origin := protocolTunnel(t)
	if err := tunnel.start(); err != nil {
		t.Fatal(err)
	}
	conn, err := net.Dial("tcp", tunnel.listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(10 * time.Second))
	for _, value := range []byte{5, 1, 0} {
		conn.Write([]byte{value})
	}
	reply := make([]byte, 2)
	if _, err = io.ReadFull(conn, reply); err != nil || reply[1] != 0 {
		t.Fatalf("SOCKS handshake: %v %v", reply, err)
	}
	host, port, _ := net.SplitHostPort(strings.TrimPrefix(origin.URL, "https://"))
	n, _ := strconv.Atoi(port)
	request := append([]byte{5, 1, 0, 3, byte(len(host))}, []byte(host)...)
	var p [2]byte
	binary.BigEndian.PutUint16(p[:], uint16(n))
	request = append(request, p[:]...)
	for _, value := range request {
		conn.Write([]byte{value})
	}
	reply = make([]byte, 10)
	if _, err = io.ReadFull(conn, reply); err != nil || reply[1] != 0 {
		t.Fatalf("SOCKS CONNECT: %v %v", reply, err)
	}
	secure := tls.Client(conn, &tls.Config{RootCAs: tunnel.b.roots, ServerName: host, MinVersion: tls.VersionTLS12})
	if err = secure.Handshake(); err != nil {
		t.Fatal(err)
	}
	io.WriteString(secure, "GET / HTTP/1.1\r\nHost: "+host+"\r\nConnection: close\r\n\r\n")
	response, err := http.ReadResponse(bufio.NewReader(secure), nil)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil || string(data) != "tunneled-response" {
		t.Fatalf("Fragmented tunnel: %s %v", data, err)
	}
	address := tunnel.listener.Addr().String()
	tunnel.close()
	if _, err = net.DialTimeout("tcp", address, time.Second); err == nil {
		t.Fatal("SOCKS listener remained open after disconnect")
	}
}
func TestReadyRequiresLiveTunnelAndCancellation(t *testing.T) {
	b := NewBackend(&testHost{}, "{}")
	b.connection = "connecting"
	b.Ready()
	if b.connection == "connected" {
		t.Fatal("False connection state")
	}
	b.Disconnect()
	b.Ready()
	if b.connection != "disconnected" {
		t.Fatal("Ready revived a cancelled connection")
	}
}
func TestHealthConfirmsDataPathAfterFailedPing(t *testing.T) {
	probeCalls := 0
	probe := func(context.Context) error { probeCalls++; return nil }
	if err := checkTunnelHealth(context.Background(), func(context.Context) error { return nil }, probe, nil); err != nil || probeCalls != 0 {
		t.Fatal("Healthy PING must not create unnecessary traffic")
	}
	if err := checkTunnelHealth(context.Background(), func(context.Context) error { return io.EOF }, probe, nil); err != nil || probeCalls != 1 {
		t.Fatal("A working data path must survive an idle-session PING failure")
	}
	failure := errors.New("data path unavailable")
	if err := checkTunnelHealth(context.Background(), func(context.Context) error { return io.EOF }, func(context.Context) error { return failure }, nil); !errors.Is(err, failure) {
		t.Fatal("A failed data path must still be reported")
	}
	ctx, cancel := context.WithCancel(context.Background()); cancel()
	if err := checkTunnelHealth(ctx, func(context.Context) error { return context.Canceled }, probe, nil); !errors.Is(err, context.Canceled) || probeCalls != 1 {
		t.Fatal("A cancelled tunnel must not start a fallback probe")
	}
}
func TestConnectionLifecycleWithRealEdge(t *testing.T) {
	tunnel, _ := protocolTunnel(t)
	if err := tunnel.start(); err != nil {
		t.Fatal(err)
	}
	b := tunnel.b
	b.mu.Lock()
	b.tunnel = tunnel
	b.connection = "connecting"
	b.mu.Unlock()
	b.Ready()
	var state object
	json.Unmarshal([]byte(b.Snapshot()), &state)
	if str(state, "connection") != "connected" || num(state, "startedAt") == 0 {
		t.Fatal("Real edge did not activate connection state")
	}
	b.Disconnect()
	json.Unmarshal([]byte(b.Snapshot()), &state)
	if str(state, "connection") != "disconnected" || num(state, "startedAt") != 0 || state["activeServer"] != nil {
		t.Fatal("Disconnect did not clear connection state")
	}
}
func TestHealthReplacesUnresponsiveHTTP2Session(t *testing.T) {
	tunnel, origin := protocolTunnel(t)
	if err := tunnel.start(); err != nil { t.Fatal(err) }
	previous := tunnel.current
	checks := 0
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	err := checkTunnelHealth(ctx, func(context.Context) error { return io.EOF }, func(ctx context.Context) error {
		checks++
		if checks == 1 { return context.DeadlineExceeded }
		stream, err := tunnel.open(ctx, strings.TrimPrefix(origin.URL, "https://"))
		if err != nil { return err }
		return stream.Close()
	}, func() { tunnel.discardSession(previous) })
	if err != nil || checks != 2 || tunnel.current == previous { t.Fatalf("Transport recovery failed: %v", err) }
	deadline := time.Now().Add(time.Second)
	for !previous.State().Closed && time.Now().Before(deadline) { time.Sleep(time.Millisecond) }
	if !previous.State().Closed { t.Fatal("Idle retired session remained open") }
	replacement := tunnel.current
	tunnel.discardSession(previous)
	if tunnel.current != replacement { t.Fatal("A stale failure discarded the replacement session") }
	body, err := tunnel.request(ctx, origin.URL, nil, "")
	if err != nil || string(body) != "tunneled-response" { t.Fatalf("Recovered transport did not carry HTTPS: %s %v", body, err) }
}
func TestEstablishedStreamSurvivesDialCancellationAndSessionRecovery(t *testing.T) {
	tunnel, origin := protocolTunnel(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	stream, err := tunnel.open(ctx, strings.TrimPrefix(origin.URL, "https://"))
	if err != nil { t.Fatal(err) }
	defer stream.Close()
	previous := tunnel.current
	cancel()
	tunnel.discardSession(previous)
	body, err := tunnel.request(context.Background(), origin.URL, nil, "")
	if err != nil || string(body) != "tunneled-response" { t.Fatalf("Replacement stream failed: %s %v", body, err) }
	if previous.State().Closed { t.Fatal("Recovery killed an established stream") }
	host, _, _ := net.SplitHostPort(strings.TrimPrefix(origin.URL, "https://"))
	secure := tls.Client(stream, &tls.Config{RootCAs: tunnel.b.roots, ServerName: host, MinVersion: tls.VersionTLS12})
	handshakeCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	if err = secure.HandshakeContext(handshakeCtx); err != nil { t.Fatal(err) }
	if _, err = io.WriteString(secure, "GET / HTTP/1.1\r\nHost: "+host+"\r\nConnection: close\r\n\r\n"); err != nil { t.Fatal(err) }
	response, err := http.ReadResponse(bufio.NewReader(secure), nil)
	if err != nil { t.Fatal(err) }
	defer response.Body.Close()
	body, err = io.ReadAll(response.Body)
	if err != nil || string(body) != "tunneled-response" { t.Fatalf("Original stream was interrupted: %s %v", body, err) }
}

func TestTunneledRequestsReuseTLSAfterCallerCancellation(t *testing.T) {
	tunnel, origin := protocolTunnel(t)
	ctx, cancel := context.WithCancel(context.Background())
	_, err := tunnel.request(ctx, origin.URL, nil, "")
	cancel()
	if err != nil { t.Fatal(err) }
	reused := false
	ctx = httptrace.WithClientTrace(context.Background(), &httptrace.ClientTrace{GotConn: func(info httptrace.GotConnInfo) { reused = info.Reused }})
	body, err := tunnel.request(ctx, origin.URL, nil, "")
	if err != nil || string(body) != "tunneled-response" || !reused { t.Fatalf("TLS reuse failed: reused=%t body=%s err=%v", reused, body, err) }
}

func TestStaleTunnelFailureCannotDisconnectNewSession(t *testing.T) {
	tunnel, _ := protocolTunnel(t)
	if err := tunnel.start(); err != nil {
		t.Fatal(err)
	}
	b := tunnel.b
	b.mu.Lock()
	b.tunnel = tunnel
	b.connection = "connecting"
	b.mu.Unlock()
	b.Ready()
	b.failTunnel(&proxyTunnel{}, "Delayed failure from a previous session")
	var state object
	json.Unmarshal([]byte(b.Snapshot()), &state)
	if str(state, "connection") != "connected" {
		t.Fatal("Stale failure stopped the new connection")
	}
	b.Disconnect()
}
func TestUnreachableLatencyAndValidation(t *testing.T) {
	host := &testHost{}
	b := NewBackend(host, "{}")
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()
	b.servers = []object{{"id": "unreachable", "host": "127.0.0.1", "port": port}}
	b.auth = object{"access_token": "fixture", "expiresAt": millis()+3600000}
    b.client = &http.Client{Transport: exitRoundTripper(func(r *http.Request) (*http.Response,error){
        return &http.Response{StatusCode:200, Header:http.Header{}, Body:io.NopCloser(strings.NewReader(`{"token":"fixture-pass"}`))},nil
    })}
	if err = b.ping(context.Background(), "unreachable"); err != nil {
		t.Fatal(err)
	}
	result := obj(b.latencies, "unreachable")
	if result["ms"] != nil || num(result, "measuredAt") == 0 {
		t.Fatal(result)
	}
	settings := defaults()
	settings["excludedApps"] = []any{"chrome.exe\nmalformed"}
	if validate(settings) == nil {
		t.Fatal("Accepted invalid Android package")
	}
}

type exitRoundTripper func(*http.Request) (*http.Response,error)
func (f exitRoundTripper) RoundTrip(r *http.Request) (*http.Response,error) { return f(r) }
func TestExitAddressFamiliesAndLocationLabels(t *testing.T) {
 tunnel:=&proxyTunnel{requestClient:&http.Client{Transport:exitRoundTripper(func(r *http.Request)(*http.Response,error){
  body:="ip=2001:db8::1\nloc=DE\n"
  if r.URL.Hostname()=="1.1.1.1" { body="ip=203.0.113.3\nloc=DE\n" }
  return &http.Response{StatusCode:200,Body:io.NopCloser(strings.NewReader(body)),Header:make(http.Header)},nil
 })}}
 base,err:=tunnel.exit(context.Background(),"DE")
 if err!=nil || str(base,"ipv6")!="2001:db8::1" || str(base,"ipv4")!="" { t.Fatalf("Unexpected primary identity: %v %v",base,err) }
 combined:=tunnel.addresses(context.Background(),base)
 if str(combined,"ipv4")!="203.0.113.3" || str(base,"ipv4")!="" { t.Fatal("Address discovery failed or mutated the published state") }
 if _,err=tunnel.exit(context.Background(),"US");err==nil { t.Fatal("Country mismatch was accepted") }
 if locationLabel(object{"country":"Germany","city":" germany "})!="Germany" || locationLabel(object{"country":"Germany","city":"Frankfurt"})!="Germany, Frankfurt" { t.Fatal("Invalid country and city formatting") }
}

func TestLocationCacheSurvivesRestart(t *testing.T) {
 host:=&testHost{}
 b:=NewBackend(host,"{}")
 b.servers=[]object{{"id":"DE/de/edge.example:443","country":"Germany","code":"DE","city":"Germany","host":"edge.example","port":443}}
 if err:=b.save();err!=nil { t.Fatal(err) }
 restored:=NewBackend(host,host.saved)
 if len(restored.servers)!=1 || str(restored.servers[0],"host")!="edge.example" || str(restored.servers[0],"city")!="" { t.Fatal("Saved locations were not restored") }
 restored.settings["theme"]="light"
 if err:=restored.save();err!=nil { t.Fatal(err) }
 if len(NewBackend(host,host.saved).servers)!=1 { t.Fatal("Preference save lost locations") }
 if len(cachedServers([]any{object{"host":"bad/host","port":443}}))!=0 { t.Fatal("Invalid cached endpoint accepted") }
}

func TestRealDelayUsesTwoReusableHTTPSRequests(t *testing.T) {
    tunnel,origin:=protocolTunnel(t)
    reused:=false
    ctx:=httptrace.WithClientTrace(context.Background(),&httptrace.ClientTrace{GotConn:func(info httptrace.GotConnInfo){if info.Reused{reused=true}}})
    delay,err:=tunnel.realDelay(ctx,origin.URL)
    if err!=nil||delay<1||!reused { t.Fatalf("Invalid real delay: ms=%d reused=%t err=%v",delay,reused,err) }
}
