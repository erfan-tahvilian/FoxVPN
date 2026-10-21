# SPDX-License-Identifier: GPL-3.0-or-later
"""Inspect a built iOS app without claiming device or distribution-signing validation."""
from pathlib import Path
import plistlib,sys,struct,os
app=Path(sys.argv[1]);info=plistlib.loads((app/'Info.plist').read_bytes())
bundle=os.environ.get('FOX_CONTAINER_BUNDLE','com.foxvpn.ios')
assert info.get('DTPlatformName')=='iphoneos'
assert info['CFBundleIdentifier']==bundle
assert info['FoxContainerBundleID']==bundle
assert info['CFBundleShortVersionString']=='1.0.0'
assert float(info['MinimumOSVersion'])>=18
def device_executable(folder,entry):
 binary=folder/entry['CFBundleExecutable']
 with binary.open('rb') as stream: magic,cpu=struct.unpack('<II',stream.read(8))
 assert magic==0xfeedfacf and cpu==0x100000c, str(binary)+' must be an ARM64 device executable'
device_executable(app,info)
assert (app/'Assets.car').is_file()
for extension,suffix,kind in [('FoxVPNTunnel','.tunnel','com.apple.networkextension.packet-tunnel'),('FoxVPNWidgets','.widgets','com.apple.widgetkit-extension')]:
 folder=app/'PlugIns'/(extension+'.appex');entry=plistlib.loads((folder/'Info.plist').read_bytes())
 assert entry.get('DTPlatformName')=='iphoneos'
 assert entry['CFBundleIdentifier']==bundle+suffix
 assert entry['FoxContainerBundleID']==bundle
 assert entry['NSExtension']['NSExtensionPointIdentifier']==kind
 device_executable(folder,entry)
for file in ['src/ui/index.html','src/ui/ios-bridge.js','src/ui/mobile.css','src/ui/ios.css','LICENSE','COPYRIGHT','licenses/GPL-3.0.txt','assets/logo.png','assets/logo-light.png']:
 assert (app/'Web'/file).is_file(),file
assert (app/'cacert.pem').is_file()
html=(app/'Web/src/ui/index.html').read_text()
assert 'ios-bridge.js' in html and 'android-bridge.js' not in html and 'desktop.js' not in html
assert 'GPL-3.0-or-later' in (app/'Web/COPYRIGHT').read_text()
print('PASS: iOS application, tunnel and widget extensions, shared interface, certificates and license assets.')
