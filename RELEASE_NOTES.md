First Windows x64 release of **Fox VPN**, an independent open-source desktop implementation based on FoxyVPN.

### Downloads

- `FoxVPN-1.0.0-x64.exe` — Windows installer.
- `FoxVPN-1.0.0-x64.zip` — portable application; extract the entire ZIP and run `Fox VPN.exe`.
- `sing-box-1.12.0-source.tar.gz` — corresponding source of the separately bundled GPL network engine.
- `SHA256SUMS.txt` — checksums for the downloadable files.

### Included

English orange-accented UI, dark/light/system themes, Firefox account sign-in and email verification, live locations, HTTP/2 tunneling, Windows TUN VPN, executable-based split tunneling, private DNS/DoH, HTTP/SOCKS5 upstream chaining, proxy-only mode, exit verification, encrypted session storage, activity log export, statistics and tray controls.

### Requirements and validation

Windows 10/11 x64. System VPN needs Administrator access. The app includes the pinned engine and Wintun driver; binaries are unsigned.

Protocol tests include real local TLS + HTTP/2 CONNECT and tunneled HTTPS, fragmented SOCKS5 handshakes, token lifecycle and encrypted storage. Live Mozilla server discovery is verified, and the pinned Windows engine validates generated configurations. See `VALIDATION.md` in the source for the full verification record.

**Live Firefox account sign-in, production VPN traffic and a full Administrator TUN session have not been verified with a user account.** Service availability and allowances depend on Mozilla. Like upstream, general UDP/QUIC is unsupported; there is no persistent kill switch after exit. Closing the window leaves the app in the tray; use Quit to stop it.

Fox VPN is not affiliated with Mozilla. Fox VPN is MIT licensed; the separate bundled engine and driver retain their own licenses and source notices. See the README for details.
