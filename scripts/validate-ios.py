# SPDX-License-Identifier: GPL-3.0-or-later
"""Inspect a built iOS app without claiming device or distribution-signing validation."""
from pathlib import Path
import plistlib,sys,struct
app=Path(sys.argv[1]);info=plistlib.loads((app/'Info.plist').read_bytes())
assert info['CFBundleIdentifier']=='com.foxvpn.ios'
assert info['CFBundleShortVersionString']=='1.0.0'
assert float(info['MinimumOSVersion'])>=18
for extension,kind in [('FoxVPNTunnel','com.apple.networkextension.packet-tunnel'),('FoxVPNWidgets','com.apple.widgetkit-extension')]:
 folder=app/'PlugIns'/(extension+'.appex');entry=plistlib.loads((folder/'Info.plist').read_bytes())
 assert entry['NSExtension']['NSExtensionPointIdentifier']==kind
 assert (folder/entry['CFBundleExecutable']).is_file()
for file in ['src/ui/index.html','src/ui/ios-bridge.js','src/ui/mobile.css','src/ui/ios.css','LICENSE','COPYRIGHT','licenses/GPL-3.0.txt','assets/logo.png','assets/logo-light.png']:
 assert (app/'Web'/file).is_file(),file
assert (app/'cacert.pem').is_file()
html=(app/'Web/src/ui/index.html').read_text()
assert 'ios-bridge.js' in html and 'android-bridge.js' not in html and 'desktop.js' not in html
assert 'GPL-3.0-or-later' in (app/'Web/COPYRIGHT').read_text()
print('PASS: iOS application, tunnel and widget extensions, shared interface, certificates and license assets.')
