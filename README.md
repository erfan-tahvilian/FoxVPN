# Fox VPN

A desktop VPN client for Windows and macOS.

![Fox VPN](docs/screenshots/overview-dark.png)

## Download

Download **v1.0.0** from [GitHub Releases](https://github.com/erfan-tahvilian/FoxVPN/releases/tag/v1.0.0).

| Platform | Architecture | Package |
| --- | --- | --- |
| Windows | x64 — Intel and AMD 64-bit | Installer `.exe` or portable `.zip` |
| Windows | x86 — Intel and AMD 32-bit | Installer `.exe` or portable `.zip` |
| Windows | ARM64 — Windows on ARM | Installer `.exe` or portable `.zip` |
| macOS | x64 — Intel | `.dmg` or `.zip` |
| macOS | ARM64 — Apple Silicon | `.dmg` or `.zip` |

Requires Windows 10 or later for x64/x86, Windows 11 for ARM64, or macOS 13 or later. Verify downloads against `SHA256SUMS.txt` included in the release.

## Features

- System VPN and local SOCKS5 proxy mode.
- Firefox account sign-in, email verification and encrypted session storage.
- Global server locations and automatic location selection.
- Split tunneling and configurable DNS.
- HTTP and SOCKS5 upstream proxy support.
- Connection statistics, exit verification and diagnostic logs.
- Light, dark and system appearance.

## Getting started

### Windows

Run the installer, or extract the entire portable ZIP and launch **Fox VPN.exe**. System VPN requires administrator access. Windows packages are currently unsigned.

### macOS

Open the DMG and drag **Fox VPN** into **Applications**, or extract the complete app bundle from the ZIP.

macOS packages are ad-hoc signed and are not notarized. If Gatekeeper blocks first launch, verify the download, then approve it in **System Settings → Privacy & Security → Open Anyway**. System VPN requests administrator authorization when connecting.

### Connect

1. Launch Fox VPN and sign in from **My account**.
2. Complete email verification if requested.
3. Choose a location and press the connect button.

Press the connect button again to disconnect. Closing the window keeps Fox VPN running in the system tray; use **Quit** to exit.

For proxy-only mode, enable it in **Settings** and configure your application to use `socks5h://127.0.0.1:1080`, or your configured port.

## Service and network support

Fox VPN uses Firefox Accounts and Mozilla's VPN service. Account eligibility, regional availability and data allowances are determined by the service. Fox VPN is not affiliated with Mozilla.

The transport supports TCP and DNS. General UDP traffic, including QUIC, is unsupported. Local network traffic and excluded applications bypass the tunnel. A persistent kill switch is not available.

Protocol and platform checks are documented in [VALIDATION.md](VALIDATION.md). Production sign-in and VPN traffic have not been verified with a live user account.

## Development

See [BUILDING.md](BUILDING.md) for prerequisites, build commands and platform-specific instructions, and [CHANGELOG.md](CHANGELOG.md) for release history.

## License

Fox VPN is distributed under the [MIT License](LICENSE). Bundled dependencies retain their own licenses:

- **sing-box** — GPL-3.0-or-later with upstream's additional naming condition. The exact corresponding source is included with release downloads. See [source build instructions](https://sing-box.sagernet.org/installation/build-from-source/).
- **Wintun** — redistributed under its included license. See [Wintun](https://www.wintun.net/).
- **Electron, Chromium, Node.js and npm dependencies** — notices are included in the distribution.
- **flag-icons** — MIT; see [license notice](licenses/flag-icons-MIT.txt).

## Donate

Support Fox VPN development:

- **Tron (TRX) Address:** `TL8WyZLLGu8UraHAT8dCoeMsnzGpX2oAYn`
- **Binance Coin (BNB - BEP20) Address:** `0xeC4F61F21238685cC842bC236D86684e5fc2Bc57`
- **Bitcoin (BTC) Address:** `bc1q2y9m8y02fqgsr4c6533duwmqtmrhadc8k8mkt4`
