Windows maintenance release of **Fox VPN**, an independent desktop application.

### Downloads

Choose the installer (`.exe`) or portable archive (`.zip`) for your Windows architecture:

- `FoxVPN-1.0.0-x64` — 64-bit Intel/AMD Windows PCs.
- `FoxVPN-1.0.0-x86` — 32-bit Intel/AMD Windows; also runs under WOW64.
- `FoxVPN-1.0.0-arm64` — native Windows on ARM devices.
- `sing-box-1.12.0-source.tar.gz` — corresponding source for the separate GPL engine.
- `SHA256SUMS.txt` — checksums for all downloads.

Portable users must extract the entire ZIP, then run `Fox VPN.exe`.

### Latest changes in v1.0.0

- Simplified account details: removed the subscription-derived entitlement status and manual activation button; automatic activation during connection remains available.

- Black Fox wordmark logo in light mode; white Fox wordmark logo in dark mode. The executable icon retains the supplied white-wordmark version.
- Removed the sidebar “Built for Windows” card.
- Name and ping sorting, ascending and descending; unmeasured/unreachable results stay at the bottom when sorting by ping.
- Individual location ping buttons, alongside the existing all-location check.
- x86, x64 and ARM64 packages with architecture-matched Electron, sing-box and Wintun binaries. x86 uses Electron 43.7.9, the final Electron major series supporting Windows 32-bit; x64/ARM64 use Electron 44.7.0.

### Included

English orange-accented UI, dark/light/system themes, Firefox account sign-in and email verification, live locations, HTTP/2 tunneling, Windows TUN VPN, executable-based split tunneling, private DNS/DoH, HTTP/SOCKS5 upstream chaining, proxy-only mode, exit verification, encrypted session storage, activity log export, statistics and tray controls.

### Requirements and validation

Windows 10/11 for x86/x64; Windows 11 for ARM64. System VPN needs Administrator access. The app includes the pinned engine and Wintun driver; binaries are unsigned.

Protocol tests include real local TLS + HTTP/2 CONNECT and tunneled HTTPS, fragmented SOCKS5 handshakes, token lifecycle and encrypted storage. Live Mozilla server discovery is verified, and the pinned Windows engine validates generated configurations. See `VALIDATION.md` in the source for the full verification record.

**Live Firefox account sign-in, production VPN traffic and a full Administrator TUN session have not been verified with a user account.** Service availability and allowances depend on Mozilla. General UDP/QUIC is unsupported; there is no persistent kill switch after exit. Closing the window leaves the app in the tray; use Quit to stop it.

Fox VPN is not affiliated with Mozilla. Fox VPN is MIT licensed; the separate bundled engine and driver retain their own licenses and source notices. See the README for details.
