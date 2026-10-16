#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Erfan Tahvilian
set -euo pipefail
mkdir -p test-results/android-install
# Only an ephemeral CI emulator may be modified by this check.
serial="$(adb devices | awk '/^emulator-[0-9]+[[:space:]]+device$/ {print $1}')"
[[ "$serial" =~ ^emulator-[0-9]+$ ]]
device=(adb -s "$serial")
[[ "$("${device[@]}" shell getprop ro.build.version.sdk | tr -d '\r\n')" == 36 ]]
"${device[@]}" shell getprop > test-results/android-install/device.txt
"${device[@]}" shell getconf PAGE_SIZE > test-results/android-install/page-size.txt
collect() {
  "${device[@]}" logcat -d > test-results/android-install/logcat.txt || true
  "${device[@]}" shell dumpsys package com.foxvpn.android > test-results/android-install/package.txt || true
}
trap collect EXIT
check_install() {
  local label="$1" apk="$2" pid
  "${device[@]}" logcat -c
  "${device[@]}" install --no-incremental -r "$apk" | tee "test-results/android-install/install-$label.txt"
  grep -q '^Success' "test-results/android-install/install-$label.txt"
  "${device[@]}" shell am start -W -n com.foxvpn.android/.MainActivity | tee "test-results/android-install/start-$label.txt"
  grep -q 'Status: ok' "test-results/android-install/start-$label.txt"
  sleep 8
  pid="$("${device[@]}" shell pidof com.foxvpn.android | tr -d '\r\n')"
  [[ "$pid" =~ ^[0-9]+$ ]]
  "${device[@]}" logcat -d --pid="$pid" > "test-results/android-install/logcat-$label.txt"
  ! grep -Eq 'FATAL EXCEPTION|Fatal signal [0-9]+|UnsatisfiedLinkError' "test-results/android-install/logcat-$label.txt"
  "${device[@]}" exec-out screencap -p > "test-results/android-install/start-$label.png"
  "${device[@]}" shell am force-stop com.foxvpn.android
}
for arch in x86_64 universal; do
  apk="release-apks/FoxVPN-1.0.0-Android-$arch.apk"
  # These are signed release packages, not instrumentation or debug builds.
  check_install "$arch" "$apk"
done

# Validate the alternative packaging on an emulator without exposing the project
# signing key. This ephemeral certificate and its APK are never distributed.
tools="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
probe="$(mktemp -d)"
python .github/scripts/make_install_compat.py release-apks/FoxVPN-1.0.0-Android-x86_64.apk "$probe/raw.apk" x86_64 > test-results/android-install/compat-payload.json
"$tools/zipalign" -P 16 -f 4 "$probe/raw.apk" "$probe/aligned.apk"
keytool -genkeypair -keystore "$probe/emulator.p12" -storetype PKCS12 -storepass android -keypass android -alias emulator -keyalg RSA -keysize 3072 -validity 2 -dname 'CN=Fox VPN CI installation probe' -noprompt
"$tools/apksigner" sign --ks "$probe/emulator.p12" --ks-pass pass:android --key-pass pass:android --v4-signing-enabled false --out "$probe/probe.apk" "$probe/aligned.apk"
"$tools/apksigner" verify --min-sdk-version 36 --max-sdk-version 36 "$probe/probe.apk"
"$tools/zipalign" -c -P 16 4 "$probe/probe.apk"
"${device[@]}" uninstall com.foxvpn.android
check_install install-compat "$probe/probe.apk"
