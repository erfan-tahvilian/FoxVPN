# Verification record

## Version 1.0.1 - 2026-10-31

- [Windows x64/x86/ARM64](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/41205485785), [macOS Intel/Apple Silicon](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/41205485764), [Linux x64/ARM64](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/41205485792) and [Android](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/41205485838) passed for runtime revision `b0a5ed7`. The Linux ARM64 tray smoke initially exceeded its deadline; rerunning that job passed without changing the runtime or weakening assertions.
- All 58 Node tests passed, including 21 update-target mappings, metadata rejection, version ordering, concurrent checks/cache/ETag behavior, per-version release highlights and complete-release publication policy. Local Electron renderer, main-process, tray and account smoke checks passed.
- A dedicated renderer check exercised first-launch highlights, deferred update presentation while another dialog is open, the matching direct-download URL, version labels and dark/light layouts. Captures use fixture account data and documentation-only IP addresses.
- Android Go race tests cover selection during a blocked delay request and connection cancelling remaining checks. Native emulator integration checks cover first-launch highlights and Back handling. These do not replace physical acceptance of the updated app's controls.
- All five APKs were [signed on the runner](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/41206409439) with the existing signing identity, transferred under the owner's prior authorization using an encrypted single-use envelope. Only ARM64 is downloaded for the attached phone.
- Physical cellular QUIC probes, including a second build using the reference client's upstream quic-go v0.59.0, completed Google IPv6 handshakes but timed out to Fastly recommended/Germany on IPv4 and IPv6. Automatic connected over HTTP/2 with exit verification. See [the pinned source comparison and test limits](docs/development/http3-comparison.md).

Update delivery against an actually newer public release requires a subsequent version; the current popup behavior was exercised with controlled release metadata. Physical macOS/Linux VPN forwarding and the new Android UI acceptance remain unconfirmed.

[Publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/41206950910) completed after all desktop and Android staging checks. The latest release contains 21 binaries, the project and sing-box source archives, and two checksum manifests (25 assets). The previous release entry was removed only after the new latest release was verified; source tags remain. No signing-transfer assets or iOS packages remain. Windows x64 was installed at `D:\Program Files\FoxVPN`; its packaged runtime and version match the workspace. The existing Android signer was verified before an in-place installation on the attached phone (version 1.0.1, code 1000001). The delivered ARM64 APK in `E:\Other\FoxVPN` has SHA-256 `67ef937e2bc2ed7d0c1f1a024493296ce333dea8bbf019b703b592c08fdcb152`.

## Earlier v1.0.0 validation

## Account service verification - 2026-10-29

The desktop account client now keeps verification, sign-in and token renewal on Chromium's network stack. Both cores decode nested challenge JSON without executing downloaded JavaScript and start verification with a separate cookie jar. A failed script download reports its HTTP status rather than a JavaScript-format error.

All 51 desktop Node tests and Electron renderer, main-process, tray and account checks passed. The opt-in live service check reached the account API and received error 102 for a random reserved diagnostic address. The updated Windows x64 application was installed and its account-control source verified; the owner then confirmed successful sign-in with a real email verification code. Earlier candidate builds that still failed verification were not published.

The Android core race tests, package checks, all-architecture native-library checks, 16 KB alignment checks and emulator integration tests passed in [Android build 40771366432](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40771366432). These Android changes cover account headers, fresh verification cookies and JSON decoding; Android retains its protected Go network transport. Real Android sign-in with this update and physical macOS/Linux account checks remain unverified.

See [service verification engineering notes](docs/development/service-verification.md) for the implementation and live-check limits. There is no evidence that password hashing, email-code verification or authenticator verification changed at the service.

## Monthly account allowance in Overview - 2026-10-24

The shared Overview displays service-reported monthly usage, remaining allowance and a renewal date only when a valid future date is available. Account information loads once per signed-in application session and can be refreshed manually. Unknown data is not shown as zero usage; exhausted and unlimited allowances have distinct states. The display uses account quota rather than per-session traffic totals.

