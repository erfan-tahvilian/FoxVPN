# SPDX-License-Identifier: GPL-3.0-or-later
"""Prepare public, non-secret release assets and exact matching source."""
import hashlib,importlib.util,json,os,plistlib,shutil,subprocess,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent;out=root/"dist/ios/release";out.mkdir(parents=True,exist_ok=True)
version=json.loads((root/"package.json").read_text())["version"]
sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()
name=f"FoxVPN-{version}-iOS"
shutil.copyfile(root/f"dist/ios/{name}-arm64-unsigned.ipa",out/f"{name}-arm64-unsigned.ipa")
shutil.copyfile(root/"IOS_INSTALL.md",out/"IOS_INSTALL.md")
subprocess.run(["git","archive","--format=tar.gz","--prefix=FoxVPN-iOS/","--output="+str(out/f"{name}-source.tar.gz"),sha],cwd=root,check=True)
request={"note":"Requested permissions for signing; this file does not grant Apple entitlements.","targets":{}}
for role,file in [("app","App"),("tunnel","Tunnel"),("widgets","Widgets")]:
    request["targets"][role]=plistlib.loads((root/f"ios/Config/{file}.entitlements").read_bytes())
(out/f"{name}-entitlements.json").write_text(json.dumps(request,indent=2)+"\n")
with zipfile.ZipFile(out/f"{name}-signing-tools.zip","w",zipfile.ZIP_DEFLATED) as archive:
    for file in ["IOS_INSTALL.md","ios/BUILDING.md","scripts/inspect-ios-ipa.py","scripts/ios-profiles.py","scripts/verify-ios-signing.py","scripts/ci-sign-ios.sh","scripts/sign-ios.sh"]:
        archive.write(root/file,file)
report={"version":version,"sourceCommit":sha,"buildRun":os.getenv("GITHUB_SERVER_URL","https://github.com")+"/"+os.getenv("GITHUB_REPOSITORY","erfan-tahvilian/FoxVPN")+"/actions/runs/"+os.getenv("GITHUB_RUN_ID","local"),"unsignedIPA":"signing input, not directly installable","minimumOS":"18.0","deviceArchitecture":"arm64","targets":["application","packet-tunnel","controls-and-live-activity"],"simulatorTestsPassed":os.getenv("IOS_SIMULATOR_VERIFIED")=="true","physicalInstallationVerified":False,"physicalVPNVerified":False,"freePersonalTeamVPN":"unsupported: restricted Packet Tunnel and shared-storage entitlements"}
(out/"iOS-BUILD-INFO.json").write_text(json.dumps(report,indent=2)+"\n")
if (out/"iOS-SIGNING-REPORT.json").exists():
    signed=json.loads((out/"iOS-SIGNING-REPORT.json").read_text())
    manifest={"items":[{"assets":[{"kind":"software-package","url":f"https://github.com/{os.getenv('GITHUB_REPOSITORY','erfan-tahvilian/FoxVPN')}/releases/download/v{version}/{name}-arm64-signed.ipa"}],"metadata":{"bundle-identifier":signed["bundle"],"bundle-version":signed.get("buildNumber","1"),"kind":"software","title":"Fox VPN"}}]}
    (out/f"{name}-install.plist").write_bytes(plistlib.dumps(manifest))
    report["signedIPAAvailable"]=True
    (out/"iOS-BUILD-INFO.json").write_text(json.dumps(report,indent=2)+"\n")
lines=[hashlib.sha256(file.read_bytes()).hexdigest()+"  "+file.name for file in sorted(out.iterdir()) if file.is_file() and file.name!="SHA256SUMS-iOS.txt"]
(out/"SHA256SUMS-iOS.txt").write_text("\n".join(lines)+"\n")
print("Prepared iOS IPA, bilingual guide, signing tools, requested entitlements, exact source, build report and checksums.")
