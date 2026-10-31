# HTTP/3 transport comparison

## Current-source review, 2026-10-31

The reference was rechecked at `9f8350ce1291b51478f037d2fab8844dee5c0f74`.
This section supersedes any earlier description of the current network's behavior below; the older sections record earlier implementation and acceptance checks.

The reference still uses Mozilla Remote Settings CONNECT endpoints, including
`p.m1.fastly-masque.net:2499` (recommended) and
`muc139.m1.fastly-masque.net:2499` (Germany). Port 443 is a default only when
the advertised endpoint has no port. It does not discover an alternative HTTP/3
relay or disguise QUIC as TCP.

| Handshake or tunnel behavior | Current reference | Fox VPN |
| --- | --- | --- |
| Bootstrap | Races Cloudflare, Google and Quad9 RFC 8484 resolvers; asks A first, AAAA only for an empty A answer; optional system fallback | Encrypted bootstrap with physical DNS fallback; retains both address families |
| QUIC initial packet | 1200-byte payload | 1200-byte payload on desktop and Android |
| Address attempts | IPv4 preferred, then IPv6; budget divided across addresses with a three-second minimum | Same family preference and bounded attempts; Android protects sockets before binding |
| TLS | Original endpoint hostname, verified certificate, TLS 1.3 and ALPN `h3` | Same verification requirements |
| Session | One multiplexed QUIC connection by default, 30-second keepalive | Multiplexed connection, 30-second keepalive |
| Authentication | Account proxy pass in `Proxy-Authorization`, browser-style User-Agent; ordinary HTTP CONNECT streams | Equivalent authenticated CONNECT semantics |
| QUIC library | `github.com/quic-go/quic-go v0.59.0` | Desktop v0.64.1; Android sing-box-compatible SagerNet fork v0.52.0-beta.1 |
| Stream API | `http3.Transport.RoundTrip` with a bounded write buffer | Desktop request-stream API; Android `http3.ClientConn.RoundTrip` |
| Default protocol | Explicit HTTP/2 by default; HTTP/3 selectable | Automatic races verified HTTPS paths and retains the first healthy transport |

The initial packet size is significant on lower-MTU links. Fox VPN already
uses the same value. CONNECT headers, body buffering and account authentication
are processed after QUIC establishes; changing those cannot explain a timeout
before the first verified handshake.

### Physical phone evidence

On 2026-10-31 a credential-free ARM64 diagnostic ran outside the app's VPN on
the attached phone's cellular network. It used the Android core's QUIC library,
trusted CA bundle, original hostname/SNI and a 1200-byte initial packet.

| Destination | IPv4 result | IPv6 result |
| --- | --- | --- |
| Fastly recommended, UDP 2499 | Six-second timeout | Six-second timeout |
| Fastly Germany, UDP 2499 | Six-second timeout | Six-second timeout |
| Google, UDP 443 | Six-second timeout | Verified handshake in 349 ms |

Both physical address families were present. Trying those Fastly endpoints on
443 also timed out. Automatic connected using HTTP/2 with exit verification.
These observations establish that QUIC is not universally unavailable on this
cellular network, and that the failure can occur without Fox VPN's TUN or
account flow. They do not distinguish carrier/path filtering from an endpoint
availability issue, or prove that the reference app succeeds on this network.

The manual `android-network-check.yml` workflow also builds the same
credential-free probe against the reference's exact QUIC library version.
This separates a library difference from a network result without installing
another app, accessing account secrets, or downloading unrelated APKs.

The comparison build from [run 41206011742](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/41206011742)
was then executed on the same phone. With upstream quic-go v0.59.0, Google
IPv6 completed a verified handshake in 426 ms; both Fastly endpoints timed
out on both families under the same six-second per-address diagnostic budget.
Google IPv4 also timed out. Switching to the reference's library therefore
did not resolve this observed handshake failure. This was a transport probe,
not a test of the reference application's authenticated VPN or its full
twenty-second connection/retry policy.

Current pinned reference sources:

- [HTTP/3 handshake and CONNECT](https://github.com/armanlife/firefox-vpn-client/blob/9f8350ce1291b51478f037d2fab8844dee5c0f74/core/internal/proxy/upstream_h3.go)
- [Bootstrap query behavior](https://github.com/armanlife/firefox-vpn-client/blob/9f8350ce1291b51478f037d2fab8844dee5c0f74/core/internal/resolver/doh.go)
- [Protocol and resolver defaults](https://github.com/armanlife/firefox-vpn-client/blob/9f8350ce1291b51478f037d2fab8844dee5c0f74/core/internal/config/config.go)
- [Physical UDP socket binding](https://github.com/armanlife/firefox-vpn-client/blob/9f8350ce1291b51478f037d2fab8844dee5c0f74/core/internal/egress/egress.go)

No reference source code was copied in this recheck.

## Earlier implementation baseline

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

## Windows validation update

Windows now resolves the outer proxy through parallel, TLS-verified RFC 8484 providers, retaining both address families and preferring IPv4. Explicit edge/DNS overrides bypass this bootstrap, and encrypted lookup failure falls back to the system resolver. The connected address remains pinned and is returned for TUN route exclusion. Forced HTTP/3 has a 20-second budget. The subsequent Windows Automatic update races completed HTTPS probes through both protocols and retains the first healthy path, cancelling its competitor. This measures cold-start responsiveness, not sustained throughput. Recommended uses the official REC anycast endpoint when present. These changes await owner acceptance before rollout to other platforms.

[Transport CI](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40189395885) at revision `6012900` passed Go race checks, vet, DNS response-validation/cancellation fixtures, real QUIC CONNECT tests and Windows cross-compilation. Forty-two Node tests passed through the repository test runner. The newer quic-go version and direct RequestStream API remain: authenticated CONNECT semantics are covered by local fixtures and the production check below; changing libraries is not required to reproduce the reference's endpoint and handshake mechanism.

On the owner's Windows machine, the rebuilt helper obtained a fresh account proxy pass and completed authenticated HTTP/3 CONNECT through Germany (`muc139.m1.fastly-masque.net:2499`) and REC (`p.m1.fastly-masque.net:2499`). Each tunnel carried a nested HTTPS request to `example.com` with certificate verification enabled and returned `HTTP/1.1 200 OK`. Initial handshakes completed in approximately 0.5 seconds in that check. An independent Google HTTP/3 probe still timed out. Successful Fastly results establish production forwarding at the time of this check, but do not isolate which change or network condition resolved the earlier timeout, and do not establish long-term stability or Android success.

## Pinned source links

- [Server metadata](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/serverlist/serverlist.go)
- [Endpoint selection](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/proxy/selection.go)
- [HTTP/3 CONNECT](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/proxy/upstream_h3.go)
- [Resolver](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/resolver/resolver.go)
- [Defaults](https://github.com/armanlife/firefox-vpn-client/blob/13845fafb2a67e2c1ba1e1145537a0a5db16a8d3/core/internal/config/config.go)

Reference-derived code retains its MIT attribution in `licenses/firefox-vpn-client-MIT.txt`.

## Approved rollout

After Windows acceptance, the desktop bootstrap, REC selection and first-healthy HTTPS transport decision were enabled for macOS and Linux. Android implements the equivalent decision with independent, socket-protected candidate tunnels, a twenty-second forced QUIC budget and separate real-delay setup/sample deadlines. Account changes discard previous-account streams and propagate token renewal to the selected transport. Core, package and native-device CI passed. A universally successful physical HTTP/3 path is not claimed: the owner's current network remains intermittent, and testing another network is still pending.
