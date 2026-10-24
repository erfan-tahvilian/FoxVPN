# README artwork

The README uses a connection-path motif drawn from Fox VPN's orange fox-and-shield identity. Artwork lives here so documentation assets are not included in application packages.

## Files

| Asset | Purpose |
| --- | --- |
| `badge-{version,windows,macos,android}.svg` | Local version and platform badges, without third-party image requests. |
| `hero-{dark,light}.webp` | Wide brand introduction with the original transparent logo, Firefox infrastructure attribution and four target platform icons. |
| `social-preview.{svg,png}` | Repository social preview artwork, 1280 × 640 pixels. |
| `download-badges/*.svg` | Platform and architecture download badges shared by the README and release notes. |
| `hero-{dark,light}-mobile.webp` | Narrow-screen composition with larger relative type. |
| `download-{windows,macos,android}-{dark,light}.svg` | Direct downloads for Windows x64, macOS Apple Silicon and Android ARM64. |
| `workspace-{dark,light}.webp` | Framed, unmodified overview screenshots. |
| `workspace-{dark,light}-mobile.webp` | Crops of those same desktop screenshots, not Android screenshots. |
| `routing-{dark,light}.svg` | Conceptual explanation of the two split-tunneling modes. |
| `routing-{dark,light}-mobile.svg` | The same routing explanation, stacked vertically. |
| `support-{dark,light}.svg` | Linked Buy Me a Coffee call to action. |
| `signature-{dark,light}.svg` | Closing brand signature. |
| `signature-{dark,light}-mobile.svg` | Compact signature with larger relative type. |

## Visual system

- Brand accent: orange; dark emphasis `#ff8a42`, light emphasis `#b94b0a`.
- Dark background `#0d1117`, surface `#151a22`, primary text `#f5f7fa`.
- Light background `#f6f8fa`, surface `#ffffff`, primary text `#171e29`.
- Typography: Segoe UI with Arial and generic sans-serif fallbacks. SVGs use system fonts; no remote font requests are required.
- Original logo sources: `assets/logo-light.png` for dark artwork and `assets/logo.png` for light artwork. The transparent logo is composited without changing its design.
- Screenshot sources: `docs/screenshots/overview-dark.png`, `overview-light.png` and `locations.png`. These remain unchanged. Screenshots are interface previews, and displayed location latency is illustrative.

## GitHub compatibility

Images use repository-relative paths, with `<picture>` sources for color scheme and a 600 px breakpoint for compact compositions. The fallback is the light, wide variant. Meaningful information, download links and instructions remain available as Markdown text; image descriptions provide equivalent context.

README SVGs contain vector paths, shapes and system-font text. The editable social preview additionally embeds the original transparent PNG logo. They have a viewBox, title and description, and contain no scripts, embedded HTML, external resources or animations. Platform silhouettes adapted from Simple Icons are CC0. WebP artwork contains the logo or screenshots, so its display does not depend on nested SVG image loading. No third-party badge or image service is used.

Changing the README does not require rebuilding the application. Keep release filenames, platform requirements, supported capabilities and license statements synchronized with the project. Do not present the workspace crop as a mobile application screenshot.
