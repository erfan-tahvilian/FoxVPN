// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestUpdateVersionsAndMatchingAndroidPackages(t *testing.T) {
	for _, pair := range [][2]string{{"1.0.10", "1.0.9"}, {"2.0.0", "1.99.99"}} {
		if yes, err := newerVersion(pair[0], pair[1]); err != nil || !yes {
			t.Fatal("Numeric update comparison failed")
		}
	}
	if yes, _ := newerVersion("1.0.1", "1.0.1"); yes {
		t.Fatal("Equal version offered")
	}
	if _, err := newerVersion("1.0.2-beta", "1.0.1"); err == nil {
		t.Fatal("Prerelease accepted")
	}
	for _, arch := range []string{"arm64-v8a", "armeabi-v7a", "x86_64", "x86", "universal"} {
		name := "FoxVPN-1.0.2-Android-" + arch + ".apk"
		asset := object{"name": name, "browser_download_url": "https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.2/" + name, "state": "uploaded", "size": 1024, "digest": "sha256:" + strings.Repeat("ab", 32)}
		release := object{"tag_name": "v1.0.2", "draft": false, "prerelease": false, "assets": []object{asset}}
		raw, _ := json.Marshal(release)
		result, err := selectAndroidRelease(raw, "1.0.1", arch)
		if err != nil || !yes(result, "available") || str(result, "name") != name {
			t.Fatal("Wrong Android update", err)
		}
		asset["browser_download_url"] = "https://example.com/update.apk"
		raw, _ = json.Marshal(release)
		if _, err = selectAndroidRelease(raw, "1.0.1", arch); err == nil {
			t.Fatal("Untrusted download accepted")
		}
	}
}
