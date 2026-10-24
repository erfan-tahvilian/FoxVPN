# v1.0.0 verification record

## Routing editors, shutdown and real delay - 2026-10-24

[Windows x64/x86/ARM64](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091697770), [macOS Intel/Apple Silicon](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091697771) and [desktop publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40092065204) passed. Electron main-process smoke checks now install a renderer closure veto before quitting and still require successful process termination. Quit cleanup has a ten-second upper bound and ends with `app.exit(0)`. The existing native macOS utun creation/disconnect checks also passed. Physical Command+Q behavior remains pending confirmation on the owner's Mac.

[Independent macOS icon validation](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091699607) disabled generic fallbacks and confirmed distinct native PNG icons for Calculator and Notes. NSWorkspace icons are rasterized at a small size before transport. Desktop renderer checks cover the visible manual routing editor, selection synchronization and disabled settings cursor.

Latency checks now time a complete HTTPS response through each authenticated tunnel rather than a TCP connection alone. The 23 desktop regression tests passed, including a real TLS/HTTP2 CONNECT integration test for the delay probe, failed-probe cleanup, timeout handling and bounded batch concurrency. Credentials are fetched outside the measured interval; only three probes run concurrently. Checking delay requires sign-in.

The [Android core, package, lint and emulator checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091388767) passed, including manual package entry, native-picker visibility and removal synchronization. [All five architectures were signed and published](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091849129) using the existing signing identity and the previously authorized encrypted single-use transfer; cleanup removed the transfer asset. Only the signed ARM64 APK was downloaded locally, and delivery to `E:\Other\FoxVPN` was verified against release SHA-256 `d41c6146185f3f5c377dfbc5aaa1251ae0bb19cef8578b24795bfbaabb42970e`. Physical Android validation remains with the owner.

The [iOS device build, simulator tests and publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091108023) passed. Its shared core includes real-delay checking. Standalone iOS does not expose nonfunctional per-app routing controls: Apple requires MDM-managed app/VPN mappings for production per-app VPN. The UI states this limitation. The IPA remains unsigned and physical iPhone VPN behavior remains unverified.

All 16 platform binaries in v1.0.0 were refreshed and checked against the complete global checksum manifest. The repository description was updated successfully. The final Windows x64 installer was built locally to avoid a redundant download; installation awaits Windows UAC confirmation.

## Refreshed cross-platform release - 2026-10-22

All 16 platform binaries in the existing v1.0.0 release were refreshed and their GitHub SHA-256 digests checked against the complete global checksum manifest. [Windows x64, x86 and ARM64 builds](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39789553502), [Intel and Apple Silicon macOS builds](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39789548926), and [desktop publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39790672969) passed. Windows application enumeration uses native PowerShell and bounds optional Store package discovery to avoid blocking the application catalog. Local regression and real Electron smoke checks passed; the current Windows x64 package was installed and its packaged source verified.

The [Android build](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39785930614) passed. All five APK architectures were [signed and published on GitHub Actions](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39790151719) using the existing certificate. The owner explicitly authorized encrypted, single-use transfer of the signing identity; the temporary transfer asset was removed and the runner cleanup completed. Only the final ARM64 APK was downloaded locally for delivery to the owner's test folder; its digest is `280f21bbd57d1f8d0a985606610341d8c15f0c320be489f12fa9ccc0b91f85d3`. Android two-step sign-in remains pending owner testing.

The [iOS device archive, simulator tests and publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39788742340) passed. The release includes the refreshed unsigned ARM64 IPA, corresponding source, signing tools, requested entitlements and bilingual installation guide. The IPA still requires authorized signing; physical iPhone VPN operation and macOS keyboard behavior remain unverified on physical devices.

## Two-step sign-in on Windows - 2026-10-22

The updated Windows x64 v1.0.0 application was installed in `D:\Program Files\FoxVPN` and its packaged source was compared with commit `175692e`. The owner confirmed successful sign-in using the account with two-step authentication enabled. All 23 desktop regression tests passed, including authenticator-code verification and retry after an invalid code without issuing OAuth credentials before verification.

The shared mobile implementation includes the corresponding authenticator-code flow, but real-account two-step sign-in on Android and iOS has not yet been confirmed. The macOS build passed; Command+Q cleanup, Command+W window closure and reopening still require verification on a physical Mac.

## Published iOS signing distribution - 2026-10-21

The [device build, simulator checks and automated publisher](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39623334814) passed for source `825d108bdb79b5041ab292f9b9345b9b20eb3071`. Eleven distribution-policy tests include explicit rejection of ARM64 simulator executables and profiles missing Packet Tunnel/shared-storage permissions. Package inspection checks iPhoneOS Mach-O platform identifiers, all three targets, required resources and non-system library references.

