# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify actual signatures and granted permissions, never just requested .entitlements."""
import importlib.util,json,plistlib,subprocess,sys,tempfile,hashlib
from pathlib import Path
spec=importlib.util.spec_from_file_location("profiles",Path(__file__).with_name("ios-profiles.py"))
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
app=Path(sys.argv[1]);config=json.loads(Path(sys.argv[2]).read_text())
folders={"app":app,"tunnel":app/"PlugIns/FoxVPNTunnel.appex","widgets":app/"PlugIns/FoxVPNWidgets.appex"}
profiles={role:p.decode(folder/"embedded.mobileprovision") for role,folder in folders.items()}
verified=p.validate(profiles,config["method"],config["group"],config["keychain"])
p.require(verified==config,"Exported provisioning configuration differs from the validated inputs.")
for role,folder in folders.items():
    subprocess.run(["codesign","--verify","--strict",str(folder)],check=True)
    result=subprocess.run(["codesign","-d","--entitlements",":-",str(folder)],capture_output=True,check=True)
    raw=result.stdout+result.stderr;start=raw.find(b"<?xml");end=raw.find(b"</plist>",start)
    p.require(start>=0 and end>start,"No signed entitlements found.")
    ent=plistlib.loads(raw[start:end+8])
    expected=config["prefix"]+"."+config["bundle"]+p.SUFFIXES[role]
    p.require(ent.get("application-identifier")==expected,role+": signed application identifier mismatch.")
    p.require(ent.get("com.apple.developer.team-identifier")==config["team"],role+": signed team mismatch.")
    p.require(config["group"] in ent.get(p.GROUPS,[]),role+": App Group was stripped.")
    p.require(config["prefix"]+"."+config["keychain"] in ent.get("keychain-access-groups",[]),role+": shared Keychain permission was stripped.")
    p.require(bool(ent.get("get-task-allow",False))==(config["method"]=="debugging"),role+": development signing mismatch.")
    if role!="widgets":p.require("packet-tunnel-provider" in ent.get(p.NETWORK,[]),role+": Packet Tunnel permission was stripped.")
    with tempfile.TemporaryDirectory() as tmp:
        prefix=str(Path(tmp)/"certificate")
        subprocess.run(["codesign","-d","--extract-certificates",prefix,str(folder)],capture_output=True,check=True)
        digest=hashlib.sha1(Path(prefix+"0").read_bytes()).hexdigest().upper()
        p.require(digest in config["certificates"],role+": signature certificate is not authorized by every profile.")
    info=plistlib.loads((folder/"Info.plist").read_bytes())
    p.require(info["CFBundleIdentifier"]==config["bundle"]+p.SUFFIXES[role],role+": installed bundle identifier mismatch.")
    p.require(info["FoxAppGroup"]==config["group"],role+": runtime App Group mismatch.")
    p.require(info["FoxKeychainGroup"]==config["prefix"]+"."+config["keychain"],role+": runtime Keychain group mismatch.")
print("PASS: all three signatures, embedded profiles and actual VPN/shared-storage entitlements.")
