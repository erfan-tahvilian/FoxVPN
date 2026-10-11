# v1.0.0 verification record

Checked on Windows x64 on 2026-10-11.

## Passed

- **14 automated protocol/storage tests**: key derivation and Hawk request signing, deferred email verification, permanent/transient token refresh failures, server filtering, proof of work, input validation, DNS/split-routing configuration, encrypted vault rollback and password redaction, fragmented SOCKS5 negotiation, and rejected unsupported authentication.
- **Actual local TLS + HTTP/2 integration**: a trusted localhost test certificate, authenticated HTTP/2 CONNECT, nested HTTPS with certificate validation, and bidirectional byte accounting. The test CA and key are test fixtures only and are not bundled in the application.
- **Renderer smoke test**: all five pages, dark/light switching, unique DOM IDs, offline country flag loading in the list and selected-location card, no Node.js access, and no renderer console errors. Screenshots were visually reviewed.
- **Real Electron main process**: sandboxed preload IPC, Windows DPAPI vault persistence, invalid settings rejection, signed-out account behavior, and external URL allowlist. Uses an isolated test profile.
- **Live Mozilla Remote Settings**: 34 usable endpoints across 34 countries at the time of verification. No account credentials used.
- **Actual sing-box 1.12.0 binary validation**: generated configurations for automatic DNS, custom TCP DNS, network resolver, Google and Quad9 accepted by `sing-box check`.
- **Pinned downloads**: Electron package checksum, GitHub sing-box asset SHA-256 digest and Wintun 0.14.1 SHA-256 checked. Wintun is copied without modification.
- **Runtime dependency audit**: no reported advisories for production npm dependencies at the time of verification. Build dependencies have 8 moderate advisories reported by npm; they are excluded from the shipped application.
- JavaScript syntax checks and packaged source/resource comparison.

## Not verified with an actual account

Firefox Accounts acceptance, email-code delivery, Guardian production entitlement/allowance, a live Fastly VPN tunnel, Administrator TUN traffic/routing restoration, and executable exclusions under a live connection. These require an eligible Firefox account and network access. Local protocol fixtures and configuration acceptance do not substitute for that verification.

The installer is unsigned. This release makes no claim of a persistent kill switch or general UDP/QUIC support. See README and release notes for the exact scope.

## v1.0.0 update validation

- 16 protocol/storage/latency tests pass. Real local TCP listeners validate reachable and refused endpoint results; scheduler tests verify bounded concurrency and incremental completion.
- Electron renderer smoke checks cover supplied theme logos, sun/moon glyphs, circular globe geometry, all custom select controls, selecting options, duplicate service recommendations, incremental latency badges and a simulated automatic connection with an authoritative Canadian exit. These fixtures do not claim a live VPN connection.
- Actual main-process sandboxed IPC and DPAPI checks pass.
- Live public discovery and TCP checks reached all 34 endpoints on this machine; no account credentials were used.

## Current locations and architecture update

- Renderer assertions cover the corrected theme logos, absence of the platform badge, both directions of name/latency sorting, unknown results last, and individual ping without location selection or navigation.
- PE architecture checks verify that Electron, sing-box and Wintun match each requested target, then verify the packaged app/engine/driver again.
- CI executes x86 Electron smoke checks on x64 Windows via WOW64 and ARM64 smoke/config checks on a native ARM64 Windows runner. These checks do not represent an authenticated production VPN/TUN session.

## macOS validation

Native Intel and Apple Silicon CI run the shared protocol suite and real Electron renderer/main smoke checks. Each native sing-box validates all generated DNS configurations. A privileged lifecycle test creates a real utun device, waits for its authenticated loopback controller and verifies that disconnect removes the device; it keeps auto-route disabled so the CI runner retains its default connection. Package verification checks every source/asset/license file, the application version, Mach-O CPU types, executable permissions, app icon and Info.plist. No macOS application is installed on the developer’s Windows host. Apple’s interactive authorization dialog and full production Firefox-account VPN traffic are not exercised in headless CI.
