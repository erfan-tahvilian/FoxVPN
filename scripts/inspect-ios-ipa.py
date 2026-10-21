# SPDX-License-Identifier: GPL-3.0-or-later
"""Portable package inspection. Does not claim to validate Apple signatures or live VPN."""
import argparse,json,plistlib,struct,zipfile
from pathlib import PurePosixPath

def inspect(path):
    with zipfile.ZipFile(path) as ipa:
        names=ipa.namelist()
        if len(names)!=len(set(names)):raise ValueError("Duplicate ZIP entries.")
        if any(n.startswith("/") or ".." in PurePosixPath(n).parts for n in names):raise ValueError("Unsafe archive path.")
        if ipa.testzip():raise ValueError("IPA ZIP integrity check failed.")
        roots=[n for n in names if n.startswith("Payload/") and n.endswith(".app/Info.plist") and len(PurePosixPath(n).parts)==3]
        if len(roots)!=1:raise ValueError("Expected one device application in Payload.")
        root=roots[0][:-len("Info.plist")];app=plistlib.loads(ipa.read(roots[0]));bundle=app["CFBundleIdentifier"]
        targets={"app":root,"tunnel":root+"PlugIns/FoxVPNTunnel.appex/","widgets":root+"PlugIns/FoxVPNWidgets.appex/"}
        profiles={}
        for role,folder in targets.items():
            info=plistlib.loads(ipa.read(folder+"Info.plist"))
            magic,cpu=struct.unpack("<II",ipa.read(folder+info["CFBundleExecutable"])[:8])
            if magic!=0xfeedfacf or cpu!=0x100000c:raise ValueError(role+": not an ARM64 device executable.")
            suffix={"app":"","tunnel":".tunnel","widgets":".widgets"}[role]
            if info["CFBundleIdentifier"]!=bundle+suffix:raise ValueError("Extension bundle identifier mismatch.")
            if role=="tunnel" and info["NSExtension"]["NSExtensionPointIdentifier"]!="com.apple.networkextension.packet-tunnel":raise ValueError("Missing Packet Tunnel extension.")
            profiles[role]=folder+"embedded.mobileprovision" in names
        for file in ["cacert.pem","Assets.car","Web/src/ui/index.html","Web/src/ui/ios-bridge.js","Web/LICENSE"]:
            if root+file not in names:raise ValueError("Missing required resource: "+file)
        return {"version":app["CFBundleShortVersionString"],"minimumOS":app["MinimumOSVersion"],"bundle":bundle,"deviceArchitecture":"arm64","packetTunnelPackaged":True,"profileFilesPresent":profiles,"appleSignaturesVerified":False,"physicalVPNVerified":False}
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("ipa");args=parser.parse_args()
    report=inspect(args.ipa);print(json.dumps(report,indent=2))
    if not all(report["profileFilesPresent"].values()):print("UNSIGNED SIGNING INPUT: not directly installable. A free Apple Account cannot authorize this Packet Tunnel VPN.")
    else:print("Profiles are present. Presence alone does not prove valid signatures, entitlement authorization, device eligibility or working VPN.")
