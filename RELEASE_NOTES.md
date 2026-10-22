# Fox VPN v1.0.0

VPN client for Windows, macOS, Android and iOS.

Licensed under the GNU General Public License, version 3 or later. Independent dependencies retain their original licenses and notices.

Application-based split tunneling supports both selected-app and exclusion modes, with a searchable app list. Private DNS, location latency checks and saved connection preferences are available across all three platforms. Downloaded locations remain available between sessions. Android includes a Quick Settings tile and background connection controls.

Connection details include separate IPv4 and IPv6 addresses when available, with latency checks directly from Overview. Desktop tray controls reflect the current connection state. Android improves installation compatibility and provides direct access to the app by holding its Quick Settings tile.

Authenticator-based two-step sign-in is supported alongside email verification. macOS supports closing the window with Command+W and quitting with Command+Q.

## Downloads

| Platform | Device | Download |
| --- | --- | --- |
| Windows | Intel/AMD 64-bit | `FoxVPN-1.0.0-Windows-x64.exe` or `.zip` |
| Windows | Intel/AMD 32-bit | `FoxVPN-1.0.0-Windows-x86.exe` or `.zip` |
| Windows | Windows on ARM | `FoxVPN-1.0.0-Windows-arm64.exe` or `.zip` |
| macOS | Intel | `FoxVPN-1.0.0-macOS-x64.dmg` or `.zip` |
| macOS | Apple Silicon | `FoxVPN-1.0.0-macOS-arm64.dmg` or `.zip` |
| Android | Current ARM devices | `FoxVPN-1.0.0-Android-arm64-v8a.apk` |
| Android | Older ARM devices | `FoxVPN-1.0.0-Android-armeabi-v7a.apk` |
| Android | Intel 64-bit | `FoxVPN-1.0.0-Android-x86_64.apk` |
| Android | Intel 32-bit | `FoxVPN-1.0.0-Android-x86.apk` |
| Android | All supported architectures | `FoxVPN-1.0.0-Android-universal.apk` |

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

## iOS and iPadOS

Requires iOS/iPadOS 18 or later. The ARM64 IPA contains the main app, Packet Tunnel extension and system controls. It is supplied unsigned for an authorized signer and is not directly installable. Free Apple Account sideloading does not grant the Network Extension permissions required by this VPN. See [the bilingual installation guide](https://github.com/erfan-tahvilian/FoxVPN/blob/main/IOS_INSTALL.md) for supported signing requirements and installation limitations. Physical iPhone VPN operation remains unverified.
