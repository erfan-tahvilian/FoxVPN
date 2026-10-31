# Corresponding source

Fox VPN is licensed under GPL-3.0-or-later. Release binaries are accompanied by free source access and build instructions.

## Fox VPN v1.0.2

Use GitHub's native [source ZIP](https://github.com/erfan-tahvilian/FoxVPN/archive/refs/tags/v1.0.2.zip) or [source tar.gz](https://github.com/erfan-tahvilian/FoxVPN/archive/refs/tags/v1.0.2.tar.gz). These archives contain the tracked application, Android native integration, HTTP/3 helper, assets, dependency lockfiles, build scripts, license notices and GitHub Actions for the exact release tag. See [BUILDING.md](BUILDING.md).

The staging workflow compares every exported Git entry against the native GitHub archive of the release commit, including contents, symlinks and executable permissions. The release target must match that commit. A second manually uploaded FoxVPN source archive is therefore unnecessary. Signing credentials are private and are not part of the source; Android builds can be signed with a recipient's own identity.

## sing-box v1.12.0

The separately bundled desktop executable and Android library use sing-box v1.12.0. Its source is retained as [sing-box-1.12.0-source.tar.gz](https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/sing-box-1.12.0-source.tar.gz). The upstream [version tag](https://github.com/SagerNet/sing-box/tree/v1.12.0), [build instructions](https://sing-box.sagernet.org/installation/build-from-source/), Go module requirements and license are included or linked. Android's integration and exact build flags are in this repository's Android workflow. Desktop download scripts pin upstream binary digests; the project does not change the upstream executable.

The archive is approximately 0.66 MiB. It is a separate dependency, not a duplicate of Fox VPN's own source. Retaining a hosted copy provides source access alongside the binaries instead of depending exclusively on an upstream link. GPL section 6(d) permits equivalent source access on another server with clear directions, but the distributor retains responsibility for availability. See the [GPLv3 text](https://www.gnu.org/licenses/gpl.en.html) and [GNU source-access FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#SourceAndBinaryOnDifferentSites).

## Dependencies and rebuilding

`package-lock.json`, `android/core/go.mod`, `android/core/go.sum`, `desktop/h3/go.mod` and `desktop/h3/go.sum` pin dependencies. Use `npm ci` and the documented Go/Gradle workflows; Go retrieves module sources using the recorded versions and validates module checksums. Notices and upstream source locations remain in `licenses/`, the bundled engine provenance file and Android's generated dependency notices. Electron includes its own license and Chromium notices. Wintun includes its independent upstream notice. No license text, certificate store or dependency notice is removed by packaging optimization.

## Historical 1.0.1 maintenance source

The original v1.0.1 tag predates its later maintenance packages. Their exact exported source remains available at [maintenance commit 3dcbb26](https://github.com/erfan-tahvilian/FoxVPN/tree/3dcbb26) and its [native tar.gz archive](https://github.com/erfan-tahvilian/FoxVPN/archive/3dcbb26.tar.gz). All 526 exported entries of the historical custom archive were compared against that commit before the uploaded duplicate was retired. Source history and existing tags are retained.
