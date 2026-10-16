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
for arch in x86_64 universal; do
  apk="release-apks/FoxVPN-1.0.0-Android-$arch.apk"
  "${device[@]}" logcat -c
  # These are signed release packages, not instrumentation or debug builds.
  "${device[@]}" install --no-incremental -r "$apk" | tee "test-results/android-install/install-$arch.txt"
  grep -q '^Success' "test-results/android-install/install-$arch.txt"
  "${device[@]}" shell am start -W -n com.foxvpn.android/.MainActivity | tee "test-results/android-install/start-$arch.txt"
  grep -q 'Status: ok' "test-results/android-install/start-$arch.txt"
  sleep 8
  pid="$("${device[@]}" shell pidof com.foxvpn.android | tr -d '\r\n')"
  [[ "$pid" =~ ^[0-9]+$ ]]
  "${device[@]}" logcat -d --pid="$pid" > "test-results/android-install/logcat-$arch.txt"
  ! grep -Eq 'FATAL EXCEPTION|Fatal signal [0-9]+|UnsatisfiedLinkError' "test-results/android-install/logcat-$arch.txt"
  "${device[@]}" exec-out screencap -p > "test-results/android-install/start-$arch.png"
  "${device[@]}" shell am force-stop com.foxvpn.android
done
