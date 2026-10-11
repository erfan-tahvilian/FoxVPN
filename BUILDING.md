# Building Fox VPN

## Prerequisites

- Node.js 22 or later.
- Git and network access.
- A compatible native Windows or macOS build host.

Release builds use the npm lockfile. Build output is written to `dist/`.

## Windows

```powershell
npm ci
node scripts/prepare-electron.cjs
npm run engine
npm test
npm run check
npm start
npm run dist
```

Set `FOX_TARGET_ARCH` to `x64`, `ia32` or `arm64` before preparing dependencies and building. Run smoke and engine checks on a compatible host. The CI matrix uses x64 Windows hosts for x64/x86 and a native Windows ARM64 host for ARM64.

Run the development shell as Administrator to test system VPN, or use proxy-only mode.

The engine preparation script downloads sing-box 1.12.0 and verifies its GitHub release SHA-256 digest. Wintun 0.14.1 is verified against a pinned checksum. Packaging validates matching PE architectures.

Windows x86 uses Electron 43.7.9; x64 and ARM64 use Electron 44.7.0. Electron 44 does not provide Windows x86 packages. See [Electron platform support](https://www.electronjs.org/blog/electron-43-0).

## macOS

Build on the matching native Intel or Apple Silicon host:

```sh
npm ci
npm run engine:mac
npm test
npm run check
node scripts/validate-engine.cjs
npm run smoke
npm run dist:mac
node scripts/validate-mac-package.cjs
```

CI uses `macos-15-intel` for x64 and `macos-15` for ARM64. Packages include the matching Mach-O engine and are ad-hoc signed unless release signing credentials are configured.

The app remains unprivileged. A separate engine requests administrator authorization to manage utun routing. Its supervisor stops the engine when the app exits. Split tunneling uses process names.

## Architecture

The Electron main process owns authentication, encrypted storage, network streams and engine lifecycle. The sandboxed renderer has no Node.js access. A restricted preload interface exposes validated actions.

Electron `safeStorage` protects session credentials and proxy passwords using Windows DPAPI or macOS Keychain. The Firefox password is never persisted.

The local SOCKS5 bridge carries authenticated HTTP/2 CONNECT streams. DNS uses the configured tunneled resolver; general UDP is rejected. Local/private traffic, excluded applications and control-plane requests use the direct network. Binding the local proxy to all interfaces exposes an unauthenticated proxy; the default binding is loopback only.

## Verification

`npm test` exercises authentication, token lifecycle, fragmented SOCKS5 handshakes and real local TLS/HTTP2 CONNECT fixtures.

`npm run smoke` verifies renderer isolation, navigation, appearance and application startup using isolated profiles. Reports and screenshots are written to `test-results/`.

Platform CI validates generated engine configurations, packaged resources and binary architectures. macOS CI also exercises privileged utun creation and cleanup without changing the runner's default route.

See [VALIDATION.md](VALIDATION.md) for the verification record and remaining manual checks.
