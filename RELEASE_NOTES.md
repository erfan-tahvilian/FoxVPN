# Fox VPN v1.0.2

An independent VPN client for Windows, macOS, Linux and Android, built on Mozilla Firefox VPN infrastructure and Fastly edge servers.

## New in 1.0.2

- **Consistent popup appearance:** Update dialogs, release highlights, account dialogs, app selection and desktop tray menus follow the application palette, including dark mode.
- **Compact archives:** Standard compression settings reduce download overhead while preserving the complete runtime, native VPN components, all supported architectures and portable formats.
- **Clear source access:** Use GitHub's native source archives for the exact release tag. The separately hosted sing-box source, license notices and both SHA256 manifests are retained.

## Download sizes

Compared with the final 1.0.1 maintenance packages, the 21 application downloads together are 2,366,496 bytes (2.26 MiB, 0.109%) smaller. Including the verified duplicate source archive retirement, attached release files total 8,890,358 bytes (8.48 MiB, 0.407%) less. These totals cover one copy of every architecture and format; individual file differences are documented in the [full report](https://github.com/erfan-tahvilian/FoxVPN/blob/main/docs/releases/v1.0.2-size-report.md), including small increases.

All supported installer and portable variants, both SHA256 manifests and the separately hosted sing-box source remain available.

## Included features

- **Account sign-in:** Improved service verification while preserving email and authenticator-code authentication.

- **Multiple Firefox accounts:** Choose the active account or switch automatically after confirmed data-allowance exhaustion. Accounts retain separate allowances.
- **Persistent traffic statistics:** View monthly allowance, last-session transfers and cumulative traffic on this device.
- **Flexible app routing:** Choose which apps use the VPN with selected-app and exclusion modes, a searchable app picker and synchronized manual identifiers.
- **Connection controls:** Check real HTTPS delay, browse saved locations and view IPv4 and IPv6 addresses when available.
- **Network compatibility:** Encrypted endpoint bootstrap, IPv4-first connection attempts and clearer timeout diagnostics.
- **Adaptive transport:** Use HTTP/2 over TLS or HTTP/3 over QUIC. Automatic compares verified HTTPS responses through both protocols and keeps the first healthy path.
- **Android Quick Settings:** Connect from the tile and follow live download, upload and session information in the persistent notification.

Licensed under the GNU General Public License, version 3 or later. Independent dependencies retain their original licenses and notices.

## Downloads

<!-- foxvpn-downloads:start -->

| Platform | Processor | Packages | Best fit |
| :--- | :---: | :--- | :--- |
| **Windows**<br><sub>Windows 10+</sub> | **x64** | [![Windows setup x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-x64-setup.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Windows-x64.exe) &nbsp; [![Windows portable x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-x64-portable.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Windows-x64.zip) | Most Intel / AMD PCs |
|  | **x86** | [![Windows setup x86](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-x86-setup.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Windows-x86.exe) &nbsp; [![Windows portable x86](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-x86-portable.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Windows-x86.zip) | 32-bit Windows PCs |
|  | **ARM64** | [![Windows setup ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-arm64-setup.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Windows-arm64.exe) &nbsp; [![Windows portable ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Windows-arm64-portable.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Windows-arm64.zip) | Windows 11 on ARM |
| **macOS**<br><sub>macOS 13+</sub> | **Apple Silicon** | [![macOS dmg Apple Silicon](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/macOS-arm64-dmg.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-macOS-arm64.dmg) &nbsp; [![macOS zip Apple Silicon](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/macOS-arm64-zip.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-macOS-arm64.zip) | M-series Macs |
|  | **Intel x64** | [![macOS dmg Intel x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/macOS-x64-dmg.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-macOS-x64.dmg) &nbsp; [![macOS zip Intel x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/macOS-x64-zip.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-macOS-x64.zip) | Intel-based Macs |
| **Linux**<br><sub>64-bit desktop</sub> | **x64** | [![Linux appimage x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Linux-x64-appimage.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Linux-x64.AppImage) &nbsp; [![Linux deb x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Linux-x64-deb.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Linux-x64.deb) &nbsp; [![Linux rpm x64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Linux-x64-rpm.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Linux-x64.rpm) | Intel / AMD Linux desktops |
|  | **ARM64** | [![Linux appimage ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Linux-arm64-appimage.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Linux-arm64.AppImage) &nbsp; [![Linux deb ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Linux-arm64-deb.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Linux-arm64.deb) &nbsp; [![Linux rpm ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Linux-arm64-rpm.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Linux-arm64.rpm) | 64-bit ARM Linux desktops |
| **Android**<br><sub>Android 8+</sub> | **ARM64** | [![Android apk ARM64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-arm64-v8a-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Android-arm64-v8a.apk) | Most current Android phones |
|  | **Universal** | [![Android apk Universal](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-universal-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Android-universal.apk) | All supported architectures; larger file |
|  | **ARMv7** | [![Android apk ARMv7](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-armeabi-v7a-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Android-armeabi-v7a.apk) | 32-bit ARM devices |
|  | **x86_64** | [![Android apk x86_64](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-x86_64-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Android-x86_64.apk) | 64-bit Intel devices / emulators |
|  | **x86** | [![Android apk x86](https://raw.githubusercontent.com/erfan-tahvilian/FoxVPN/main/docs/readme/download-badges/Android-x86-apk.svg)](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/FoxVPN-1.0.2-Android-x86.apk) | 32-bit Intel devices / emulators |

<!-- foxvpn-downloads:end -->

`SHA256SUMS.txt` provides download checksums. `sing-box-1.12.0-source.tar.gz` contains the corresponding source for the bundled network engine.

## Corresponding source

[Detailed package-size comparison](https://github.com/erfan-tahvilian/FoxVPN/blob/main/docs/releases/v1.0.2-size-report.md) | [Release asset audit](https://github.com/erfan-tahvilian/FoxVPN/blob/v1.0.2/docs/releases/v1.0.2-asset-audit.md)

[Fox VPN source ZIP](https://github.com/erfan-tahvilian/FoxVPN/archive/refs/tags/v1.0.2.zip) | [Fox VPN source tar.gz](https://github.com/erfan-tahvilian/FoxVPN/archive/refs/tags/v1.0.2.tar.gz) | [Source and build details](https://github.com/erfan-tahvilian/FoxVPN/blob/v1.0.2/SOURCES.md)

The separate sing-box source archive is included with the release assets. See `SHA256SUMS.txt` for all downloadable assets and `SHA256SUMS-Android.txt` for APK verification.

## Installation

**Windows:** Requires Windows 10 or later for x64/x86, or Windows 11 for ARM64. Run the installer, or extract the complete portable ZIP and launch **Fox VPN.exe**. System VPN requires administrator access. Packages are currently unsigned.

**macOS:** Requires macOS 13 or later. Open the DMG and drag **Fox VPN** into **Applications**, or extract the complete app bundle from the ZIP. Packages are ad-hoc signed and are not notarized. If Gatekeeper blocks first launch, verify the download and approve it in **System Settings → Privacy & Security → Open Anyway**.

**Linux:** Native x64 and ARM64 packages are available as AppImage, DEB and RPM. Use a current desktop with a Secret Service keyring, polkit and an authorization agent. System VPN requests polkit authorization; the interface runs without root access. AppImage may require a FUSE compatibility package.

**Android:** Requires Android 8.0 or later and a current Android System WebView. Install the APK, sign in and approve the system VPN request. Add Fox VPN to Quick Settings to connect or disconnect from the panel. The persistent notification provides connection status and a disconnect control.

## Connection support

Sign in with a Firefox account, complete email or authenticator verification when requested, select a location and connect. Account eligibility, regional availability and data allowances depend on the service.

TCP and DNS are supported. General application UDP, including browser QUIC and games, and a persistent kill switch are not supported. HTTP/3 is the transport to the VPN edge and requires working outbound UDP; it does not enable general UDP forwarding. Desktop apps remain in the tray when their window is closed; Android connections remain active in the background.

See the [verification record](https://github.com/erfan-tahvilian/FoxVPN/blob/main/VALIDATION.md) for device test coverage and remaining validation limits.

See the [README](https://github.com/erfan-tahvilian/FoxVPN#readme) for setup, features and licenses.
