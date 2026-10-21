#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")/.."
export FOX_IOS_EXPORT_METHOD="${FOX_IOS_EXPORT_METHOD:-release-testing}"
export FOX_SIGN_DIR="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/foxvpn-sign.XXXXXX")"
chmod 700 "$FOX_SIGN_DIR"
cleanup() {
  python3 - <<'PY'
import json,os,subprocess
from pathlib import Path
root=Path(os.environ['FOX_SIGN_DIR'])
if (root/'installed.json').exists():
 for name in json.loads((root/'installed.json').read_text()):Path(name).unlink(missing_ok=True)
if (root/'search-list.json').exists():
 subprocess.run(['security','list-keychains','-d','user','-s',*json.loads((root/'search-list.json').read_text())],capture_output=True)
subprocess.run(['security','delete-keychain',str(root/'signing.keychain-db')],capture_output=True)
import shutil
shutil.rmtree(root)
PY
}
trap cleanup EXIT
python3 - <<'PY'
import base64,os
from pathlib import Path
root=Path(os.environ['FOX_SIGN_DIR'])
for key,name in [('IOS_CERTIFICATE_P12_BASE64','certificate.p12'),('IOS_PROFILE_APP_BASE64','app.mobileprovision'),('IOS_PROFILE_TUNNEL_BASE64','tunnel.mobileprovision'),('IOS_PROFILE_WIDGETS_BASE64','widgets.mobileprovision')]:
 value=os.environ.get(key,'')
 if not value:raise SystemExit('Required signing secret is missing: '+key)
 (root/name).write_bytes(base64.b64decode(''.join(value.split()),validate=True));(root/name).chmod(0o600)
PY
python3 scripts/ios-profiles.py "$FOX_SIGN_DIR" --method "$FOX_IOS_EXPORT_METHOD" --output "$FOX_SIGN_DIR/config.json"
python3 - <<'PY'
import json,os,secrets,shlex,subprocess,shutil
from pathlib import Path
root=Path(os.environ['FOX_SIGN_DIR']);keychain=str(root/'signing.keychain-db');password=secrets.token_hex(24)
old=shlex.split(subprocess.check_output(['security','list-keychains','-d','user'],text=True));(root/'search-list.json').write_text(json.dumps(old))
def run(*args):subprocess.run(['security',*args],check=True,stdout=subprocess.DEVNULL)
run('create-keychain','-p',password,keychain);run('set-keychain-settings','-lut','21600',keychain);run('unlock-keychain','-p',password,keychain)
run('import',str(root/'certificate.p12'),'-k',keychain,'-P',os.environ.get('IOS_CERTIFICATE_PASSWORD',''),'-T','/usr/bin/codesign','-T','/usr/bin/security')
run('set-key-partition-list','-S','apple-tool:,apple:,codesign:','-s','-k',password,keychain)
run('list-keychains','-d','user','-s',keychain,*old)
config=json.loads((root/'config.json').read_text())
identities=subprocess.check_output(['security','find-identity','-v','-p','codesigning',keychain],text=True)
identity=next((c for c in config['certificates'] if c in identities),None)
if not identity:raise SystemExit('The P12 does not contain the valid private signing identity authorized by the profiles.')
installed=[]
for role,value in config['profiles'].items():
 for folder in [Path.home()/'Library/MobileDevice/Provisioning Profiles',Path.home()/'Library/Developer/Xcode/UserData/Provisioning Profiles']:
  folder.mkdir(parents=True,exist_ok=True);dest=folder/(value+'.mobileprovision');shutil.copyfile(root/(role+'.mobileprovision'),dest);installed.append(str(dest))
(root/'installed.json').write_text(json.dumps(installed))
values={'FOX_APPLE_TEAM_ID':config['team'],'FOX_CONTAINER_BUNDLE':config['bundle'],'FOX_APP_GROUP':config['group'],'FOX_SHARED_KEYCHAIN':config['keychain'],'FOX_SIGNING_IDENTITY':identity,**{'FOX_PROFILE_'+role.upper():value for role,value in config['profiles'].items()}}
(root/'environment.json').write_text(json.dumps(values))
PY
# Launch with structured environment values rather than evaluating profile contents as shell code.
python3 - <<'PY'
import json,os,subprocess,zipfile,shutil,plistlib
from pathlib import Path
root=Path(os.environ['FOX_SIGN_DIR']);env=os.environ.copy();env.update(json.loads((root/'environment.json').read_text()))
subprocess.run(['bash','scripts/sign-ios.sh'],env=env,check=True)
files=list(Path('dist/ios/signed').glob('*.ipa'))
if len(files)!=1:raise SystemExit('Expected one signed IPA export.')
folder=root/'export'
with zipfile.ZipFile(files[0]) as ipa:ipa.extractall(folder)
apps=list((folder/'Payload').glob('*.app'))
if len(apps)!=1:raise SystemExit('Expected one exported application.')
subprocess.run(['python3','scripts/validate-ios.py',str(apps[0])],env=env,check=True)
subprocess.run(['python3','scripts/verify-ios-signing.py',str(apps[0]),str(root/'config.json')],env=env,check=True)
version=json.loads(Path('package.json').read_text())['version'];out=Path('dist/ios/release');out.mkdir(parents=True,exist_ok=True)
shutil.copyfile(files[0],out/f'FoxVPN-{version}-iOS-arm64-signed.ipa')
config=json.loads((root/'config.json').read_text());report={key:config[key] for key in ['bundle','team','group','keychain','method','eligibleDeviceCount','expires']};report.update({'buildNumber':plistlib.loads((apps[0]/'Info.plist').read_bytes())['CFBundleVersion'],'signed':True,'actualEntitlementsVerified':True,'physicalVPNVerified':False})
(out/'iOS-SIGNING-REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
PY