All 27 local Node tests passed, including zero remaining bytes, missing and invalid quota values, clamping, unlimited accounts and epoch/ISO reset dates. Electron renderer checks exercise limited, exhausted and unlimited card states. Dark/light desktop and narrow mobile layouts were captured and visually inspected. The updated Windows x64 application was installed at the configured destination and its packaged source verified. The owner confirmed the displayed values, refresh control and appearance using a real account.

[Windows x64/x86/ARM64](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40119141275) and [macOS Intel/Apple Silicon](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40119141240) builds passed for runtime source `520fa94bf95e07f97e5dddb3bebd0c3570476e4b`. Physical macOS and the new Android allowance card remain pending owner/device checks.

## Mandatory verification and progressive delay checks - 2026-10-24

Exit verification is mandatory in the desktop and shared mobile connection paths. Legacy disabled preferences are normalized to enabled. A connection cannot be reported ready until its authenticated exit check succeeds. Regression tests cover saved-setting migration in both cores and the absence of the former preference in the renderer.

The delay probe follows v2rayN's two-request HTTPS sampling method: two GET requests to `https://www.google.com/generate_204`, a 100 ms pause after each response, the smaller measured sample and a five-second timeout. Requests reuse their HTTPS agent/client through the authenticated HTTP/2 tunnel. Credentials are obtained before sampling. Different VPN protocols and network conditions can still produce different measurements. The integration fixture verifies completed HTTPS responses and connection reuse.

All 24 Node tests and Electron renderer/main/tray checks passed. Renderer regression checks cover a successful latency result and an unreachable result while the remaining batch stays in progress. Earlier readings are cleared when a new check starts. The owner confirmed progressive results and the removed preference on the installed Windows version. The Android app picker opens its loading interface before app enumeration; package discovery runs in the background.

[Windows x64/x86/ARM64](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40097043606), [macOS Intel/Apple Silicon](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40097043671) and [Android core/package/lint/emulator checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40097043635) passed for runtime source `8954568155b06967cd9bc909f385fdcb16e6aa76`. The GitHub link uses the same filled icon across platforms. Windows x64 was installed and its packaged source verified at the configured destination. Physical Android checks remain with the owner; physical macOS behavior remains unverified.

All five Android architecture packages were [signed and published on GitHub](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40097480229) using the existing identity and the previously authorized encrypted, single-use transfer. The temporary release asset was removed by the workflow.

[Desktop publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40097633244) completed successfully. Release binaries and asset checksums were verified against GitHub digests. Only the Android ARM64 package was downloaded locally and copied to `E:\Other\FoxVPN`; its SHA-256 is `ae18fc502249be4619638e6442b4a4ea7033447b3fb23d1f87a9093c629c9711`. No temporary signing assets remain in the release.

## Routing editors, shutdown and real delay - 2026-10-24

[Windows x64/x86/ARM64](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091697770), [macOS Intel/Apple Silicon](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091697771) and [desktop publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40092065204) passed. Electron main-process smoke checks now install a renderer closure veto before quitting and still require successful process termination. Quit cleanup has a ten-second upper bound and ends with `app.exit(0)`. The existing native macOS utun creation/disconnect checks also passed. Physical Command+Q behavior remains pending confirmation on a physical Mac.

[Independent macOS icon validation](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091699607) disabled generic fallbacks and confirmed distinct native PNG icons for Calculator and Notes. NSWorkspace icons are rasterized at a small size before transport. Desktop renderer checks cover the visible manual routing editor, selection synchronization and disabled settings cursor.

Latency checks now time a complete HTTPS response through each authenticated tunnel rather than a TCP connection alone. The 23 desktop regression tests passed, including a real TLS/HTTP2 CONNECT integration test for the delay probe, failed-probe cleanup, timeout handling and bounded batch concurrency. Credentials are fetched outside the measured interval; only three probes run concurrently. Checking delay requires sign-in.

