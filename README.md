<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-light.png">
  <img src="assets/logo.png" width="180" alt="Fox VPN">
</picture>

# Fox VPN

**Your connection. Your control.**

A VPN client for Windows, macOS and Android.

![Version](https://img.shields.io/badge/version-1.0.0-ff741f?style=flat-square)
![Windows](https://img.shields.io/badge/Windows-x64%20%7C%20x86%20%7C%20ARM64-20232a?style=flat-square)
![macOS](https://img.shields.io/badge/macOS-Intel%20%7C%20Apple%20Silicon-20232a?style=flat-square)
![Android](https://img.shields.io/badge/Android-ARM%20%7C%20x86-20232a?style=flat-square)

[Download](#download) · [Features](#features) · [Get started](#getting-started) · [Support development](#donate)

</div>

---

![Fox VPN overview](docs/screenshots/overview-dark.png)

## Download

**Current release: v1.0.0** · [All release assets](https://github.com/erfan-tahvilian/FoxVPN/releases/tag/v1.0.0)

### Windows

| Device | Installer | Portable |
| :--- | :---: | :---: |
| **Intel / AMD 64-bit** · x64 | [Download EXE](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-x64.exe) | [Download ZIP](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-x64.zip) |
| **Intel / AMD 32-bit** · x86 | [Download EXE](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-x86.exe) | [Download ZIP](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-x86.zip) |
| **Windows on ARM** · ARM64 | [Download EXE](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-arm64.exe) | [Download ZIP](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-arm64.zip) |

Requires **Windows 10 or later** for x64/x86, or **Windows 11** for ARM64.

### macOS

| Device | Disk image | Archive |
| :--- | :---: | :---: |
| **Apple Silicon** · ARM64 | [Download DMG](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-macOS-arm64.dmg) | [Download ZIP](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-macOS-arm64.zip) |
| **Intel Mac** · x64 | [Download DMG](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-macOS-x64.dmg) | [Download ZIP](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-macOS-x64.zip) |

Requires **macOS 13 Ventura or later**.

### Android

| Device | Package |
| :--- | :---: |
| **Most current phones and tablets** · ARM64 | [Download APK](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-arm64-v8a.apk) |
| **Older ARM devices** · ARM 32-bit | [Download APK](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-armeabi-v7a.apk) |
| **Intel 64-bit devices and emulators** · x86_64 | [Download APK](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-x86_64.apk) |
| **Intel 32-bit devices and emulators** · x86 | [Download APK](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-x86.apk) |
| **All supported architectures** · Universal | [Download APK](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-universal.apk) |

Requires **Android 8.0 or later** and an up-to-date Android System WebView. Choose **Universal** if you are unsure which architecture your device uses.

Verify downloads against [SHA256SUMS.txt](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/SHA256SUMS.txt).

## Features

| Connection | Privacy | Control |
| :--- | :--- | :--- |
| System VPN | Encrypted session storage | Automatic or manual location selection |
| Local SOCKS5 proxy mode | Split tunneling | Connection statistics |
| HTTP / SOCKS5 upstream support | Configurable DNS | Diagnostic log export |

Firefox account sign-in and email verification are supported. Light, dark and system appearance are available.

On Android, connect from Quick Settings and manage an active connection from the persistent notification.
Split tunneling supports routing only selected apps through the VPN or excluding selected apps from it. Choose installed apps from a searchable list with application icons. On desktop, routing follows application process names; macOS app helpers are included with their parent application.

<details>
<summary><strong>View more screenshots</strong></summary>

![Fox VPN light appearance](docs/screenshots/overview-light.png)

![Fox VPN locations](docs/screenshots/locations.png)

Screenshots are interface test previews. Latency values in the location preview are illustrative.

</details>

## Getting started

### Install

**Windows:** Run the installer, or extract the complete portable ZIP and launch **Fox VPN.exe**. System VPN requires administrator access. Windows packages are currently unsigned.

**macOS:** Open the DMG and drag **Fox VPN** into **Applications**, or extract the complete app bundle from the ZIP. Packages are ad-hoc signed and are not notarized. If Gatekeeper blocks first launch, verify the download and approve it in **System Settings → Privacy & Security → Open Anyway**. System VPN requests administrator authorization when connecting.

**Android:** Download an APK and allow installation from your browser or file manager when prompted. Open Fox VPN and approve the system VPN request on your first connection. Allow notifications to keep connection controls visible.

### Connect

1. Launch Fox VPN and sign in from **My account**.
2. Complete email verification if requested.
3. Choose a location and press the connect button.

Press the connect button again to disconnect. On desktop, closing the window keeps Fox VPN running in the system tray; use **Quit** to exit. On Android, the connection remains active when the app is in the background.

### Quick Settings on Android

After signing in and approving your first VPN connection, edit your Quick Settings panel and add **Fox VPN**. Tap the tile to connect or disconnect; its highlighted state indicates an active connection.

<details>
<summary><strong>Use proxy-only mode</strong></summary>

Enable proxy-only mode in **Settings** and configure your application to use `socks5h://127.0.0.1:1080`, or your configured port. Only applications configured to use the proxy are covered.

</details>

## Network support

Fox VPN uses Firefox Accounts and Mozilla's VPN service. Account eligibility, regional availability and data allowances are determined by the service. Fox VPN is not affiliated with Mozilla.

TCP and DNS are supported. General UDP traffic, including QUIC, is unsupported. Local network traffic and excluded applications bypass the tunnel. A persistent kill switch is not available.

Device test coverage and remaining validation limits are documented in the [verification record](VALIDATION.md).

## Development

| Resource | Description |
| :--- | :--- |
| [Build guide](BUILDING.md) | Prerequisites and platform-specific build instructions |
| [Verification record](VALIDATION.md) | Automated checks and remaining manual tests |
| [Changelog](CHANGELOG.md) | Release history |
| [Project license](LICENSE) | GPL-3.0-or-later · Windows, macOS and Android |

## Third-party licenses

Fox VPN is distributed under the [GNU General Public License, version 3 or later](LICENSE), on Windows, macOS and Android. See the [copyright notice](COPYRIGHT). Bundled dependencies retain their own licenses and notices.

<details>
<summary><strong>Dependency notices</strong></summary>

- **sing-box** — GPL-3.0-or-later with upstream's additional naming condition. The exact corresponding source is included with release downloads. See [source build instructions](https://sing-box.sagernet.org/installation/build-from-source/).
- **Wintun** — redistributed under its included license. See [Wintun](https://www.wintun.net/).
- **Electron, Chromium, Node.js and npm dependencies** — notices are included in the distribution.
- **flag-icons** — MIT; see [license notice](licenses/flag-icons-MIT.txt).

</details>

---

## Donate

Support the continued development of Fox VPN.

**[Support on Buy Me a Coffee ↗](https://buymeacoffee.com/ErfanTahvilian)**

### Cryptocurrency

| Network | Donation address |
| :--- | :--- |
| **Tron (TRX)** | `TL8WyZLLGu8UraHAT8dCoeMsnzGpX2oAYn` |
| **Binance Coin (BNB · BEP20)** | `0xeC4F61F21238685cC842bC236D86684e5fc2Bc57` |
| **Bitcoin (BTC)** | `bc1q2y9m8y02fqgsr4c6533duwmqtmrhadc8k8mkt4` |
