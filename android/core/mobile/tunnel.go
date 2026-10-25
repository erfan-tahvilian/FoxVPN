// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/net/http2"
	"golang.org/x/net/proxy"
)

type proxyTunnel struct {
	b                *Backend
	settings, server object
	ctx              context.Context
	cancel           context.CancelFunc
	mu               sync.Mutex
	sessionMu        sync.Mutex
	current          *http2.ClientConn
 h3 *mobileH3
 h3fallback bool
	currentSocket    net.Conn
	token            string
	expiry, up, down atomic.Int64
	listener         net.Listener
	transport        *http2.Transport
	requestTransport *http.Transport
	requestClient    *http.Client
	sockets          map[io.Closer]struct{}
	closed           bool
}

func newTunnel(b *Backend, settings, server object, token string, ctx context.Context) *proxyTunnel {
	child, cancel := context.WithCancel(ctx)
	t := &proxyTunnel{b: b, settings: settings, server: server, ctx: child, cancel: cancel, sockets: map[io.Closer]struct{}{}}
	t.setToken(token)
	t.transport = &http2.Transport{DialTLSContext: func(ctx context.Context, network, _ string, _ *tls.Config) (net.Conn, error) {
		host := str(server, "host")
		edge := str(settings, "edge")
		if edge == "" {
			edge = host
		}
		conn, err := t.raw(ctx, net.JoinHostPort(edge, strconv.Itoa(int(num(server, "port")))))
		if err != nil {
			return nil, err
		}
		tlsConn := tls.Client(conn, &tls.Config{RootCAs: b.roots, ServerName: host, MinVersion: tls.VersionTLS12, NextProtos: []string{"h2"}})
		if err = tlsConn.HandshakeContext(ctx); err != nil {
			conn.Close()
			return nil, err
		}
		if tlsConn.ConnectionState().NegotiatedProtocol != "h2" {
			conn.Close()
			return nil, errors.New("The VPN edge does not support HTTP/2")
		}
		if !t.track(tlsConn) {
			return nil, context.Canceled
		}
		return tlsConn, nil
	}}
	t.requestTransport = &http.Transport{DialTLSContext: func(ctx context.Context, _, address string) (net.Conn, error) {
		stream, err := t.open(ctx, address)
		if err != nil { return nil, err }
		host, _, err := net.SplitHostPort(address)
		if err != nil { stream.Close(); return nil, err }
		conn := tls.Client(stream, &tls.Config{RootCAs: b.roots, ServerName: host, MinVersion: tls.VersionTLS12})
		if err = conn.HandshakeContext(ctx); err != nil { stream.Close(); return nil, err }
		return conn, nil
	}, MaxIdleConns: 32, MaxIdleConnsPerHost: 8, MaxConnsPerHost: 8, IdleConnTimeout: time.Minute}
	t.requestClient = &http.Client{Transport: t.requestTransport, Timeout: 15*time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	return t
}
func (t *proxyTunnel) setToken(token string) {
	expiry := time.Now().Unix() + 3600
	parts := strings.Split(token, ".")
	if len(parts) > 1 {
		raw, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var data object
		if json.Unmarshal(raw, &data) == nil && num(data, "exp") > 0 {
			expiry = int64(num(data, "exp"))
		}
	}
	t.mu.Lock()
	t.token = token
	t.mu.Unlock()
	t.expiry.Store(expiry)
}
func (t *proxyTunnel) track(c io.Closer) bool {
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		c.Close()
		return false
	}
	t.sockets[c] = struct{}{}
	t.mu.Unlock()
	return true
}
func (t *proxyTunnel) untrack(c io.Closer) { t.mu.Lock(); delete(t.sockets, c); t.mu.Unlock() }
func (t *proxyTunnel) session(ctx context.Context) (*http2.ClientConn, error) {
	t.sessionMu.Lock()
	defer t.sessionMu.Unlock()
	t.mu.Lock()
	current, closed := t.current, t.closed
	t.mu.Unlock()
	if closed {
		return nil, context.Canceled
	}
	if current != nil && current.CanTakeNewRequest() {
		return current, nil
	}
	address := net.JoinHostPort(str(t.server, "host"), strconv.Itoa(int(num(t.server, "port"))))
	conn, err := t.transport.DialTLSContext(ctx, "tcp", address, nil)
	if err != nil {
		return nil, err
	}
	session, err := t.transport.NewClientConn(conn)
	if err != nil {
		conn.Close()
		return nil, err
	}
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		session.Close()
		return nil, context.Canceled
	}
	t.current = session
	t.currentSocket = conn
	t.mu.Unlock()
	return session, nil
}
func (t *proxyTunnel) health(ctx context.Context) error {
 if str(t.settings,"transport")!="h2" {stream,err:=t.open(ctx,"www.cloudflare.com:443");if err!=nil{return err};return stream.Close()}
	var checked *http2.ClientConn
	down := t.down.Load()
	return checkTunnelHealth(ctx, func(pingCtx context.Context) error {
		session, err := t.session(pingCtx)
		if err != nil { return err }
		checked = session
		return session.Ping(pingCtx)
	}, func(probeCtx context.Context) error {
		stream, err := t.open(probeCtx, "www.cloudflare.com:443")
		if err != nil {
			if t.down.Load() > down { return nil }
			return err
		}
		return stream.Close()
	}, func() { t.discardSession(checked) })
}
func (t *proxyTunnel) discardSession(expected *http2.ClientConn) {
	if expected == nil { return }
	t.sessionMu.Lock()
	defer t.sessionMu.Unlock()
	t.mu.Lock()
	if t.current != expected {
		t.mu.Unlock()
		return
	}
	socket := t.currentSocket
	t.current = nil
	t.currentSocket = nil
	t.mu.Unlock()
	// Retire the connection for new requests without destroying working
	// CONNECT streams when an edge delays PING or a health probe.
	expected.SetDoNotReuse()
	go func() {
		expected.Shutdown(t.ctx)
		expected.Close()
		if socket != nil { t.untrack(socket) }
	}()
}
// An idle HTTP/2 session can close or fail to acknowledge PING while a fresh
// authenticated CONNECT still works. Check the data path before declaring loss.
func checkTunnelHealth(ctx context.Context, ping, probe func(context.Context) error, reconnect func()) error {
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	err := ping(pingCtx)
	cancel()
	if err == nil { return nil }
	if ctx.Err() != nil { return ctx.Err() }
	probeCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	err = probe(probeCtx)
	cancel()
	if err == nil { return nil }
	if ctx.Err() != nil { return ctx.Err() }
	if reconnect == nil { return err }
	reconnect()
	return probe(ctx)
}
func (t *proxyTunnel) monitor() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	failures := 0
	for {
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(t.ctx, 15*time.Second)
			err := t.health(ctx)
			cancel()
			if err != nil && t.ctx.Err() == nil {
				failures++
				t.b.log("warn", fmt.Sprintf("Connection health check failed (%d/3): %v", failures, err))
				if failures < 3 { continue }
				t.b.mu.Lock()
				active := t.b.tunnel == t && t.b.connection == "connected"
				t.b.mu.Unlock()
				if active {
					t.b.failTunnel(t, "VPN connection interrupted. Reconnect to restore your connection.")
				}
				return
			}
			if err == nil && failures > 0 {
				failures = 0
				t.b.log("info", "Connection health recovered")
			}
		}
	}
}
func (t *proxyTunnel) raw(ctx context.Context, address string) (net.Conn, error) {
	upstream := obj(t.settings, "upstream")
	if !yes(upstream, "enabled") {
		return t.b.dialer.DialContext(ctx, "tcp", address)
	}
	gateway := net.JoinHostPort(str(upstream, "host"), strconv.Itoa(int(num(upstream, "port"))))
	if str(upstream, "type") == "socks5" {
		var auth *proxy.Auth
		if str(upstream, "username") != "" || str(upstream, "password") != "" {
			auth = &proxy.Auth{User: str(upstream, "username"), Password: str(upstream, "password")}
		}
		d, err := proxy.SOCKS5("tcp", gateway, auth, t.b.dialer)
		if err != nil {
			return nil, err
		}
		cd, ok := d.(proxy.ContextDialer)
		if !ok {
			return nil, errors.New("Proxy cannot dial with cancellation")
		}
		return cd.DialContext(ctx, "tcp", address)
	}
	conn, err := t.b.dialer.DialContext(ctx, "tcp", gateway)
	if err != nil {
		return nil, err
	}
	conn.SetDeadline(time.Now().Add(15 * time.Second))
	header := "CONNECT " + address + " HTTP/1.1\r\nHost: " + address + "\r\n"
	if str(upstream, "username") != "" || str(upstream, "password") != "" {
		header += "Proxy-Authorization: Basic " + base64.StdEncoding.EncodeToString([]byte(str(upstream, "username")+":"+str(upstream, "password"))) + "\r\n"
	}
	if _, err = io.WriteString(conn, header+"\r\n"); err != nil {
		conn.Close()
		return nil, err
	}
	reader := bufio.NewReader(conn)
	response, err := http.ReadResponse(reader, &http.Request{Method: "CONNECT"})
	if err != nil {
		conn.Close()
		return nil, err
	}
	if response.StatusCode != 200 {
		conn.Close()
		return nil, fmt.Errorf("Upstream proxy rejected connection (%d)", response.StatusCode)
	}
	conn.SetDeadline(time.Time{})
	return &bufferedConn{Conn: conn, reader: reader}, nil
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *bufferedConn) Read(p []byte) (int, error) { return c.reader.Read(p) }

