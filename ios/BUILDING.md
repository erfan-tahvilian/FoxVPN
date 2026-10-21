# Fox VPN for iOS and iPadOS

The iOS application targets iOS/iPadOS 18 or later. One ARM64 device application supports compatible iPhone and iPad models; ARM64 and Intel simulator slices are development inputs, not additional phone downloads.

## Components

- `App`: the packaged English interface, WKWebView bridge, account/settings operations and VPN profile management.
- `Tunnel`: a `NEPacketTunnelProvider` that owns the shared Go HTTP/2 bridge and sing-box engine for the full VPN lifetime.
- `Widgets`: a stateful Control Center toggle and a Live Activity for traffic totals and elapsed time.
- `Shared`: app-group status, Keychain session storage, native host adapter and session formatting.
- `../android/core/apple`: Apple platform binding around the existing mobile authentication, discovery, latency, SOCKS and transport implementation. The containing app never starts a packet tunnel directly.

The WebView accepts main-frame requests from packaged resources only. Credentials do not cross the JavaScript bridge. App and extension sessions are stored in a shared Keychain access group using this-device-only protection; the app-group status file contains connection telemetry, not account tokens.

## Build prerequisites

Use macOS, Xcode with an iOS 18-or-newer SDK, XcodeGen, Node.js 22 and Go 1.26.9. The Go module pins the native dependencies. CI builds iOS on a macOS runner; the developer's Windows machine does not require an Apple SDK installation.

```sh
bash scripts/build-ios-core.sh
bash scripts/build-ios.sh
```

This creates `dist/ios/FoxVPN.xcarchive` and `FoxVPN-1.0.0-iOS-arm64-unsigned.ipa`. They are **unsigned signing inputs** and cannot be installed directly on an ordinary iPhone. They are intentionally excluded from the stable download table until a valid signed distribution is available.

The CI workflow compiles the device archive, validates its extensions and assets, runs native core/unit checks and launches the interface in an iPhone simulator. Simulator results do not establish live VPN operation on physical iOS hardware.

## Signing and distribution

Register these explicit identifiers in the Apple Developer account:

| Target | Bundle identifier |
| --- | --- |
| Application | `com.foxvpn.ios` |
| Packet tunnel | `com.foxvpn.ios.tunnel` |
| Controls and Live Activity | `com.foxvpn.ios.widgets` |

Enable `group.com.foxvpn.ios` for all targets and the shared Keychain group `TEAM_PREFIX.com.foxvpn.ios.shared`. Enable the Network Extension packet-tunnel capability for the application and tunnel extension. Install the matching certificate/private key and provisioning profile for each target on the Mac used for signing.

```sh
export FOX_APPLE_TEAM_ID='YOUR_TEAM_ID'
export FOX_PROFILE_APP='APPLICATION_PROFILE_UUID'
export FOX_PROFILE_TUNNEL='TUNNEL_PROFILE_UUID'
export FOX_PROFILE_WIDGETS='WIDGET_PROFILE_UUID'
export FOX_IOS_EXPORT_METHOD='release-testing'
bash scripts/sign-ios.sh
```

Use `release-testing` for registered test devices, `debugging` for a development profile or `app-store-connect` for an App Store Connect/TestFlight export. An App Store Connect export must be uploaded and processed there before users can install through TestFlight or the App Store. Distribution eligibility and App Review requirements remain subject to Apple. Never commit certificates, private keys or provisioning profiles.

## Platform capabilities

The app retains account sign-in and email verification, recommended/manual locations, flags, individual/all-location latency, saved sorting and locations, connection details, DNS/upstream settings, diagnostic export and orange light/dark/system appearance.

Control Center reads the system VPN status, with a short-lived provider snapshot as a fallback. A disconnected or expired snapshot is never treated as indefinitely connected. Users must first configure VPN access in the app.

Live Activities show downloaded/uploaded totals and a system-rendered session timer. They may be dismissed and have an OS-defined lifetime. Updates are best-effort under ActivityKit rules; stale usage is explicitly marked with an instruction to open the app. The packet-tunnel extension publishes telemetry while running; the UI also updates the activity while active. No push service or artificial background keepalive is used. Starting a Live Activity is requested from the foreground app only.

iOS does not expose Android's installed-app selection APIs to consumer VPN apps. Per-app split tunneling requires device management and is not offered in this build. Proxy-only background operation is also not offered. Unsupported controls are removed from the iOS interface and rejected by the native adapter; no setting silently claims to apply.

## Device verification before signed publication

Verify sign-in, first VPN consent, data transfer, IPv4/IPv6 identity, DNS, background/screen-lock operation, Wi-Fi/cellular handovers, Control Center transitions, and Live Activity freshness/termination on an actual iPhone or iPad. Confirm that each nested extension's entitlements and provisioning profile match the installed distribution. An unsigned archive is not a substitute for those checks.

Apple references: [Network Extensions](https://developer.apple.com/documentation/xcode/configuring-network-extensions/), [VPN routing](https://developer.apple.com/documentation/networkextension/routing-your-vpn-network-traffic), [controls](https://developer.apple.com/documentation/widgetkit/controls-collection), [Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities).
