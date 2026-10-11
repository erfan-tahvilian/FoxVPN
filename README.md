# Fox VPN for Windows and macOS

An independent desktop client for Windows and macOS with an English interface, orange accents, light/dark/system appearance, and Fox VPN branding.

Fox VPN is not affiliated with Mozilla, Firefox or Fastly. Access, supported regions, entitlement and bandwidth allowances depend on Mozilla's service. This application does not grant or override a subscription or service entitlement.

![Fox VPN dark appearance](docs/screenshots/overview-dark.png)

![Fox VPN light appearance](docs/screenshots/overview-light.png)

![Locations with offline country flags](docs/screenshots/locations.png)

Screenshots are UI test previews; latency values in the location preview are illustrative.

## Download

Get **v1.0.0** from [Releases](https://github.com/erfan-tahvilian/FoxVPN/releases). The Windows x64 installer and portable ZIP include the network engine and driver. Windows 10/11 x86/x64 or Windows 11 ARM64 is required. The executable requests Administrator access for system VPN mode. Builds are currently unsigned.

## Features

| Capability | Implementation |
| --- | --- |
| Firefox account sign-in | Password derivation, Hawk-authenticated exchange, email verification and renewable offline sessions |
| System-wide VPN | Windows Wintun / macOS utun adapter managed by a separate sing-box process |
| Multiple servers | Live Mozilla Remote Settings locations; excludes quarantined/non-CONNECT endpoints |
| Split tunneling | Exclude Windows executable names such as `chrome.exe` or macOS process names such as `Google Chrome` |
| Private DNS | Tunnel DNS through the local SOCKS5 bridge |
| DNS over HTTPS | Automatic, Cloudflare, Google and Quad9; custom DNS over tunneled TCP |
| Upstream chaining | HTTP CONNECT or SOCKS5, with optional encrypted credentials |
| Proxy-only mode | Local SOCKS5 proxy without creating a TUN adapter |
| Dark / light / system | Orange-accented themes throughout all five screens |
| Exit verification | Cloudflare trace through the tunnel; selected country must match before connection |
| In-app logs | Bounded, sanitized diagnostics, filter, export and clear |
| Advanced options | Custom edge with original TLS identity, SOCKS port/bind address |

## First connection

1. Install Fox VPN and launch it.
2. Open **My account** and sign in with a Firefox account. If requested, enter the email verification code.
3. Choose **Recommended location** or a country/city in **Locations**.
4. Click the orange power button. Fox VPN obtains a proxy pass, establishes an authenticated HTTP/2 tunnel, verifies the exit (enabled by default), then creates the platform’s VPN adapter.
5. Click again to disconnect. Use the tray menu to disconnect or quit; closing the window keeps the application running in the tray.

For proxy-only mode, turn it on in Settings and configure your client to use `socks5h://127.0.0.1:1080` (or your chosen port). This mode protects only applications configured to use that proxy.

## Scope and limitations

- The HTTP/2 service supports **TCP and DNS**, not arbitrary UDP, QUIC, games or voice traffic. System VPN rejects general UDP rather than silently routing it directly.
- Disconnecting restores normal system routing. This release does **not** provide a persistent kill switch after the app exits or a process crashes.
- Local/private network traffic, Fox VPN control traffic and excluded applications use the direct network. Firefox Accounts, Guardian and server discovery are control-plane requests made outside the tunnel.
- Selecting **DNS off** in system VPN uses the system resolver. Custom DNS uses TCP through the tunnel and overrides DoH. Proxy-only DNS queries are relayed by the SOCKS UDP DNS bridge; general UDP is refused.
- Choosing all interfaces exposes an unauthenticated SOCKS proxy. The default is loopback only.
- An unsupported interactive service challenge, changed upstream APIs or an exhausted allowance can prevent connection. Errors are reported rather than represented as a successful VPN connection.
- End-to-end login and live VPN traffic require an actual Firefox account and an eligible network/service region. Automated tests use protocol fixtures and do not prove that Mozilla will accept every account.

## Build from source

On Windows x64 with Node.js 22 or newer, Git and network access:

```powershell
npm ci
node scripts/prepare-electron.cjs
npm run engine
npm test
npm run check
npm start
npm run dist
```

Run the development shell as Administrator to test TUN mode, or enable proxy-only mode. The engine preparation script downloads pinned sing-box **1.12.0**, checks its GitHub release SHA-256 digest, and downloads Wintun **0.14.1** with a pinned checksum. Release builds use the lockfile. Output is in `dist/`.

Run `npm run smoke` to verify navigation, theme switching, flags, renderer isolation, real startup and Windows encrypted storage. It saves screenshots and status reports in `test-results/` using isolated profiles.

Architecture: Electron main process owns authentication, encrypted storage, network streams and the platform engine. The sandboxed renderer has no Node.js access. A narrow preload API validates IPC senders and exposes named actions. Credentials and proxy passwords are protected with Electron `safeStorage` (Windows DPAPI / macOS Keychain); the Firefox password itself is never persisted. The vault is stored under the user's application data directory.

## Third-party licenses

- Fox VPN code: MIT, see [LICENSE](LICENSE).
- Separately bundled sing-box executable: GPL-3.0-or-later with upstream's additional naming condition. License, exact version, source location and binary hashes are included in the engine directory. Corresponding source for the exact bundled version is provided alongside release assets. Build instructions: [sing-box source build](https://sing-box.sagernet.org/installation/build-from-source/).
- Wintun redistributable: supplied under its included `LICENSE-wintun.txt`. [Official source and download](https://www.wintun.net/).
- Electron / Chromium / Node.js and npm dependencies retain their included notices.
- Country flags: flag-icons 7.5.0 (MIT), bundled locally with attribution in `licenses/flag-icons-MIT.txt`.

See [CHANGELOG.md](CHANGELOG.md) and [VALIDATION.md](VALIDATION.md).

Location latency uses a bounded TCP connection check to every endpoint from the current network path (including DNS lookup), with results in milliseconds. It does not measure ICMP round-trip time or throughput. Service-recommended/anycast entries are hidden from the country list; the automatic card remains available and a connected automatic session displays the verified exit country.

## Windows architectures

| Architecture | Hardware | Download names | Electron |
| --- | --- | --- | --- |
| x64 | 64-bit Intel/AMD | `FoxVPN-1.0.0-Windows-x64.exe` / `.zip` | 44.7.0 |
| x86 | 32-bit Intel/AMD, WOW64 | `FoxVPN-1.0.0-Windows-x86.exe` / `.zip` | 43.7.9 |
| ARM64 | Windows on ARM | `FoxVPN-1.0.0-Windows-arm64.exe` / `.zip` | 44.7.0 |

Electron 44 removed Windows x86 builds. The x86 package uses the last supported 43 series, as documented by [Electron](https://www.electronjs.org/blog/electron-43-0). These are separate native Windows packages, each with a matching sing-box executable and Wintun DLL; architecture is verified through PE headers before and after packaging. ARM32 is not supported by Electron on Windows.

To build a target, set `FOX_TARGET_ARCH` to `x64`, `ia32` (x86), or `arm64`, then run `node scripts/prepare-electron.cjs`, `npm run engine`, `npm run smoke`, and `npm run dist`. Run smoke/config checks on a compatible host (ARM64 needs Windows on ARM). The CI matrix uses x64 Windows hosts for x64/x86 and a native ARM64 Windows host for ARM64.

Locations can be sorted by name or TCP latency in either direction. Unknown and unreachable latency results stay last. The small waveform button on each row checks only that endpoint without selecting it or changing an active VPN session.

Account refresh displays your account ID and data allowance. Connection setup requests service activation automatically when required; eligibility and allowance remain controlled by the service.

## macOS packages

Requires macOS 13 Ventura or later (Electron 44). Choose `FoxVPN-1.0.0-macOS-x64.dmg` for Intel Macs or `FoxVPN-1.0.0-macOS-arm64.dmg` for Apple Silicon (M series). A matching ZIP containing the complete app bundle is also provided. Separate native packages include the matching Mach-O sing-box engine; Rosetta is not required for Apple Silicon.

Open the DMG and drag **Fox VPN** into **Applications**, or extract the ZIP and move the whole app bundle there. The macOS package is ad-hoc signed, without an Apple Developer ID certificate or notarization. Gatekeeper may block first launch; use macOS **System Settings → Privacy & Security → Open Anyway** only after verifying the download and SHA256 checksum. No system security setting needs to be disabled. Developer ID signing and notarization can be enabled when release credentials are available.

System VPN requests administrator authorization through macOS when connecting. The desktop app remains unprivileged; only its separate engine runs as root. Disconnecting stops the engine and restores routing. A supervisor also stops it when the desktop process exits. Proxy-only mode needs no elevation. The engine uses macOS utun, so Wintun is not bundled. Split tunneling accepts actual executable/process names (for example `Google Chrome` and `Steam`, not full `.app` paths). Keychain protects local session encryption keys; macOS may request permission to access them, especially after unsigned/ad-hoc app updates.

Build on the matching native Mac with Node.js 22 or newer: `npm ci`, `npm run engine:mac`, `npm test`, `npm run check`, `node scripts/validate-engine.cjs`, `npm run smoke`, `npm run dist:mac`, `node scripts/validate-mac-package.cjs`. CI uses `macos-15-intel` for x64 and `macos-15` for arm64. It also exercises real privileged utun creation and cleanup without changing the runner’s default route. Production Firefox sign-in and full service-backed VPN traffic are not verified by this test.

The **Manage account** button opens [Firefox account settings](https://accounts.firefox.com/settings) on every platform.
