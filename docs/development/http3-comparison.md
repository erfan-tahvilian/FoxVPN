# HTTP/3 transport comparison

Reviewed reference: `armanlife/firefox-vpn-client` at commit `13845fafb2a67e2c1ba1e1145537a0a5db16a8d3`.
Fox VPN baseline: `e10edbf`. Review date: 2026-10-25.

## Server and authentication path

Both clients fetch Mozilla's Remote Settings `vpn-serverlist` collection, select a non-quarantined CONNECT endpoint and obtain an account-bound proxy pass from `https://vpn.mozilla.org/api/v1/fpn/token`. HTTP/3 carries authenticated HTTP CONNECT streams to the Fastly edge. The destination website's `host:port` is the CONNECT authority; its TCP stream runs inside the HTTP/3 request and response bodies. The proxy pass is sent in `Proxy-Authorization: Bearer ...`.

The current public list returned these samples during this review:

| Location | CONNECT endpoint |
| --- | --- |
| Recommended / REC | `p.m1.fastly-masque.net:2499` |
| Germany | `muc139.m1.fastly-masque.net:2499` |
| United Kingdom | `eglc860.m1.fastly-masque.net:2499` |

These are service metadata, not permanently pinned addresses. Both clients use the advertised port; 443 is only the fallback when metadata omits a port. The reference does not use a secret HTTP/3 server or replace every advertised port with 443. Its HTTP/3 path uses ordinary CONNECT for TCP, not CONNECT-UDP/MASQUE relay for arbitrary application UDP.

## Differences at the baseline

| Area | Reference | Fox VPN baseline |
| --- | --- | --- |
| Bootstrap DNS | Encrypted DNS by default for the program's own connections; parallel resolver queries, cache, IPv4-first results and optional system fallback | Desktop endpoint resolution uses system DNS. Android starts with protected physical-network DNS and recovers a missing IPv4 answer using DoH. Tunneled application DNS is a separate setting. |
| Recommended selection | Selects the REC anycast location and persists the matching endpoint | REC shuffles candidates across the complete country list and tries a bounded number. |
| Metadata filtering | Evaluates Remote Settings client/version/country filter expressions; checks CONNECT scheme | Reads CONNECT entries and skips quarantined servers; does not evaluate these filter expressions or check the scheme. |
| Protocol choice | Explicit h2 or h3; default is h2 | Automatic tries h3 and falls back to h2; explicit h2 and h3 are also available. |
| QUIC timeout | 20-second connection budget; per-IP attempts with a minimum of three seconds within that budget | Desktop forced h3 uses 10 seconds and Automatic 3.5 seconds. |
| QUIC settings | Initial packet size 1200 bytes, 30-second keepalive, original-host TLS/SNI and certificate verification | The same initial packet size, keepalive and original-host verification after reference alignment. |
| CONNECT API | `http3.Transport.RoundTrip` with a live duplex request body | Desktop helper uses `OpenRequestStream`; Android uses `ClientConn.RoundTrip`. Both are valid HTTP/3 APIs, but not identical implementations. |
| Library | quic-go v0.59.0 | Desktop quic-go v0.64.1; Android uses the sing-box-compatible SagerNet fork v0.52.0-beta.1. |
| Firefox headers | Browser-style User-Agent, updated from Firefox product-version metadata | CONNECT uses a fixed Firefox-style header. Control-plane requests retain the MozillaVPN-style header. |
| Lifecycle | Controller with backoff, health tracking and configurable session pool; one session by default | One multiplexed edge session, existing connection monitor, automatic protocol fallback and platform-specific VPN engine lifecycle. |

## Implications for the phone error

An IPv6 `network is unreachable` error establishes that a particular IPv6 send had no usable route. It does not establish whether an earlier IPv4 attempt timed out, whether DNS returned IPv4, whether UDP is filtered, or whether the reference succeeds on that network. The Android update recovers missing IPv4 answers and prevents a later IPv6 route error from hiding an earlier timeout. It has not yet established production HTTP/3 forwarding on the owner's phone.

The most useful next parity work for Windows is encrypted bootstrap DNS, native REC endpoint selection, the reference timeout budget and a matched CONNECT/session implementation. Transport fixtures and public unauthenticated probes do not substitute for a successful authenticated production connection.

## Pinned source links

- [Server metadata](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/serverlist/serverlist.go)
- [Endpoint selection](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/proxy/selection.go)
- [HTTP/3 CONNECT](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/proxy/upstream_h3.go)
- [Resolver](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/resolver/resolver.go)
- [Defaults](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/config/config.go)

Reference-derived code retains its MIT attribution in `licenses/firefox-vpn-client-MIT.txt`.
