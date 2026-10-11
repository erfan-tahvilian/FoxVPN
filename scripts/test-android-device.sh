#!/usr/bin/env bash
set -euo pipefail
mkdir -p test-results/android
collect() {
  adb logcat -d > test-results/android/logcat.txt || true
  adb shell run-as com.foxvpn.android.debug cat /sdcard/Android/data/com.foxvpn.android.debug/files/android-overview.png > test-results/android/overview.png || true
}
trap collect EXIT
gradle -p android :app:connectedDebugAndroidTest --stacktrace