The [Android core, package, lint and emulator checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091388767) passed, including manual package entry, native-picker visibility and removal synchronization. [All five architectures were signed and published](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40091849129) using the existing signing identity and the previously authorized encrypted single-use transfer; cleanup removed the transfer asset. Only the signed ARM64 APK was downloaded locally, and delivery to `E:\Other\FoxVPN` was verified against release SHA-256 `d41c6146185f3f5c377dfbc5aaa1251ae0bb19cef8578b24795bfbaabb42970e`. Physical Android validation remains with the owner.

All published platform binaries in v1.0.0 were refreshed and checked against the complete global checksum manifest. The repository description was updated successfully. The final Windows x64 installer was built locally to avoid a redundant download. After the owner approved Windows UAC, installation in `D:\Program Files\FoxVPN` completed successfully; packaged source, native engine architecture and v1.0.0 metadata were verified against the current source.

## Refreshed cross-platform release - 2026-10-22

All published platform binaries in the existing v1.0.0 release were refreshed and their GitHub SHA-256 digests checked against the complete global checksum manifest. [Windows x64, x86 and ARM64 builds](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39789553502), [Intel and Apple Silicon macOS builds](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39789548926), and [desktop publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39790672969) passed. Windows application enumeration uses native PowerShell and bounds optional Store package discovery to avoid blocking the application catalog. Local regression and real Electron smoke checks passed; the current Windows x64 package was installed and its packaged source verified.

The [Android build](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39785930614) passed. All five APK architectures were [signed and published on GitHub Actions](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39790151719) using the existing certificate. The owner explicitly authorized encrypted, single-use transfer of the signing identity; the temporary transfer asset was removed and the runner cleanup completed. Only the final ARM64 APK was downloaded locally for delivery to the owner's test folder; its digest is `280f21bbd57d1f8d0a985606610341d8c15f0c320be489f12fa9ccc0b91f85d3`. Android two-step sign-in remains pending owner testing.

## Two-step sign-in on Windows - 2026-10-22

The updated Windows x64 v1.0.0 application was installed in `D:\Program Files\FoxVPN` and its packaged source was compared with commit `175692e`. The owner confirmed successful sign-in using the account with two-step authentication enabled. All 23 desktop regression tests passed, including authenticator-code verification and retry after an invalid code without issuing OAuth credentials before verification.

The shared mobile implementation includes the corresponding authenticator-code flow, but real-account two-step sign-in on Android has not yet been confirmed. The macOS build passed; Command+Q cleanup, Command+W window closure and reopening still require verification on a physical Mac.

## Android notification refinement - 2026-10-21

The owner confirmed that downloaded/uploaded totals and the session timer in the preceding Android update worked on the physical phone. The notification refinement retains the system header status, location and chronometer, removes repeated status/time from the content, and schedules traffic refreshes every second. The [Android core, lint, package and emulator checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/39617398728) passed. The owner subsequently confirmed the refined expanded/collapsed notification and one-second traffic refresh on the physical phone.

## Android session notifications - 2026-10-21

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


## Windows multiple-account and transport preview

- Thirty-eight Node tests pass. Added coverage verifies legacy-vault migration, account-bound token refresh, rollback after encryption failures, manual account selection, bounded quota failover, network-error handling, concurrent refresh deduplication and logout during refresh.
- Traffic-ledger fixtures verify retained session totals, cumulative device totals and uninterrupted accounting across account handover. These fixtures do not consume real account allowances.
- Four Electron smoke suites pass: renderer isolation/navigation, real main-process encrypted storage and IPC, tray behavior, and Windows account-manager actions with retained traffic.
- The standalone HTTP/3 helper passes a real local QUIC/TLS HTTP/3 CONNECT fixture, including authenticated bidirectional traffic and explicit quota rejection. The public Fastly edge probe completed an HTTP/3 exchange on port 2499; its unauthenticated CONNECT was rejected. This is not evidence of authenticated production VPN forwarding.
- [Windows x64, x86 and ARM64 packaging](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40121750127) and [HTTP/3 helper checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40121750113) passed. The final local x64 package additionally includes token-refresh serialization and cancellation safeguards.
- Live multi-account switching, production HTTP/3 traffic and user acceptance remain pending on Windows. New capabilities remain Windows-only until that validation is complete; Linux development and the macOS/Android rollout follow it.


