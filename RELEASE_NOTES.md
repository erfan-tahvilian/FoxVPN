# Fox VPN v1.0.0

Desktop VPN client for Windows and macOS.

## Downloads

| Platform | Device | Download |
| --- | --- | --- |
| Windows | Intel/AMD 64-bit | `FoxVPN-1.0.0-Windows-x64.exe` or `.zip` |
| Windows | Intel/AMD 32-bit | `FoxVPN-1.0.0-Windows-x86.exe` or `.zip` |
| Windows | Windows on ARM | `FoxVPN-1.0.0-Windows-arm64.exe` or `.zip` |
| macOS | Intel | `FoxVPN-1.0.0-macOS-x64.dmg` or `.zip` |
| macOS | Apple Silicon | `FoxVPN-1.0.0-macOS-arm64.dmg` or `.zip` |

`SHA256SUMS.txt` provides download checksums. `sing-box-1.12.0-source.tar.gz` contains the corresponding source for the bundled network engine.

## Installation

**Windows:** Requires Windows 10 or later for x64/x86, or Windows 11 for ARM64. Run the installer, or extract the complete portable ZIP and launch **Fox VPN.exe**. System VPN requires administrator access. Packages are currently unsigned.

**macOS:** Requires macOS 13 or later. Open the DMG and drag **Fox VPN** into **Applications**, or extract the complete app bundle from the ZIP. Packages are ad-hoc signed and are not notarized. If Gatekeeper blocks first launch, verify the download and approve it in **System Settings → Privacy & Security → Open Anyway**.

## Connection support

Sign in with a Firefox account, select a location and connect. Account eligibility, regional availability and data allowances depend on the service.

TCP and DNS are supported. General UDP/QUIC and a persistent kill switch are not supported. Closing the window keeps the app running in the tray; use **Quit** to exit.

Production sign-in and VPN traffic have not been verified with a live user account. See the [verification record](https://github.com/erfan-tahvilian/FoxVPN/blob/main/VALIDATION.md) for test coverage.

See the [README](https://github.com/erfan-tahvilian/FoxVPN#readme) for setup, features and licenses.