The [v1.0.0 release](https://github.com/erfan-tahvilian/FoxVPN/releases/tag/v1.0.0) now contains the unsigned device IPA, bilingual installation guide, requested entitlements, matching source, signing tools, build report and checksums. The publisher checked every uploaded iOS asset against GitHub SHA-256 metadata and refreshed the global checksum file. No Apple signing credentials were available, so the real credential-import/export branch, physical installation, live VPN routing, background behavior and system controls remain unverified. Free Personal Team sideloading is not presented as a working Packet Tunnel installation method.

## Android notification refinement - 2026-10-21

The owner confirmed that downloaded/uploaded totals and the session timer in the preceding Android update worked on the physical phone. The notification refinement retains the system header status, location and chronometer, removes repeated status/time from the content, and schedules traffic refreshes every second. The [Android core, lint, package and emulator checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39617398728) passed. The owner subsequently confirmed the refined expanded/collapsed notification and one-second traffic refresh on the physical phone.

## iOS client and Android session notifications - 2026-10-21

- The [iOS build and simulator checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39611973436) passed. The native framework contains an ARM64 device slice and ARM64/Intel simulator slices. The device archive includes the main app, packet-tunnel extension and Control Center/Live Activity extension; validation checks their ARM64 executable headers, compiled icons, packaged interface, CA certificates and license resources.
- Simulator unit checks exercise the real native backend, saved location sorting, session formatting and country-name normalization. The interface test launches the packaged WKWebView and navigates to Locations. These checks do not establish authenticated VPN routing or background operation on physical Apple hardware.
- The iOS IPA is an unsigned signing input. Apple certificates, provisioning profiles, installed entitlements, live device routing, handovers, Control Center actions and Live Activity updates still require verification using an appropriately signed build. No Apple signing identity was invented or uploaded.
- The [Android core, package, lint and emulator integration checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39608423574) passed. Notification formatting covers byte totals and elapsed time. Only the ARM64 artifact was downloaded locally; its GitHub artifact SHA-256 was verified before signing with the existing project certificate. The updated APK is available for the owner's notification check; no physical notification result is claimed here.

## Published Android APK installation - 2026-10-16

- The signed v1.0.0 x86_64 and universal APKs were downloaded directly from the release, checked against GitHub asset SHA-256 digests and the project's pinned signing certificate, then installed and launched on an Android 16 / API 36 x86_64 emulator. The test covers a fresh x86_64 installation and an update to the universal APK; the application remained running without a Java or native startup crash. See the [installation check](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38839111418).
- Local checks of the published ARM64 APK passed Android API 36 signature verification, ZIP integrity and duplicate-entry checks, 16 KB ZIP alignment, and ELF load-segment alignment and offset congruence. The local phone-test copy has the same SHA-256 digest as the release asset.
- An isolated installation experiment changes only `extractNativeLibs` and native-library ZIP compression. All other uncompressed APK payloads, including DEX and native engine bytes, are preserved. The ARM64 device-test APK passes API 36 signature verification with the existing project certificate and ZIP alignment checks. The same packaging experiment passed fresh installation and startup on an API 36 x86_64 emulator with an ephemeral CI-only certificate. See the [extended installation check](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38848258668). The usual Android core, package, lint and device checks also [passed](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38848258523).
- The Daria Bond II report concerns a first installation from Releases, with both ARM64 and universal APKs rejected. The device is unavailable for direct diagnostics. Emulator checks did not reproduce the vendor installer failure. The owner subsequently confirmed that the experimental ARM64 APK installed, opened and worked on the Daria Bond II. Installation-time native extraction is now adopted for production Android builds; new UI and networking changes still require the usual release checks.

## Cross-platform update - 2026-10-15

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

### Published build verification

The updated application passed [Windows x64, x86 and ARM64 builds](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38893208976), [native Intel and Apple Silicon macOS builds](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38893208818), and the [Android core, package, lint and emulator checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38893208796). The published signed x86_64 and universal APKs also passed [fresh installation and startup on Android 16](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38896444520). Windows x64 was installed at the configured local destination and its packaged source, engine architecture and version were verified. The owner confirmed the update on Redmi Note 9 Pro: tile long-press opens the app, Overview latency and address rows work, location names are correct, and internet access works.

## Location persistence and compact controls

- Twenty-two Node tests pass, including encrypted location-cache restoration after restart, preservation through preference changes, and rollback after failed persistence. Android has an equivalent core restoration test.
- Electron smoke checks measure the visible tray menu against its icon anchor and confirm that its lower edge is separated by only a small gap. The Android Overview layout is checked at phone width with a long country name and an unreachable latency result.
- Both README languages share artwork and download links. The Persian document uses explicit RTL direction for third-party entries; GitHub-rendered previews are checked at desktop and mobile widths in both themes.

The update passed [Windows x64, x86 and ARM64 checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38904278347), [Intel and Apple Silicon macOS checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38904278357), and [Android core, package and device integration checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38904278855). The final signed release APKs passed [Android 16 installation and startup verification](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/38908357443). The Windows ARM64 installed-application discovery check timed out on its first run and passed on rerun.

The owner confirmed the installed update on Windows and Redmi Note 9 Pro: the tray menu opens close to its icon, the settings order is correct, the Android Overview country and heading remain on one line, and refreshed locations remain visible after fully closing and reopening the app without internet access. Windows x64 was installed and its packaged source verified at the configured local destination. The phone update preserved application data and launched successfully. Physical macOS verification remains outside this device check.
