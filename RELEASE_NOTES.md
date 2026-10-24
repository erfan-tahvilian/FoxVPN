# Fox VPN v1.0.0

VPN client for Windows, macOS and Android.

Licensed under the GNU General Public License, version 3 or later. Independent dependencies retain their original licenses and notices.

Application-based split tunneling supports both selected-app and exclusion modes, with a searchable app list and synchronized manual identifier entry on Windows, macOS and Android. Private DNS, real-delay HTTPS checks and saved connection preferences are available across the supported platforms. Downloaded locations remain available between sessions. Android includes a Quick Settings tile and background connection controls.

Connection details include separate IPv4 and IPv6 addresses when available, with latency checks directly from Overview. Overview also shows monthly data usage, remaining allowance and the renewal date when reported by the service. Location delay checks display each result as it completes. Connections verify their exit location before becoming active. Desktop tray controls reflect the current connection state. Android improves installation compatibility and provides direct access to the app by holding its Quick Settings tile.

Authenticator-based two-step sign-in is supported alongside email verification. macOS supports closing the window with Command+W and quitting with Command+Q.

## Downloads

<!-- foxvpn-downloads:start -->

| System | Download |
| :--- | :--- |
| **Windows** | [![Windows Setup x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-x64-setup.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-x64.exe) &nbsp; [![Windows Portable x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-x64-portable.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-x64.zip)<br> &nbsp; [![Windows Setup x86](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-x86-setup.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-x86.exe) &nbsp; [![Windows Portable x86](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-x86-portable.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-x86.zip)<br> &nbsp; [![Windows Setup ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-arm64-setup.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-arm64.exe) &nbsp; [![Windows Portable ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-arm64-portable.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Windows-arm64.zip) |
| **macOS** | [![macOS DMG Apple Silicon](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/macOS-arm64-dmg.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-macOS-arm64.dmg) &nbsp; [![macOS ZIP Apple Silicon](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/macOS-arm64-zip.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-macOS-arm64.zip)<br> &nbsp; [![macOS DMG Intel x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/macOS-x64-dmg.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-macOS-x64.dmg) &nbsp; [![macOS ZIP Intel x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/macOS-x64-zip.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-macOS-x64.zip) |
| **Android** | [![Android APK Universal](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-universal-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-universal.apk)<br> &nbsp; [![Android APK ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-arm64-v8a-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-arm64-v8a.apk)<br> &nbsp; [![Android APK ARMv7](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-armeabi-v7a-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-armeabi-v7a.apk)<br> &nbsp; [![Android APK x86_64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-x86_64-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-x86_64.apk)<br> &nbsp; [![Android APK x86](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-x86-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.0/FoxVPN-1.0.0-Android-x86.apk) |

<!-- foxvpn-downloads:end -->

`SHA256SUMS.txt` provides download checksums. `sing-box-1.12.0-source.tar.gz` contains the corresponding source for the bundled network engine.

## Installation

**Windows:** Requires Windows 10 or later for x64/x86, or Windows 11 for ARM64. Run the installer, or extract the complete portable ZIP and launch **Fox VPN.exe**. System VPN requires administrator access. Packages are currently unsigned.

**macOS:** Requires macOS 13 or later. Open the DMG and drag **Fox VPN** into **Applications**, or extract the complete app bundle from the ZIP. Packages are ad-hoc signed and are not notarized. If Gatekeeper blocks first launch, verify the download and approve it in **System Settings → Privacy & Security → Open Anyway**.

## Connection support

**Android:** Requires Android 8.0 or later and a current Android System WebView. Install the APK, sign in and approve the system VPN request. Add Fox VPN to Quick Settings to connect or disconnect from the panel. The persistent notification provides connection status and a disconnect control.

Sign in with a Firefox account, select a location and connect. Account eligibility, regional availability and data allowances depend on the service.

TCP and DNS are supported. General UDP/QUIC and a persistent kill switch are not supported. Desktop apps remain in the tray when their window is closed; Android connections remain active in the background.

See the [verification record](https://github.com/erfan-tahvilian/FoxVPN/blob/main/VALIDATION.md) for device test coverage and remaining validation limits.

See the [README](https://github.com/erfan-tahvilian/FoxVPN#readme) for setup, features and licenses.
