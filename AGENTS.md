# Fox VPN workspace preferences

- Apply requested changes to all supported platforms. After publishing updates, install the latest Windows x64 release on the user’s Windows 11 x64 computer at `D:\Program Files\FoxVPN` and verify it. Never install macOS packages on this Windows computer.
- Keep the application UI in English, with orange dark and light themes and country flags beside locations.
- Write public documentation, release notes and application copy in professional product language. Focus on supported capabilities, installation and information needed by users; omit conversational design history, cosmetic implementation details and internal button/link changes. Keep engineering details in developer documentation.
- Android release APKs use a persistent local signing identity in the ignored `.tools` directory. Preserve that identity for updates. Private signing keys and passwords must not be uploaded without explicit user authorization; build unsigned APKs in CI and sign them locally with `scripts/sign-android.ps1`.
- Copy the verified, signed Android ARM64 release APK to `E:\Other\FoxVPN` for the user's phone testing. Do not install Android packages on the Windows host.
- Use Fox VPN branding and project ownership notices. Remove previous project license references according to the owner’s stated agreement; preserve independent dependency licenses.
- Use the repository owner's configured Git identity. Do not add AI assistant authorship or coauthor trailers to commits.

- Keep the application, installer, source metadata and GitHub release version at `v1.0.0` for all current updates. Do not increment the version unless the user explicitly requests it. Replace the existing v1.0.0 release assets with the latest verified build.
