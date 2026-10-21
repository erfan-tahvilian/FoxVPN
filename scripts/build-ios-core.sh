#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")/../android/core"
go mod download
go install github.com/sagernet/gomobile/cmd/gomobile
go install github.com/sagernet/gomobile/cmd/gobind
export PATH="$(go env GOPATH)/bin:$PATH"
gomobile init
mkdir -p ../../ios/Frameworks
# iOS hardware uses ARM64. The simulator framework also includes Intel support.
gomobile bind -v -target ios,iossimulator -iosversion 18.0 -trimpath -tags with_gvisor,with_clash_api,with_conntrack -ldflags '-X github.com/sagernet/sing-box/constant.Version=1.12.0 -s -w -buildid=' -o ../../ios/Frameworks/FoxCore.xcframework ./apple
