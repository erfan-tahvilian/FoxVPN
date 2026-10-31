// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestLocationSelectionAndConnectDoNotWaitForPing(t *testing.T) {
	b := NewBackend(&testHost{}, "{}")
	defer b.stopPings()
	if err := b.addAccount(fixtureAuth("fixture@example.com", "fixture")); err != nil {
		t.Fatal(err)
	}
	b.servers = []object{{"id": "one", "host": "one.example", "port": 443}, {"id": "two", "host": "two.example", "port": 443}}
	entered := make(chan struct{})
	var calls atomic.Int32
	b.client.Transport = exitRoundTripper(func(r *http.Request) (*http.Response, error) {
		if calls.Add(1) == 1 {
			close(entered)
			<-r.Context().Done()
			return nil, r.Context().Err()
		}
		return &http.Response{StatusCode: 500, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"message":"fixture refusal"}`))}, nil
	})
	pingDone := make(chan string, 1)
	go func() { pingDone <- b.Call("ping", "[]") }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("Ping did not start")
	}
	selectDone := make(chan string, 1)
	go func() { selectDone <- b.Call("select", `["two"]`) }()
	select {
	case result := <-selectDone:
		if !strings.Contains(result, `"ok":true`) {
			t.Fatal(result)
		}
	case <-time.After(time.Second):
		b.stopPings()
		t.Fatal("Location selection waited for ping")
	}
	connectDone := make(chan string, 1)
	go func() { connectDone <- b.Call("connect", "[]") }()
	select {
	case <-connectDone:
	case <-time.After(time.Second):
		b.stopPings()
		t.Fatal("Connect waited for ping")
	}
	select {
	case <-pingDone:
	case <-time.After(time.Second):
		t.Fatal("Background ping was not cancelled")
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.pinging || len(b.pingingIDs) != 0 || len(b.latencies) != 0 {
		t.Fatal("Cancelled check left stale latency state")
	}
}
