// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"golang.org/x/net/dns/dnsmessage"
	"io"
	"net/http"
	"net/netip"
	"strings"
)

func encryptedEdges(ctx context.Context, host, provider string, client *http.Client) ([]netip.Addr, error) {
	servers := []string{"1.1.1.1", "8.8.8.8", "9.9.9.9"}
	switch provider {
	case "cloudflare":
		servers = servers[:1]
	case "google":
		servers = servers[1:2]
	case "quad9":
		servers = servers[2:]
	}
	return raceEdgeProviders(ctx, servers, func(ctx context.Context, server string) ([]netip.Addr, error) {
		type answer struct {
			kind dnsmessage.Type
			ips  []netip.Addr
		}
		answers := make(chan answer, 2)
		for _, kind := range []dnsmessage.Type{dnsmessage.TypeA, dnsmessage.TypeAAAA} {
			go func(kind dnsmessage.Type) {
				ips, _ := edgeDNSQuery(ctx, client, "https://"+server+"/dns-query", host, kind)
				answers <- answer{kind, ips}
			}(kind)
		}
		var ipv4, ipv6 []netip.Addr
		for range 2 {
			select {
			case <-ctx.Done():
				if len(ipv4) > 0 {
					return ipv4, nil
				}
				return nil, ctx.Err()
			case result := <-answers:
				if result.kind == dnsmessage.TypeA {
					ipv4 = result.ips
				} else {
					ipv6 = result.ips
				}
			}
		}
		ips := append(ipv4, ipv6...)
		if len(ips) == 0 {
			return nil, errors.New("No usable encrypted DNS answer")
		}
		return ips, nil
	})
}

func raceEdgeProviders(ctx context.Context, providers []string, query func(context.Context, string) ([]netip.Addr, error)) ([]netip.Addr, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	type result struct {
		ips []netip.Addr
		err error
	}
	answers := make(chan result, len(providers))
	for _, server := range providers {
		go func(server string) { ips, err := query(ctx, server); answers <- result{ips, err} }(server)
	}
	for range providers {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case answer := <-answers:
			if answer.err == nil && len(answer.ips) > 0 {
				return answer.ips, nil
			}
		}
	}
	return nil, errors.New("No usable encrypted DNS answer")
}

func edgeDNSQuery(ctx context.Context, client *http.Client, endpoint, host string, kind dnsmessage.Type) ([]netip.Addr, error) {
	name, err := dnsmessage.NewName(strings.TrimSuffix(host, ".") + ".")
	if err != nil {
		return nil, err
	}
	var nonce [2]byte
	if _, err = rand.Read(nonce[:]); err != nil {
		return nil, err
	}
	query := dnsmessage.Message{Header: dnsmessage.Header{ID: binary.BigEndian.Uint16(nonce[:]), RecursionDesired: true}, Questions: []dnsmessage.Question{{Name: name, Type: kind, Class: dnsmessage.ClassINET}}}
	wire, err := query.Pack()
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(wire))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/dns-message")
	req.Header.Set("Content-Type", "application/dns-message")
	response, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK || !strings.HasPrefix(strings.ToLower(response.Header.Get("Content-Type")), "application/dns-message") {
		return nil, errors.New("Encrypted DNS unavailable")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 65537))
	if err != nil || len(data) > 65536 {
		return nil, errors.New("Invalid encrypted DNS response")
	}
	return parseEdgeDNS(query, data)
}

func parseEdgeDNS(query dnsmessage.Message, data []byte) ([]netip.Addr, error) {
	var response dnsmessage.Message
	if err := response.Unpack(data); err != nil {
		return nil, err
	}
	if !response.Response || response.ID != query.ID || response.RCode != dnsmessage.RCodeSuccess || response.Truncated || len(response.Questions) != 1 || response.Questions[0] != query.Questions[0] {
		return nil, errors.New("Invalid encrypted DNS response")
	}
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
	ips := []netip.Addr{}
	seen := map[netip.Addr]bool{}
	for _, r := range response.Answers {
		if r.Header.Class != dnsmessage.ClassINET || !allowed[strings.ToLower(r.Header.Name.String())] {
			continue
		}
		var ip netip.Addr
		switch body := r.Body.(type) {
		case *dnsmessage.AResource:
			if query.Questions[0].Type == dnsmessage.TypeA {
				ip = netip.AddrFrom4(body.A)
			}
		case *dnsmessage.AAAAResource:
			if query.Questions[0].Type == dnsmessage.TypeAAAA {
				ip = netip.AddrFrom16(body.AAAA)
			}
		}
		if ip.IsValid() && ip.IsGlobalUnicast() && !ip.IsPrivate() && !seen[ip] {
			seen[ip] = true
			ips = append(ips, ip)
		}
	}
	if len(ips) == 0 {
		return nil, errors.New("No usable encrypted DNS answer")
	}
	return ips, nil
}