type streamConn struct {
	body   io.ReadCloser
	writer *io.PipeWriter
	cancel context.CancelFunc
	t      *proxyTunnel
	once   sync.Once
}

func (s *streamConn) Read(p []byte) (int, error) {
	n, e := s.body.Read(p)
	s.t.down.Add(int64(n))
	return n, e
}
func (s *streamConn) Write(p []byte) (int, error) {
	n, e := s.writer.Write(p)
	s.t.up.Add(int64(n))
	return n, e
}
func (s *streamConn) Close() error {
	s.once.Do(func() { s.cancel(); s.writer.Close(); s.body.Close(); s.t.untrack(s) })
	return nil
}
func (s *streamConn) LocalAddr() net.Addr              { return &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1)} }
func (s *streamConn) RemoteAddr() net.Addr             { return &net.TCPAddr{} }
func (s *streamConn) SetDeadline(time.Time) error      { return nil }
func (s *streamConn) SetReadDeadline(time.Time) error  { return nil }
func (s *streamConn) SetWriteDeadline(time.Time) error { return nil }
func (t *proxyTunnel) open(ctx context.Context, address string) (net.Conn, error) {
	// A dial context controls connection establishment, not the lifetime of
	// the returned connection. Keep established streams until Close or VPN stop.
	child, cancel := context.WithCancel(t.ctx)
	stopDialCancel := context.AfterFunc(ctx, cancel)
	defer stopDialCancel()
	reader, writer := io.Pipe()
	endpoint := net.JoinHostPort(str(t.server, "host"), strconv.Itoa(int(num(t.server, "port"))))
	req, err := http.NewRequestWithContext(child, "CONNECT", "https://"+endpoint, reader)
	if err != nil {
		cancel()
		reader.Close()
		writer.Close()
		return nil, err
	}
	req.Host = address
	req.ContentLength = -1
 req.Header.Set("User-Agent","Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0")
 t.mu.Lock();token:=t.token;t.mu.Unlock();req.Header.Set("Proxy-Authorization","Bearer "+token)
 timer:=time.AfterFunc(15*time.Second,cancel)
 response,err:=t.roundTrip(child,req)
	timer.Stop()
	if err != nil {
		cancel()
		reader.Close()
		writer.Close()
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		response.Body.Close()
		cancel()
		reader.Close()
		writer.Close()
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		response.Body.Close()
		cancel()
		reader.Close()
		writer.Close()
		if response.StatusCode == 401 || response.StatusCode == 403 || response.StatusCode == 429 {
			go t.b.rejectedAccount(t,response.StatusCode,response.Header.Clone())
		}
		return nil, fmt.Errorf("VPN edge rejected connection (%d)", response.StatusCode)
	}
	stream := &streamConn{body: response.Body, writer: writer, cancel: cancel, t: t}
	if !t.track(stream) {
		return nil, context.Canceled
	}
	return stream, nil
}
func (t *proxyTunnel) start() error {
	ctx, cancel := context.WithTimeout(t.ctx, 15*time.Second)
	err := t.health(ctx)
	cancel()
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp", net.JoinHostPort(str(t.settings, "bind"), strconv.Itoa(int(num(t.settings, "socksPort")))))
	if err != nil {
		return err
	}
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		listener.Close()
		return context.Canceled
	}
	t.listener = listener
	t.mu.Unlock()
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			if !t.track(conn) {
				return
			}
			go func() { defer conn.Close(); defer t.untrack(conn); t.accept(conn) }()
		}
	}()
	return nil
}
func readAddress(reader io.Reader, kind byte) (string, error) {
	size := 0
	switch kind {
	case 1:
		size = 4
	case 4:
		size = 16
	case 3:
		var n [1]byte
		if _, err := io.ReadFull(reader, n[:]); err != nil {
			return "", err
		}
		size = int(n[0])
		if size == 0 {
			return "", errors.New("Empty SOCKS hostname")
		}
	default:
		return "", errors.New("Invalid SOCKS address")
	}
	value := make([]byte, size)
	if _, err := io.ReadFull(reader, value); err != nil {
		return "", err
	}
	if kind == 3 {
		return string(value), nil
	}
	return net.IP(value).String(), nil
}
func (t *proxyTunnel) accept(conn net.Conn) error {
	conn.SetDeadline(time.Now().Add(15 * time.Second))
	var header [2]byte
	if _, err := io.ReadFull(conn, header[:]); err != nil {
		return err
	}
	if header[0] != 5 || header[1] == 0 {
		return errors.New("SOCKS5 required")
	}
	methods := make([]byte, int(header[1]))
	if _, err := io.ReadFull(conn, methods); err != nil {
		return err
	}
	if !bytes.Contains(methods, []byte{0}) {
		conn.Write([]byte{5, 255})
		return errors.New("SOCKS authentication not supported")
	}
	if _, err := conn.Write([]byte{5, 0}); err != nil {
		return err
	}
	var request [4]byte
	if _, err := io.ReadFull(conn, request[:]); err != nil {
		return err
	}
	if request[0] != 5 || request[2] != 0 {
		return errors.New("Invalid SOCKS request")
	}
	host, err := readAddress(conn, request[3])
	if err != nil {
		return err
	}
	var port [2]byte
	if _, err = io.ReadFull(conn, port[:]); err != nil {
		return err
	}
	if request[1] == 3 {
		conn.SetDeadline(time.Time{})
		return t.udp(conn)
	}
	if request[1] != 1 {
		conn.Write([]byte{5, 7, 0, 1, 0, 0, 0, 0, 0, 0})
		return errors.New("Unsupported SOCKS command")
	}
	remote, err := t.open(t.ctx, net.JoinHostPort(host, strconv.Itoa(int(binary.BigEndian.Uint16(port[:])))))
	if err != nil {
		conn.Write([]byte{5, 1, 0, 1, 0, 0, 0, 0, 0, 0})
		return err
	}
	defer remote.Close()
	conn.SetDeadline(time.Time{})
	if _, err = conn.Write([]byte{5, 0, 0, 1, 127, 0, 0, 1, 0, 0}); err != nil {
		return err
	}
	done := make(chan struct{})
	go func() { io.Copy(remote, conn); remote.Close(); close(done) }()
	io.Copy(conn, remote)
	conn.Close()
	<-done
	return nil
}
func (t *proxyTunnel) request(ctx context.Context, address string, body []byte, contentType string, accepted ...int) ([]byte, error) {
	method := "GET"
	if body != nil {
		method = "POST"
	}
	req, err := http.NewRequestWithContext(ctx, method, address, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", contentType)
		req.Header.Set("Accept", contentType)
	}
	response, err := t.requestClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	valid := response.StatusCode == 200
    if len(accepted)>0 { valid=false;for _,status:=range accepted { if response.StatusCode==status { valid=true } } }
    if !valid { return nil, fmt.Errorf("Tunneled request failed (%d)", response.StatusCode) }
	data, err := io.ReadAll(io.LimitReader(response.Body, 1024*1024+1))
	if len(data) > 1024*1024 {
		return nil, errors.New("Response too large")
	}
	return data, err
}
// realDelay mirrors the two-request, keep-alive minimum used by v2rayN.
func (t *proxyTunnel) realDelay(ctx context.Context, address string) (int64,error) {
    var best int64
    for i:=0;i<2;i++ {
        start:=time.Now()
        if _,err:=t.request(ctx,address,nil,"",200,204);err!=nil{return 0,err}
        elapsed:=time.Since(start).Milliseconds();if elapsed<1 {elapsed=1}
        if best==0||elapsed<best {best=elapsed}
        timer:=time.NewTimer(100*time.Millisecond)
        select {case <-ctx.Done():timer.Stop();return 0,ctx.Err();case <-timer.C:}
    }
    return best,nil
}
func (t *proxyTunnel) dns(ctx context.Context, query []byte, host string) ([]byte, error) {
	providers := map[string][]string{"automatic": {"cloudflare-dns.com", "dns.google", "dns.quad9.net"}, "cloudflare": {"cloudflare-dns.com"}, "google": {"dns.google"}, "quad9": {"dns.quad9.net"}}
	targets := providers[str(t.settings, "doh")]
	if len(targets) > 0 && str(t.settings, "customDns") == "" {
		// Resolve the provider at the remote proxy, like other tunneled HTTPS
		// destinations. A blocked anycast IP must not pin DNS to a dead route.
		return exchangeEncryptedDNS(ctx, targets, 5*time.Second, func(attempt context.Context, provider string) ([]byte, error) {
			return t.request(attempt, "https://"+provider+"/dns-query", query, "application/dns-message")
		})
	}
	if str(t.settings, "customDns") != "" {
		host = str(t.settings, "customDns")
	}
	stream, err := t.open(ctx, net.JoinHostPort(host, "53"))
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	timer := time.AfterFunc(10*time.Second, func() { stream.Close() })
	defer timer.Stop()
	packet := make([]byte, 2+len(query))
	binary.BigEndian.PutUint16(packet, uint16(len(query)))
	copy(packet[2:], query)
	if _, err = stream.Write(packet); err != nil {
		return nil, err
	}
	var size [2]byte
	if _, err = io.ReadFull(stream, size[:]); err != nil {
		return nil, err
	}
	n := binary.BigEndian.Uint16(size[:])
	if n > 4096 || n < 12 {
		return nil, errors.New("Invalid DNS response")
	}
	result := make([]byte, n)
	_, err = io.ReadFull(stream, result)
	return result, err
}