The owner confirmed the Windows account-management and persistent-traffic preview. Forced HTTP/3 failed on the current network. A diagnostic acquired a fresh proxy pass but could not complete QUIC handshakes to the selected Fastly edge on UDP 2499 or UDP 443, or to an independent public HTTP/3 endpoint on UDP 443. The active default route used Wi-Fi, and Windows Firewall profiles reported outbound traffic allowed. These results suggest a path-specific UDP/QUIC restriction; they do not prove where packets are dropped. Automatic HTTP/2 fallback remains available. No account credentials were written to diagnostic output.


## HTTP/3 reference alignment

HTTP/3 connection setup now follows the MIT-licensed `armanlife/firefox-vpn-client` implementation at revision `13845fafb2a67e2c1ba1e1145537a0a5db16a8d3`: 1200-byte initial QUIC datagrams, explicit per-address UDP sockets, address fallback, Firefox CONNECT headers and complete socket cleanup. The working peer IP is returned to the desktop tunnel controller and pinned across reconnections so the TUN route exclusion remains accurate.

- Forty Node tests pass. [Transport CI](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40156381169) passed Go race checks, vet and Windows cross-compilation. A local HTTP/3 fixture discards client datagrams larger than 1200 bytes and verifies authenticated bidirectional forwarding and quota rejection. A second fixture verifies fallback from an unreachable address and UDP socket closure.
- The GitHub runner completed an HTTP/3 exchange with a public Fastly endpoint on UDP 2499. Its unauthenticated CONNECT was rejected; this does not establish production account forwarding.
- On the owner's Wi-Fi network, the rebuilt Windows x64 helper still timed out during QUIC handshakes to Google UDP 443 and the selected Fastly edge on UDP 2499 and 443, after acquiring a fresh proxy pass. The 1200-byte change did not resolve that network-specific failure. No authenticated production HTTP/3 traffic was therefore verified locally. Automatic HTTP/2 fallback remains supported.
- macOS and Windows builds at revision `82acf9b` passed. Linux runtime checks passed but initial package generation required a maintainer email in package metadata; a public GitHub noreply address is used for that packaging field.


## Four-platform rollout

- Windows x64/x86/ARM64 and native macOS Intel/Apple Silicon packages passed at revision `118660b`, with the reference-aligned HTTP/3 helper. The owner approved Windows account management, manual switching and retained traffic; forced HTTP/3 still times out on the available Wi-Fi network. Testing another network is pending.
- [Linux x64 and ARM64 CI](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40158669599) passed unit tests, real TUN creation/removal, Electron tests with a real Secret Service keyring and AppImage/DEB/RPM packaging. Physical Linux desktop acceptance and distribution-specific integration remain unverified.
- [Android core and package checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40158955983) passed account migration, credential isolation, storage rollback, account-bound access tokens, confirmed-quota-only fallback, persistent traffic, a real local HTTP/3 CONNECT/TLS exchange and automatic HTTP/2 fallback. Production multi-account handover and HTTP/3 on a physical phone require user testing. A further fixture covers stale rejection events after an account switch.
- Current-interface documentation screenshots use sample accounts, reserved documentation IP addresses, usage and delay readings. English and Persian README previews passed six desktop/mobile and light/dark combinations each, including image loading, navigation anchors and overflow checks. Their download matrix is shared with the release notes.
- The social-preview PNG is ready at 1280 by 640 pixels. GitHub still reports `usesCustomOpenGraphImage: false`; uploading it in repository Settings remains a manual action. Topic metadata now includes Linux, HTTP/3 and QUIC.


