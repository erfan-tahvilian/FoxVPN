# Distribution size and payload preservation

## Packaging policy

The application version remains 1.0.1. This maintenance update changes distribution compression rather than removing runtime files or changing VPN features.

- Windows NSIS: disable differential-aware archive layout. Fox VPN downloads complete installers and does not use differential-update block maps. A normal solid 7z payload can share its compression dictionary across files. Portable ZIPs retain standard Deflate and Windows Explorer compatibility.
- macOS DMG: use the standard UDBZ compressed disk-image format, supported by the minimum macOS version. ZIP structure and framework symlinks remain unchanged.
- Linux AppImage: use xz compression in the existing FUSE2 toolset. DEB and RPM already use xz-family compression.
- Android: retain the existing ABI-specific APKs and universal package. No code shrinking, ABI removal or VPN engine changes are introduced.

Electron, Chromium locales, graphics fallback libraries, trusted certificates, application assets, VPN binaries, drivers and dependency notices remain included. Stronger package compression can increase build and extraction time. The installed application payload and its features are retained.

## Windows controlled experiment

An existing Windows x64 application directory was packaged again without rebuilding or editing its contents:

| Measurement | Previous installer | Solid-archive installer |
| --- | ---: | ---: |
| Bytes | 127,113,169 | 114,424,799 |
| MiB | 121.22 | 109.12 |
| Download reduction | | 9.98% |

The optimized installer was extracted. SHA-256 digests matched for all 82 runtime files, including Electron, the application archive, native VPN components, graphics libraries and locale resources. The original installed payload was approximately 416 MiB; that footprint is unaffected by compression.

`scripts/verify-distribution.cjs` adds native-host round-trip verification to the Windows, macOS and Linux workflows. It extracts the NSIS application payload, mounts the DMG read-only, expands the macOS ZIP and extracts the AppImage. Every original application entry must remain present with matching file content, symlink target and executable permissions. Packaging metadata outside the application tree is excluded from the comparison. CI artifacts include small JSON reports with package sizes and verified entry counts.

The controlled experiment does not substitute for matching-architecture CI checks or physical installer acceptance. Final published package sizes are measured from the verified GitHub assets after publication.