func exchangeEncryptedDNS(ctx context.Context, providers []string, timeout time.Duration, exchange func(context.Context, string) ([]byte, error)) ([]byte, error) {
	if err := ctx.Err(); err != nil { return nil, err }
	lookup, cancelLookup := context.WithCancel(ctx)
	defer cancelLookup()
	type answer struct { data []byte; err error }
	results := make(chan answer, len(providers))
	start := func(provider string) {
		go func() {
			attempt, cancel := context.WithTimeout(lookup, timeout)
			defer cancel()
			data, err := exchange(attempt, provider)
			results <- answer{data, err}
		}()
	}
	// Give the preferred provider a head start. If it stalls, overlap the
	// next attempt rather than exhausting Android's entire DNS deadline.
	next, pending := 0, 0
	delay := timeout / 4
	if delay <= 0 { delay = time.Nanosecond }
	timer := time.NewTimer(delay)
	defer timer.Stop()
	launch := func() {
		start(providers[next]); next++; pending++
		timer.Reset(delay)
	}
	if len(providers) > 0 { launch() }
	for pending > 0 {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case result := <-results:
			pending--
			if ctx.Err() != nil { return nil, ctx.Err() }
			if result.err == nil && len(result.data) >= 12 && len(result.data) <= 4096 { return result.data, nil }
			if next < len(providers) { launch() }
		case <-timer.C:
			if next < len(providers) { launch() }
		}
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return nil, errors.New("Encrypted DNS providers are unreachable")
}

