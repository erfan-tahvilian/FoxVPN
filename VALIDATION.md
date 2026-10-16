# v1.0.0 verification record

## Published Android APK installation — 2026-10-16

- The signed v1.0.0 x86_64 and universal APKs were downloaded directly from the release, checked against GitHub asset SHA-256 digests and the project's pinned signing certificate, then installed and launched on an Android 16 / API 36 x86_64 emulator. The test covers a fresh x86_64 installation and an update to the universal APK; the application remained running without a Java or native startup crash. See the [installation check](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38839111418).
- Local checks of the published ARM64 APK passed Android API 36 signature verification, ZIP integrity and duplicate-entry checks, 16 KB ZIP alignment, and ELF load-segment alignment and offset congruence. The local phone-test copy has the same SHA-256 digest as the release asset.
- An isolated installation experiment changes only `extractNativeLibs` and native-library ZIP compression. All other uncompressed APK payloads, including DEX and native engine bytes, are preserved. The ARM64 device-test APK passes API 36 signature verification with the existing project certificate and ZIP alignment checks. The same packaging experiment passed fresh installation and startup on an API 36 x86_64 emulator with an ephemeral CI-only certificate. See the [extended installation check](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38848258668). The usual Android core, package, lint and device checks also [passed](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38848258523).
- The Daria Bond II report concerns a first installation from Releases, with both ARM64 and universal APKs rejected. The device is unavailable for direct diagnostics. These checks do not reproduce or resolve that reported failure: installation of the experimental ARM64 APK on the affected device still requires confirmation. The owner subsequently confirmed that the experimental ARM64 APK installed, opened and worked on the Daria Bond II. Installation-time native extraction is now adopted for production Android builds; new UI and networking changes still require the usual release checks.

## Cross-platform update — 2026-10-15

- 19 desktop protocol, storage and routing tests pass. Coverage includes include/exclude routing on Windows and macOS, UDP isolation for selected apps, and migration and persistence of location order and routing preferences.
- Renderer checks cover automatic preference saving, app search and selection, selected apps appearing first when reopened, account initials and circular avatar geometry. Native main-process checks cover preference persistence and restricted application icon access.
- Windows application discovery was checked against installed shortcuts, registered executables and packaged apps. macOS discovers application bundles and includes their helper executables in routing rules.
- The Android ARM64 build was tested on a physical Android 12 device. The tester confirmed working application traffic, split tunneling and stable background connectivity after the connection recovery and encrypted DNS changes. Other Android architectures receive build and emulator checks, rather than physical-device coverage.
- Live desktop VPN routing for the new include mode still requires user testing. Configuration and automated protocol checks do not replace a live application-routing test.

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

## Android validation

- Eight Go core tests pass under the race detector. Coverage includes desktop-compatible authentication derivation, encrypted-storage failure handling, renderer credential isolation, real TLS/HTTP2 CONNECT and nested HTTPS, fragmented SOCKS5, cancellation, connection lifecycle, stale-session failures and latency validation. `go vet` passes.
- All five APK variants pass binary checks: exact ABI sets, ELF CPU types, compressed native libraries with installation-time extraction and 16 KB ELF load-segment alignment for 64-bit targets. Required interface and license assets are present.
- Android release lint reports no errors. Dependency-version suggestions, JavaScript use for packaged WebView assets and the supplied notification icon are reviewed warnings.
- Three instrumentation tests pass on an Android 15 x86_64 emulator: interface navigation and theme switching, encrypted Keystore-backed storage with tamper rejection, and actual system VPN consent, native TUN startup, socket protection and cleanup. The native engine accepts all six generated DNS configurations. The TUN test leaves the default route unchanged.
- Release APKs are signed locally with the persistent project certificate, verified with `apksigner`, and checked again for native alignment. The private signing key is excluded from source and CI.

Real-device verification on a Redmi Note 9 Pro (ARM64, MIUI/Android 12) confirmed authenticated VPN traffic over Wi-Fi: HTTP, HTTPS by IPv4 address, DNS-based HTTPS, a 122 KB page download and Google's HTTP 204 connectivity endpoint. The owner also confirmed browsing and application connectivity. Quick Settings disconnect removes the TUN and sets the tile inactive; reconnect works with the activity in the background and restores HTTPS. Direct HTTP works after disconnect. The mixed stack previously stalled in TCP SYN_RECV while the local SOCKS bridge worked; selecting userspace TCP in the Android service resolved the observed failure.

Other physical devices/architectures, vendor power-management behavior and real Wi-Fi/mobile handovers still require device testing. Cross-compilation and an x86_64 emulator do not establish those results. Debug integration services and test fixtures are excluded from release APKs.

## Connection overview and desktop tray update

- Twenty-one Node tests pass, including address-family discovery, country validation and location-name normalization.
- Electron checks cover Overview latency controls, separate IPv4/IPv6 rows, disabled verification cursors and both themes. The tray popup is exercised with connected/disconnected states and rejects commands from other windows.
- The owner confirmed that the compressed-native ARM64 installation package installs and opens on Daria Bond II running Android 16. Production Android packaging now uses that extraction mode.
- Optional address-family discovery runs through the authenticated tunnel and does not determine connection readiness. An unavailable address family is reported without interrupting the VPN.
