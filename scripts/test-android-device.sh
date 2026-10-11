#!/usr/bin/env bash
set -euo pipefail
mkdir -p test-results/android
collect() {
  adb logcat -d > test-results/android/logcat.txt || true
  adb exec-out run-as com.foxvpn.android.debug cat files/android-overview.png > test-results/android/overview.png || true
  adb exec-out run-as com.foxvpn.android.debug cat files/vpn-consent.xml > test-results/android/vpn-consent.xml || true
  adb exec-out run-as com.foxvpn.android.debug cat files/vpn-consent.png > test-results/android/vpn-consent.png || true
}
trap collect EXIT
android/gradlew -p android :app:assembleDebugAndroidTest --stacktrace
adb install -r android/app/build/outputs/apk/debug/app-x86_64-debug.apk
adb install -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w com.foxvpn.android.debug.test/androidx.test.runner.AndroidJUnitRunner | tee test-results/android/instrumentation.txt
grep -Eq 'OK \([0-9]+ tests?\)' test-results/android/instrumentation.txt
! grep -Eq 'FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED' test-results/android/instrumentation.txt