The final Android build at revision `d5e63bd` passed [core, package, lint and emulator checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40162015943), including stale-account rejection isolation. All five APK architectures were [signed and published on GitHub Actions](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40162645882) with the persistent project signing identity. The encrypted identity transfer was removed after receipt; private signing material was deleted from the runner. The Windows, macOS and Linux packages were [published from verified native build artifacts](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40161863718). The owner confirmed the Android update: adding and manually selecting saved accounts, a stable Automatic connection, and retained traffic after disconnection and restart. Live handover after exhausting an actual allowance and production HTTP/3 on another network remain unverified. The final Windows x64 installation completed at the configured destination and its packaged source and version were verified.


## Android HTTP/3 address-family recovery

A physical-phone report on a second network showed IPv6 `network is unreachable` failures, along with a handshake timeout. This does not establish whether IPv4 was available or UDP was blocked. Android now recovers a missing IPv4 answer through TLS-verified, socket-protected DNS-over-HTTPS when the physical resolver returns only IPv6 or fails. Native IPv6/DNS64 addresses are retained. Literal addresses, custom edge names and explicit DNS overrides do not trigger public bootstrap recovery. A later IPv6 route error no longer hides an earlier handshake timeout.

[Android CI](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40183519570) includes fixtures for IPv4 recovery, NAT64-address preservation, avoiding unnecessary DNS queries, rejecting mismatched/unrelated DNS responses and retaining the original timeout classification. Physical HTTP/3 forwarding with this correction still requires phone testing.


## Windows encrypted HTTP/3 bootstrap

Windows preview `6012900` adds reference-aligned encrypted bootstrap, IPv4-first address selection, a 20-second forced HTTP/3 budget and official REC anycast selection. Explicit overrides remain respected. [Transport CI](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40189395885) passed DNS validation/cancellation tests, QUIC CONNECT/low-MTU fixtures, Go race checks, vet and cross-compilation. The repository Node runner passed 42 tests.

A fresh account pass on the owner's Windows machine successfully established HTTP/3 CONNECT to both Germany and REC on UDP 2499. Nested, certificate-verified HTTPS requests through each tunnel returned HTTP 200. This is authenticated production forwarding, beyond an unauthenticated capability probe. Long-term stability and full system-VPN acceptance remain for the owner; other-platform rollout is held until Windows acceptance. The independent Google QUIC probe timed out, so prior failures cannot be attributed to a universally blocked UDP path or to a single change with certainty.

## Windows Automatic path selection

The owner confirmed that forced HTTP/3 works in the installed Windows update. Automatic now concurrently tests certificate-verified HTTPS through HTTP/2 and HTTP/3, keeps the first healthy path and closes the loser. This chooses lower cold-start response time, not a guaranteed sustained-throughput winner. Manual selection remains available; explicit TCP upstream proxies retain HTTP/2 compatibility.