func (t *proxyTunnel) udp(conn net.Conn) error {
	udp, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.ParseIP(str(t.settings, "bind"))})
	if err != nil {
		return err
	}
	defer udp.Close()
	if !t.track(udp) {
		return context.Canceled
	}
	defer t.untrack(udp)
	response := []byte{5, 0, 0, 1, 127, 0, 0, 1, 0, 0}
	local := conn.LocalAddr().(*net.TCPAddr).IP.To4()
	if local != nil {
		copy(response[4:8], local)
	}
	binary.BigEndian.PutUint16(response[8:], uint16(udp.LocalAddr().(*net.UDPAddr).Port))
	if _, err = conn.Write(response); err != nil {
		return err
	}
	done := make(chan struct{})
	go func() { io.Copy(io.Discard, conn); udp.Close(); close(done) }()
	defer conn.Close()
	limit := make(chan struct{}, 32)
	expected := conn.RemoteAddr().(*net.TCPAddr).IP
	for {
		buf := make([]byte, 4353)
		n, remote, err := udp.ReadFromUDP(buf)
		if err != nil {
			return nil
		}
		buf = buf[:n]
		if !expected.Equal(remote.IP) || n > 4352 || n < 10 || buf[0] != 0 || buf[1] != 0 || buf[2] != 0 {
			continue
		}
		reader := bytes.NewReader(buf[4:])
		host, err := readAddress(reader, buf[3])
		if err != nil {
			continue
		}
		var port [2]byte
		if _, err = io.ReadFull(reader, port[:]); err != nil || binary.BigEndian.Uint16(port[:]) != 53 || reader.Len() < 12 {
			continue
		}
		offset := len(buf) - reader.Len()
		select {
		case limit <- struct{}{}:
		default:
			continue
		}
		go func(packet []byte, remote *net.UDPAddr, host string, offset int) {
			defer func() { <-limit }()
			ctx, cancel := context.WithTimeout(t.ctx, 15*time.Second)
			defer cancel()
			answer, err := t.dns(ctx, packet[offset:], host)
			if err == nil {
				reply := append(append([]byte{}, packet[:offset]...), answer...)
				udp.WriteToUDP(reply, remote)
			}
		}(buf, remote, host, offset)
	}
}
func (t *proxyTunnel) exit(ctx context.Context, expected string) (object, error) {
	data, err := t.request(ctx, "https://www.cloudflare.com/cdn-cgi/trace", nil, "")
	if err != nil {
		return nil, err
	}
	fields := object{}
	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		key, value, found := strings.Cut(line, "=")
		if found {
			fields[key] = value
		}
	}
	ip, country := str(fields, "ip"), str(fields, "loc")
	if net.ParseIP(ip) == nil || len(country) != 2 {
		return nil, errors.New("Exit verification returned no IP or country")
	}
	if expected != "" && expected != "REC" && !strings.EqualFold(expected, country) {
		return nil, fmt.Errorf("Exit mismatch: expected %s, received %s", expected, country)
	}
	result := object{"ip": ip, "country": country, "ipv4": "", "ipv6": "", "pending": true}
	if net.ParseIP(ip).To4() != nil {
		result["ipv4"] = ip
	} else {
		result["ipv6"] = ip
	}
	return result, nil
}
func (t *proxyTunnel) close() {
	t.cancel()
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		return
	}
	t.closed = true
	listener := t.listener
 h3:=t.h3;t.h3=nil
	sockets := make([]io.Closer, 0, len(t.sockets))
	for s := range t.sockets {
		sockets = append(sockets, s)
	}
	t.sockets = map[io.Closer]struct{}{}
	t.mu.Unlock()
 if h3!=nil{h3.close()}
	if listener != nil {
		listener.Close()
	}
	for _, s := range sockets {
		s.Close()
	}
	t.transport.CloseIdleConnections()
	t.requestTransport.CloseIdleConnections()
}

func (t *proxyTunnel) addresses(ctx context.Context, base object) object {
	result := copyObject(base)
	address, key := "https://1.1.1.1/cdn-cgi/trace", "ipv4"
	if str(base, "ipv4") != "" {
		address, key = "https://[2606:4700:4700::1111]/cdn-cgi/trace", "ipv6"
	}
	data, err := t.request(ctx, address, nil, "")
	if err != nil {
		return result
	}
	fields := object{}
	for _, line := range strings.Split(string(data), "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), "=")
		if ok {
			fields[k] = v
		}
	}
	ip := net.ParseIP(str(fields, "ip"))
	if ip != nil && strings.EqualFold(str(fields, "loc"), str(base, "country")) && (key == "ipv4" && ip.To4() != nil || key == "ipv6" && ip.To4() == nil) {
		result[key] = ip.String()
	}
	return result
}
