#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/prepare-ios.cjs
swift scripts/prepare-ios-icons.swift
command -v xcodegen >/dev/null || { echo 'Install XcodeGen before building.'; exit 1; }
xcodegen generate --spec ios/project.yml
mkdir -p dist/ios
xcodebuild -project ios/FoxVPN.xcodeproj -scheme FoxVPN -configuration Release -destination 'generic/platform=iOS' -archivePath "$PWD/dist/ios/FoxVPN.xcarchive" archive CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO > dist/ios/archive.log 2>&1 || { tail -n 100 dist/ios/archive.log; exit 1; }
python3 scripts/validate-ios.py dist/ios/FoxVPN.xcarchive/Products/Applications/FoxVPN.app
# Explicitly unsigned: this is a signing input, not an installable distribution.
python3 - <<'PY'
import pathlib,zipfile
root=pathlib.Path('dist/ios/FoxVPN.xcarchive/Products/Applications');app=root/'FoxVPN.app'
with zipfile.ZipFile('dist/ios/FoxVPN-1.0.0-iOS-arm64-unsigned.ipa','w',zipfile.ZIP_DEFLATED) as archive:
 for file in app.rglob('*'):
  if file.is_file():archive.write(file,pathlib.Path('Payload')/file.relative_to(root))
PY
