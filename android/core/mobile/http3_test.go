// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"context"
	"crypto/x509"
	"github.com/sagernet/quic-go/http3"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestMobileHTTP3AuthenticatedForwarding(t *testing.T) {
	origin := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("real-h3-response")) }))
	defer origin.Close()
	udp, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer udp.Close()
	server := &http3.Server{TLSConfig: origin.TLS, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "CONNECT" || r.Host != strings.TrimPrefix(origin.URL, "https://") || r.Header.Get("Proxy-Authorization") != "Bearer fixture-pass" {
			w.WriteHeader(403)
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
	})}
	go server.Serve(udp)
	defer server.Close()
	b := NewBackend(&testHost{}, "{}")
	b.roots = x509.NewCertPool()
	b.roots.AddCert(origin.Certificate())
	host, port, _ := net.SplitHostPort(udp.LocalAddr().String())
	n, _ := strconv.Atoi(port)
	settings := defaults()
	settings["transport"] = "h3"
	tunnel := newTunnel(b, settings, object{"host": host, "port": n}, "fixture-pass", context.Background())
	defer tunnel.close()
	body, err := tunnel.request(context.Background(), origin.URL, nil, "")
	if err != nil || string(body) != "real-h3-response" {
		t.Fatalf("HTTP3 forwarding failed: %v", err)
	}
	if tunnel.protocolName() != "http/3" || tunnel.up.Load() == 0 || tunnel.down.Load() == 0 {
		t.Fatal("HTTP3 traffic not recorded")
	}
	settingsAuto := copyObject(settings)
	settingsAuto["transport"] = "auto"
	automatic := newTunnel(b, settingsAuto, object{"host": host, "port": n}, "fixture-pass", context.Background())
	automatic.probeAddress = origin.URL
	defer automatic.close()
	body, err = automatic.request(context.Background(), origin.URL, nil, "")
	if err != nil || string(body) != "real-h3-response" || automatic.protocolName() != "http/3" {
		t.Fatalf("Automatic did not keep the working HTTP3 path: %v", err)
	}
	automatic.setToken("renewed-pass")
	automatic.mu.Lock()
	chosen := automatic.selected
	automatic.mu.Unlock()
	chosen.mu.Lock()
	renewed := chosen.token
	chosen.mu.Unlock()
	if renewed != "renewed-pass" {
		t.Fatal("Selected transport missed token renewal")
	}
}
func TestMobileAutomaticFallsBackToHTTP2(t *testing.T) {
	tunnel, origin := protocolTunnel(t)
	tunnel.settings["transport"] = "auto"
	tunnel.probeAddress = origin.URL
	body, err := tunnel.request(context.Background(), origin.URL, nil, "")
	if err != nil || string(body) != "tunneled-response" || !tunnel.h3fallback {
		t.Fatalf("HTTP2 fallback failed: %v", err)
	}
}
