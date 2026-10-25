// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"golang.org/x/net/dns/dnsmessage"
)

// Recover an IPv4 answer if the physical network resolver returns only AAAA
// records. Preserve the native IPv6 addresses, including DNS64/NAT64 answers.
// Custom edge names and explicit DNS overrides never go to public resolvers.
func (t *proxyTunnel) h3Addresses(ctx context.Context, host string) ([]net.IPAddr, error) {
	allow := str(t.settings, "edge") == "" && str(t.settings, "customDns") == "" && str(t.settings, "doh") != "off"
	if allow && net.ParseIP(host) == nil {
		bootstrap, cancel := context.WithTimeout(ctx, 2*time.Second)
		ips, err := encryptedEdges(bootstrap, host, str(t.settings, "doh"), t.b.client)
		cancel()
		if err == nil && len(ips) > 0 {
			addresses := make([]net.IPAddr, 0, len(ips))
			for _, ip := range ips {
				addresses = append(addresses, net.IPAddr{IP: net.IP(ip.AsSlice())})
			}
			return addresses, nil
		}
	}
	return resolveH3Addresses(ctx, host, t.b.dialer.Resolver.LookupIPAddr, func(context.Context, string) ([]net.IPAddr, error) {
		return nil, errors.New("Encrypted bootstrap unavailable")
	})
}
func resolveH3Addresses(ctx context.Context, host string, native, ipv4 func(context.Context, string) ([]net.IPAddr, error)) ([]net.IPAddr, error) {
	if ip := net.ParseIP(host); ip != nil {
		return []net.IPAddr{{IP: ip}}, nil
	}
	addresses, lookupErr := native(ctx, host)
	has4 := false
	for _, a := range addresses {
		has4 = has4 || a.IP.To4() != nil
	}
	if !has4 && ctx.Err() == nil {
		fallback, cancel := context.WithTimeout(ctx, 2*time.Second)
		extra, err := ipv4(fallback, host)
		cancel()
		if err == nil {
			addresses = append(extra, addresses...)
		}
	}
	ordered := []net.IPAddr{}
	seen := map[string]bool{}
	for _, v4 := range []bool{true, false} {
		for _, a := range addresses {
			if a.IP == nil || (a.IP.To4() != nil) != v4 {
				continue
			}
			key := a.String()
			if !seen[key] {
				seen[key] = true
				ordered = append(ordered, a)
			}
		}
	}
	if len(ordered) > 0 {
		return ordered, nil
	}
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if lookupErr != nil {
		return nil, lookupErr
	}
	return nil, errors.New("HTTP/3 server name could not be resolved")
}
func (b *Backend) h3IPv4(ctx context.Context, host, provider string) ([]net.IPAddr, error) {
	providers := []string{"1.1.1.1", "8.8.8.8", "9.9.9.9"}
	switch provider {
	case "cloudflare":
		providers = providers[:1]
	case "google":
		providers = []string{"8.8.8.8"}
	case "quad9":
		providers = []string{"9.9.9.9"}
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	type answer struct {
		ips []net.IPAddr
		err error
	}
	results := make(chan answer, len(providers))
	for _, server := range providers {
		go func(server string) { ips, err := b.h3DNSQuery(ctx, server, host); results <- answer{ips, err} }(server)
	}
	var last error
	for range providers {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case a := <-results:
			if a.err == nil && len(a.ips) > 0 {
				return a.ips, nil
			}
			last = a.err
		}
	}
	if last == nil {
		last = errors.New("No IPv4 answer received")
	}
	return nil, last
}
func (b *Backend) h3DNSQuery(ctx context.Context, server, host string) ([]net.IPAddr, error) {
	name, err := dnsmessage.NewName(strings.TrimSuffix(host, ".") + ".")
	if err != nil {
		return nil, err
	}
	var nonce [2]byte
	if _, err = rand.Read(nonce[:]); err != nil {
		return nil, err
	}
	query := dnsmessage.Message{Header: dnsmessage.Header{ID: binary.BigEndian.Uint16(nonce[:]), RecursionDesired: true}, Questions: []dnsmessage.Question{{Name: name, Type: dnsmessage.TypeA, Class: dnsmessage.ClassINET}}}
	wire, err := query.Pack()
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", "https://"+server+"/dns-query", bytes.NewReader(wire))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/dns-message")
	req.Header.Set("Content-Type", "application/dns-message")
	// b.client uses the protected physical-network dialer and trusted CA pool.
	response, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, errors.New("Encrypted DNS unavailable")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 65537))
	if err != nil || len(data) > 65536 {
		return nil, errors.New("Invalid encrypted DNS response")
	}
	return parseH3IPv4(query, data)
}
func parseH3IPv4(query dnsmessage.Message, data []byte) ([]net.IPAddr, error) {
	var response dnsmessage.Message
	if err := response.Unpack(data); err != nil {
		return nil, err
	}
	if !response.Header.Response || response.Header.ID != query.Header.ID || response.Header.RCode != dnsmessage.RCodeSuccess || response.Header.Truncated || len(response.Questions) != 1 || response.Questions[0] != query.Questions[0] {
		return nil, errors.New("Invalid encrypted DNS response")
	}
	// Only accept A records for the queried name or its returned CNAME chain.
	allowed := map[string]bool{strings.ToLower(query.Questions[0].Name.String()): true}
	for range response.Answers {
		changed := false
		for _, r := range response.Answers {
			if c, ok := r.Body.(*dnsmessage.CNAMEResource); ok && r.Header.Class == dnsmessage.ClassINET && allowed[strings.ToLower(r.Header.Name.String())] {
				name := strings.ToLower(c.CNAME.String())
				if !allowed[name] {
					allowed[name] = true
					changed = true
				}
			}
		}
		if !changed {
			break
		}
	}
	ips := []net.IPAddr{}
	for _, r := range response.Answers {
		if a, ok := r.Body.(*dnsmessage.AResource); ok && r.Header.Class == dnsmessage.ClassINET && allowed[strings.ToLower(r.Header.Name.String())] {
			ip := net.IPv4(a.A[0], a.A[1], a.A[2], a.A[3])
			if ip.IsGlobalUnicast() && !ip.IsPrivate() {
				ips = append(ips, net.IPAddr{IP: ip})
			}
		}
	}
	if len(ips) == 0 {
		return nil, errors.New("No usable IPv4 answer received")
	}
	return ips, nil
}