HTTP/2 retains multiplexed CONNECT streams and a reusable TLS session. Windows now sets TCP_NODELAY, TCP keepalive, a 4 MiB per-stream receive window and an aggregate receive-window floor of 8 MiB without lowering a larger runtime default. The connected peer address is retained for route exclusion. The [Node HTTP/2 API](https://nodejs.org/api/http2.html#http2sessionsetlocalwindowsizewindowsize) documents connection-level flow control.

Forty-five repository Node tests passed, including first-healthy selection, losing-path cleanup, cancellation, dual failure and four simultaneous 512 KiB transfers through a real authenticated HTTP/2/TLS fixture. Renderer smoke tests verified the disconnected placeholder, hidden secure indicator and both connected protocol labels. A fresh-pass live check returned HTTPS 200 in Automatic, forced HTTP/2 and forced HTTP/3; Automatic chose HTTP/2 in that sample. No sustained download-speed claim is made from these small probes. Protocol state is null while disconnected and the UI renders a dash. Other-platform publication remains held for Windows acceptance.

## Delay setup and desktop tray follow-up

The owner confirmed Windows Automatic connectivity and intermittent forced HTTP/3 connectivity, then reported unreachable delay results during a network problem. A verified timing mismatch was corrected: delay checks previously placed QUIC setup and both HTTPS samples inside a single five-second deadline, while forced QUIC setup allows twenty seconds. Transport setup now has a separate bounded budget; HTTPS samples retain their own deadlines. A valid first sample survives a transient failure of the second. Timeouts are distinguished from other unavailable results, stale results are cleared on protocol changes, and the overview label follows the selected protocol instead of always saying HTTP/2.

Forty-eight Node tests passed, including independent setup timing, cleanup, preserving a completed HTTPS sample and desktop tray click routing. Electron renderer/main-process, account and tray checks passed. The tray is rendered and positioned while hidden in one bounds update, captures the click anchor before asynchronous loading, and disables background throttling so a hidden renderer can finish layout. Left click opens the application; right click opens the popup. Android account-action spacing is increased to 16 CSS pixels.

During a fresh-pass live delay check, both HTTP/2 and HTTP/3 failed on Germany and the Netherlands on the current connection. HTTP/2 established its outer transport but its HTTPS check timed out; HTTP/3 failed or timed out during setup. These observations do not establish a general HTTP/3 implementation failure or prove a particular network filter. Physical acceptance after the timing correction remains necessary.

[Android CI](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40205987489) passed core checks, package/lint checks, native architecture and 16 KiB alignment validation, and device integration tests. Only its ARM64 APK was downloaded locally. It was signed with the persistent project identity, verified and copied to the owner's test directory. The packaged CSS matches the current source after line-ending normalization. A 390-pixel-wide renderer check confirmed a 16-pixel gap between account actions. The newer Windows transport-selection mechanism remains outside the Android native core until approval.

## Approved four-platform release

Following owner acceptance, macOS and Linux now share the verified desktop encrypted bootstrap, official REC selection, HTTP/2 flow-control tuning and concurrent HTTPS-based Automatic selection. Android uses protected native sockets and separate candidate sessions for the equivalent Automatic decision. Forced HTTP/3 has a twenty-second setup budget; real-delay setup and individual HTTPS samples have separate deadlines. Selected-session token renewal and account replacement remain account-bound.

Windows, macOS and Linux builds passed and were published through [verified desktop publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40213936236). [Android transport rollout](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40213933851) passed core, package, alignment and device checks; its five architectures were signed and published in [the Android publication](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40214825770). The release Windows x64 installer was checksum-verified, installed and launched locally. Updated English and Persian README previews passed all twelve viewport/theme combinations after adapting the local preview harness to GitHub's current themed-picture and heading markup.

The subsequent Android responsiveness correction separates public catalog and account-allowance reads from the serialized account action queue. Allowance results remain bound to the initiating account. Core regression tests cover account switching while those requests are deliberately blocked and late quota-result isolation. A real Android-interface renderer fixture confirmed immediate switching feedback, duplicate-tap prevention and recovery after completion. A separate emulator Pixel Launcher ANR obscured native test dialogs; only that unrelated launcher's ANR is dismissed by the fixture, without bypassing Fox VPN failures or VPN-consent assertions. Final package/device validation follows this correction.

The final responsiveness build passed [all Android core, package, alignment and native-device checks](https://github.com/erfan-tahvilian/FoxVPN/actions/runs/40220456905). Native account mutation still remains serialized; the background status request retains its original account ID through token retrieval and quota persistence. Connected switching continues to acquire a fresh pass and verify the replacement tunnel; disconnected selection requires no network request.
