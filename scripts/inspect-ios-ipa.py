# SPDX-License-Identifier: GPL-3.0-or-later
"""Portable package inspection. Does not claim to validate Apple signatures or live VPN."""
import argparse,json,plistlib,struct,zipfile
from pathlib import PurePosixPath

def native_binary(data):
    magic,cpu=struct.unpack_from("<II",data)
    if magic!=0xfeedfacf or cpu!=0x100000c:raise ValueError("Not an ARM64 Mach-O executable.")
    commands=struct.unpack_from("<I",data,16)[0];offset=32;platform=None;dependencies=[]
    for _ in range(commands):
        command,size=struct.unpack_from("<II",data,offset)
        if size<8 or offset+size>len(data):raise ValueError("Invalid Mach-O load command.")
        if command==0x32:platform=struct.unpack_from("<I",data,offset+8)[0]
        if command in (0xc,0x80000018,0x8000001f):
            start=offset+struct.unpack_from("<I",data,offset+8)[0]
            dependencies.append(data[start:data.index(b"\0",start,offset+size)].decode())
        offset+=size
    if platform!=2:raise ValueError("Not an iPhoneOS device binary; ARM64 simulator binaries are not supported.")
    return dependencies

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
            dependencies=native_binary(ipa.read(folder+info["CFBundleExecutable"]))
            if info.get("DTPlatformName")!="iphoneos":raise ValueError(role+": not an iPhoneOS device bundle.")
            for dependency in dependencies:
                if dependency.startswith(("/usr/lib/","/System/Library/")):continue
                if dependency.startswith("@rpath/"):
                    relative=dependency.removeprefix("@rpath/")
                    if root+"Frameworks/"+relative in names or folder+"Frameworks/"+relative in names:continue
                raise ValueError(role+": unverified or missing non-system library: "+dependency)
            suffix={"app":"","tunnel":".tunnel","widgets":".widgets"}[role]
            if info["CFBundleIdentifier"]!=bundle+suffix:raise ValueError("Extension bundle identifier mismatch.")
            if role=="tunnel" and info["NSExtension"]["NSExtensionPointIdentifier"]!="com.apple.networkextension.packet-tunnel":raise ValueError("Missing Packet Tunnel extension.")
            profiles[role]=folder+"embedded.mobileprovision" in names
        for file in ["cacert.pem","Assets.car","Web/src/ui/index.html","Web/src/ui/ios-bridge.js","Web/LICENSE"]:
            if root+file not in names:raise ValueError("Missing required resource: "+file)
        return {"version":app["CFBundleShortVersionString"],"minimumOS":app["MinimumOSVersion"],"bundle":bundle,"deviceArchitecture":"arm64","binaryPlatform":"iPhoneOS","nonSystemLibrariesResolved":True,"packetTunnelPackaged":True,"profileFilesPresent":profiles,"appleSignaturesVerified":False,"physicalVPNVerified":False}
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("ipa");args=parser.parse_args()
    report=inspect(args.ipa);print(json.dumps(report,indent=2))
    if not all(report["profileFilesPresent"].values()):print("UNSIGNED SIGNING INPUT: not directly installable. A free Apple Account cannot authorize this Packet Tunnel VPN.")
    else:print("Profiles are present. Presence alone does not prove valid signatures, entitlement authorization, device eligibility or working VPN.")
