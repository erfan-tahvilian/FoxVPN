# Fox VPN for iOS and iPadOS

The iOS application targets iOS/iPadOS 18 or later. One ARM64 device application supports compatible iPhone and iPad models; ARM64 and Intel simulator slices are development inputs, not additional phone downloads.

## Components

- `App`: the packaged English interface, WKWebView bridge, account/settings operations and VPN profile management.
- `Tunnel`: a `NEPacketTunnelProvider` that owns the shared Go HTTP/2 bridge and sing-box engine for the full VPN lifetime.
- `Widgets`: a stateful Control Center toggle and a Live Activity for traffic totals and elapsed time.
- `Shared`: app-group status, Keychain session storage, native host adapter and session formatting.
- `../android/core/apple`: Apple platform binding around the existing mobile authentication, discovery, latency, SOCKS and transport implementation. The containing app never starts a packet tunnel directly.

The WebView accepts main-frame requests from packaged resources only. Stored account tokens are never exposed to JavaScript; sign-in input is forwarded to native authentication. App and extension sessions are stored in a shared Keychain access group using this-device-only protection; the app-group status file contains connection telemetry, not account tokens.

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

Live Activities show downloaded/uploaded totals and a system-rendered session timer. They may be dismissed and have an OS-defined lifetime. Updates are best-effort under ActivityKit rules; stale usage is explicitly marked with an instruction to open the app. The packet-tunnel extension publishes telemetry while running; the UI also updates the activity while active. No push service or artificial background keepalive is used. A Live Activity can start from the foreground app or the connection control’s Live Activity intent.

iOS does not expose Android's installed-app selection APIs to consumer VPN apps. Per-app split tunneling requires device management and is not offered in this build. Proxy-only background operation is also not offered. Unsupported controls are removed from the iOS interface and rejected by the native adapter; no setting silently claims to apply.

## Device verification before signed publication

Verify sign-in, first VPN consent, data transfer, IPv4/IPv6 identity, DNS, background/screen-lock operation, Wi-Fi/cellular handovers, Control Center transitions, and Live Activity freshness/termination on an actual iPhone or iPad. Confirm that each nested extension's entitlements and provisioning profile match the installed distribution. An unsigned archive is not a substitute for those checks.

Apple references: [Network Extensions](https://developer.apple.com/documentation/xcode/configuring-network-extensions/), [VPN routing](https://developer.apple.com/documentation/networkextension/routing-your-vpn-network-traffic), [controls](https://developer.apple.com/documentation/widgetkit/controls-collection), [Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities).

## Automatic signing in GitHub Actions

Open **Actions → iOS build → Run workflow**. Use `main`, tag `v1.0.0` and publish enabled. Tags matching the project version also build and publish automatically. Ordinary source pushes build and test without changing Releases. The device Release IPA always includes the app, Packet Tunnel and widget/control extension. Read [IOS_INSTALL.md](../IOS_INSTALL.md) before choosing an installer.

No signing credentials are presently configured by the project owner. Unsigned publication is deliberate and explicitly labelled; a free Personal Team cannot authorize the required Packet Tunnel and shared storage capabilities. A signing administrator may supply existing legitimate credentials for registered devices, without requiring every tester to own a paid account. App Store organization-enrollment rules are separate from registered-device signing; this workflow does not submit to App Store or TestFlight.

In the signing repository's **Settings → Secrets and variables → Actions**, configure:

| Secret | Value |
| --- | --- |
| `IOS_CERTIFICATE_P12_BASE64` | Base64 of the P12 containing the authorized certificate **and private key**. |
| `IOS_CERTIFICATE_PASSWORD` | P12 password, if encrypted. |
| `IOS_PROFILE_APP_BASE64` | Base64 of the app's registered-device provisioning profile. |
| `IOS_PROFILE_TUNNEL_BASE64` | Base64 of the Packet Tunnel extension's profile. |
| `IOS_PROFILE_WIDGETS_BASE64` | Base64 of the widget/control extension's profile. |

For example, on Windows, copy base64 to your clipboard locally with PowerShell, then paste it only into the appropriate repository Secret:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\signing\app.mobileprovision')) | Set-Clipboard
```

Do not paste keys or profiles into chats, issues, commits or release attachments. Registered-device profiles embedded in a signed IPA contain device identifiers; a signing administrator must consider that before publishing their own signed package publicly.

The app profile must use an explicit bundle ID. The tunnel ID must be that ID plus `.tunnel`, and the widget ID that ID plus `.widgets`. All profiles must share an authorized signing certificate, team, application prefix, explicit App Group, shared Keychain permission and at least one registered device. App and tunnel profiles must authorize `com.apple.developer.networking.networkextension` containing `packet-tunnel-provider`. Expired, wildcard-only, App Store-only or incompatible profiles fail preflight.

The workflow derives the team, bundle ID and default shared Keychain identifier from the profiles. It chooses the common App Group when unambiguous. Optional repository Variables `IOS_APP_GROUP` and `IOS_SHARED_KEYCHAIN` select the appropriate group when necessary; the Keychain value omits the application prefix. Xcode rebuilds the signed app with these identifiers, including runtime App Group and Keychain configuration. This avoids blindly changing only CFBundleIdentifier in an already-built IPA.

Choose `release-testing` for registered-device distribution profiles or `debugging` for development profiles. When all certificate/profile secrets are available on a manual/tag run, signing is automatic. **Require signed output** makes missing credentials a failure rather than an unsigned result. Incomplete or invalid credentials also fail; no fallback is presented as a valid signed VPN.

Private inputs are decoded only in a temporary directory on the macOS runner. A temporary keychain imports the identity; cleanup removes its keychain, installed profile copies and decoded files. Private inputs are never selected for artifacts or Releases. Actual exported signatures, embedded profiles, certificate identity, Packet Tunnel, App Group and shared Keychain entitlements are verified before the signed IPA is eligible for publication. The unsigned signing input remains available separately.

Release assets include the unsigned device IPA, bilingual installation guide, requested permissions JSON, exact source archive, signing-tools ZIP, build report and iOS checksums. The tools ZIP is sufficient for portable package inspection; source-building/signing scripts must be used from the complete source tree. When signing succeeds, a separately named signed IPA, a non-secret signing summary and an OTA manifest are added. The OTA manifest is an input to an administrator's HTTPS installation page, not a universally tested one-click GitHub installer.

The publisher verifies uploaded asset digests and updates the release-wide checksum list using GitHub metadata, without downloading other platforms' packages. Re-running updates only iOS assets and the managed iOS section of the release notes. It does not move an existing version tag or change the other platforms' binaries.

## Verification boundaries

Profile policy tests use synthetic fixtures to reject omitted VPN permissions, missing App Groups/Keychain permissions, expired profiles, incompatible devices, wrong bundle IDs and unrelated certificates. The unsigned build, native core and simulator interface are exercised in CI. Because this maintainer has neither Apple signing credentials nor an iPhone, the real credential-import/export branch and device VPN routing remain unverified until an authorized signer and physical tester exercise them. `iOS-BUILD-INFO.json` and `iOS-SIGNING-REPORT.json` distinguish those results explicitly.
