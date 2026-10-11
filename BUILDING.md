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

## Android

Build on Linux with Go 1.26.9, JDK 17, Node.js and the Android SDK. The project uses Gradle 8.11.1, Android Gradle Plugin 8.10.1, SDK 36, Build Tools 35.0.0 and NDK 28.0.13004108. Minimum Android version is API 26.

Install the required SDK components:

```sh
sdkmanager 'platforms;android-36' 'build-tools;35.0.0' 'ndk;28.0.13004108'
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/28.0.13004108"
```

Prepare the combined native library:

```sh
cd android/core
go mod download
go test -race -timeout 90s ./mobile
go install github.com/sagernet/gomobile/cmd/gomobile@v0.1.7
go install github.com/sagernet/gomobile/cmd/gobind@v0.1.7
export PATH="$(go env GOPATH)/bin:$PATH"
gomobile init
mkdir -p ../app/libs
gomobile bind -target android -androidapi 26 -javapkg=com.foxvpn.nativebridge -libname=foxvpn -trimpath -tags with_gvisor,with_clash_api,with_conntrack -ldflags '-X github.com/sagernet/sing-box/constant.Version=1.12.0 -s -w -buildid= -extldflags=-Wl,-z,max-page-size=16384' -o ../app/libs/foxvpn.aar ./mobile github.com/sagernet/sing-box/experimental/libbox
cd ../..
node scripts/prepare-android.cjs
node scripts/android-notices.cjs
android/gradlew -p android :app:assembleRelease :app:lintRelease
python scripts/validate-android.py
```

The build produces unsigned release APKs for arm64-v8a, armeabi-v7a, x86_64, x86 and all four ABIs in a universal APK. Sign release APKs with a persistent project signing key. Never distribute unsigned APKs or substitute the debug certificate.

The project release workflow builds and tests APKs in CI, then signs them locally on the maintainer's Windows computer using `scripts/sign-android.ps1 -RunId <successful-run-id>`. The private key and its DPAPI-protected password remain in the ignored local tools directory. The public certificate SHA-256 fingerprint is recorded in `android/signing-certificate.sha256`.

Android uses a permission-protected `VpnService`, the same HTML interface with a mobile layout, and one native Go library containing the authentication/HTTP2 bridge and sing-box libbox. The WebView loads packaged HTTPS assets only; it cannot browse external pages or read local files. Named actions cross the native bridge. Android Keystore protects local session encryption keys.

Split tunneling excludes Android package names through the platform VPN builder. Quick Settings and the foreground notification read the core connection state. VPN consent is required before the first system connection. The debug-only integration service creates a real TUN interface without changing the default route; it is excluded from release APKs.

Android application code is licensed under [GPL-3.0-or-later](android/LICENSE). The native library's dependency notices and exact module versions are included in APK assets; Go dependencies are pinned in `android/core/go.mod` and `go.sum`.
