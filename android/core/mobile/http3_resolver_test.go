// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"context"
	"errors"
	"golang.org/x/net/dns/dnsmessage"
	"net"
	"strings"
	"syscall"
	"testing"
)

func TestHTTP3RecoversIPv4WithoutDiscardingNAT64(t *testing.T) {
	native := func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("64:ff9b::cb00:7107")}}, nil
	}
	calls := 0
	recovery := func(context.Context, string) ([]net.IPAddr, error) {
		calls++
		return []net.IPAddr{{IP: net.ParseIP("203.0.113.7")}}, nil
	}
	ips, err := resolveH3Addresses(context.Background(), "edge.example", native, recovery)
	if err != nil || len(ips) != 2 || ips[0].IP.To4() == nil || ips[1].IP.To4() != nil || calls != 1 {
		t.Fatalf("family fallback failed: %v %v", ips, err)
	}
	ips, err = resolveH3Addresses(context.Background(), "2001:db8::7", native, recovery)
	if err != nil || len(ips) != 1 || calls != 1 {
		t.Fatal("literal address was resolved publicly")
	}
	native4 := func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("203.0.113.7")}}, nil
	}
	_, err = resolveH3Addresses(context.Background(), "edge.example", native4, recovery)
	if err != nil || calls != 1 {
		t.Fatal("unnecessary encrypted DNS query")
	}
	failed := func(context.Context, string) ([]net.IPAddr, error) { return nil, errors.New("offline") }
	ips, err = resolveH3Addresses(context.Background(), "edge.example", native, failed)
	if err != nil || len(ips) != 1 {
		t.Fatal("lost native IPv6 when recovery unavailable")
	}
}
func TestHTTP3DNSRejectsMismatchedAndUnrelatedAnswers(t *testing.T) {
	name, _ := dnsmessage.NewName("edge.example.")
	other, _ := dnsmessage.NewName("unrelated.example.")
	q := dnsmessage.Message{Header: dnsmessage.Header{ID: 17}, Questions: []dnsmessage.Question{{Name: name, Type: dnsmessage.TypeA, Class: dnsmessage.ClassINET}}}
	response := dnsmessage.Message{Header: dnsmessage.Header{ID: 17, Response: true}, Questions: q.Questions, Answers: []dnsmessage.Resource{{Header: dnsmessage.ResourceHeader{Name: name, Type: dnsmessage.TypeA, Class: dnsmessage.ClassINET}, Body: &dnsmessage.AResource{A: [4]byte{23, 235, 42, 8}}}}}
	data, _ := response.Pack()
	ips, err := parseH3IPv4(q, data)
	if err != nil || len(ips) != 1 || ips[0].IP.String() != "23.235.42.8" {
		t.Fatal("valid A record rejected", err)
	}
	response.Header.ID = 18
	data, _ = response.Pack()
	if _, err = parseH3IPv4(q, data); err == nil {
		t.Fatal("wrong transaction accepted")
	}
	response.Header.ID = 17
	response.Answers[0].Header.Name = other
	data, _ = response.Pack()
	if _, err = parseH3IPv4(q, data); err == nil {
		t.Fatal("unrelated A record accepted")
	}
}
func TestHTTP3DoesNotHideTimeoutBehindIPv6NoRoute(t *testing.T) {
	var failure h3Failures
	failure.add(context.DeadlineExceeded)
	failure.add(&net.OpError{Op: "write", Net: "udp6", Err: syscall.ENETUNREACH})
	if !strings.Contains(failure.err().Error(), "timed out") {
		t.Fatal("IPv6 error concealed previous timeout")
	}
	failure = h3Failures{}
	failure.add(syscall.ENETUNREACH)
	if !strings.Contains(failure.err().Error(), "network route") {
		t.Fatal("route failure not actionable")
	}
}
