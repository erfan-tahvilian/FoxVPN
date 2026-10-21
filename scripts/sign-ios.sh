#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Run on macOS after installing the certificate and all three provisioning profiles.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${FOX_APPLE_TEAM_ID:?Set the Apple Developer Team ID}"
: "${FOX_PROFILE_APP:?Set the app provisioning profile UUID}"
: "${FOX_PROFILE_TUNNEL:?Set the tunnel provisioning profile UUID}"
: "${FOX_PROFILE_WIDGETS:?Set the widget provisioning profile UUID}"
method="${FOX_IOS_EXPORT_METHOD:-release-testing}"
case "$method" in release-testing|app-store-connect|debugging) ;; *) echo 'Unsupported distribution method'; exit 1;; esac
identity='Apple Distribution';if [ "$method" = debugging ];then identity='Apple Development';fi
identity="${FOX_SIGNING_IDENTITY:-$identity}"
export FOX_CONTAINER_BUNDLE="${FOX_CONTAINER_BUNDLE:-com.foxvpn.ios}"
export FOX_APP_GROUP="${FOX_APP_GROUP:-group.com.foxvpn.ios}"
export FOX_SHARED_KEYCHAIN="${FOX_SHARED_KEYCHAIN:-com.foxvpn.ios.shared}"
node scripts/prepare-ios.cjs
swift scripts/prepare-ios-icons.swift
xcodegen generate --spec ios/project.yml
mkdir -p dist/ios
xcodebuild -project ios/FoxVPN.xcodeproj -scheme FoxVPN -configuration Release -destination 'generic/platform=iOS' -archivePath "$PWD/dist/ios/FoxVPN-signed.xcarchive" archive CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="$identity" DEVELOPMENT_TEAM="$FOX_APPLE_TEAM_ID" FOX_PROFILE_APP="$FOX_PROFILE_APP" FOX_PROFILE_TUNNEL="$FOX_PROFILE_TUNNEL" FOX_PROFILE_WIDGETS="$FOX_PROFILE_WIDGETS" FOX_CONTAINER_BUNDLE="$FOX_CONTAINER_BUNDLE" FOX_APP_GROUP="$FOX_APP_GROUP" FOX_SHARED_KEYCHAIN="$FOX_SHARED_KEYCHAIN"
python3 - <<'PY'
import os,plistlib,pathlib
bundle=os.environ['FOX_CONTAINER_BUNDLE']
values={'method':os.environ.get('FOX_IOS_EXPORT_METHOD','release-testing'),'teamID':os.environ['FOX_APPLE_TEAM_ID'],'signingStyle':'manual','provisioningProfiles':{bundle:os.environ['FOX_PROFILE_APP'],bundle+'.tunnel':os.environ['FOX_PROFILE_TUNNEL'],bundle+'.widgets':os.environ['FOX_PROFILE_WIDGETS']}}
pathlib.Path('dist/ios/ExportOptions.plist').write_bytes(plistlib.dumps(values))
PY
xcodebuild -exportArchive -archivePath dist/ios/FoxVPN-signed.xcarchive -exportPath dist/ios/signed -exportOptionsPlist dist/ios/ExportOptions.plist
app='dist/ios/FoxVPN-signed.xcarchive/Products/Applications/FoxVPN.app'
codesign --verify --deep --strict "$app"
python3 scripts/validate-ios.py "$app"
echo 'Signed iOS export created. Device eligibility depends on the selected provisioning method.'
