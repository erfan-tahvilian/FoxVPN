# SPDX-License-Identifier: GPL-3.0-or-later
"""Validate the permissions Apple actually granted; a certificate alone is insufficient."""
import re
import argparse, datetime as dt, fnmatch, hashlib, json, os, plistlib, subprocess, uuid
from pathlib import Path

NETWORK = "com.apple.developer.networking.networkextension"
GROUPS = "com.apple.security.application-groups"
SUFFIXES = {"app": "", "tunnel": ".tunnel", "widgets": ".widgets"}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def validate(profiles, method="release-testing", group=None, keychain=None):
    require(method in ("release-testing", "debugging"), "Use registered-device distribution or development profiles.")
    now = dt.datetime.now(dt.timezone.utc)
    teams, prefixes, device_sets, certificate_sets, groups = [], [], [], [], []
    for role, p in profiles.items():
        require(role in SUFFIXES, "Unexpected target profile.")
        expiry = p["ExpirationDate"]
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=dt.timezone.utc)
        require(expiry > now, role + ": provisioning profile expired.")
        require(not p.get("ProvisionsAllDevices"), "Public distribution with an enterprise profile is not supported.")
        devices = set(p.get("ProvisionedDevices", []))
        require(devices, role + ": a registered-device profile is required; App Store profiles cannot install this IPA directly.")
        e = p["Entitlements"]
        require(bool(e.get("get-task-allow", False)) == (method == "debugging"), role + ": profile does not match the export method.")
        if role != "widgets":
            require("packet-tunnel-provider" in e.get(NETWORK, []), role + ": profile does not authorize Packet Tunnel. Free Personal Team signing is insufficient.")
        require(len(p.get("TeamIdentifier", [])) == 1, role + ": missing team identifier.")
        require(len(p.get("ApplicationIdentifierPrefix", [])) == 1, role + ": missing application prefix.")
        teams.append(p["TeamIdentifier"][0]); prefixes.append(p["ApplicationIdentifierPrefix"][0])
        require(e.get("com.apple.developer.team-identifier") == teams[-1], role + ": team entitlement mismatch.")
        uuid.UUID(p["UUID"])
        device_sets.append(devices)
        certificate_sets.append({hashlib.sha1(c).hexdigest().upper() for c in p.get("DeveloperCertificates", [])})
        groups.append(set(e.get(GROUPS, [])))
    require(set(profiles) == set(SUFFIXES), "Provide app, tunnel and widget profiles.")
    require(len(set(teams)) == 1 and len(set(prefixes)) == 1, "All targets must belong to the same team and application prefix.")
    require(set.intersection(*device_sets), "Profiles do not share a registered test device.")
    certificates = set.intersection(*certificate_sets)
    require(certificates, "Profiles do not share an authorized signing certificate.")
    common_groups = set.intersection(*groups)
    group = group or (next(iter(common_groups)) if len(common_groups) == 1 else None)
    require(group and group in common_groups, "All targets must authorize the same explicit App Group; set FOX_APP_GROUP if multiple groups exist.")
    prefix = prefixes[0] + "."
    app_id = profiles["app"]["Entitlements"]["application-identifier"]
    require(app_id.startswith(prefix), "Application identifier prefix mismatch.")
    bundle = app_id[len(prefix):]
    require(bundle and "*" not in bundle, "Explicit bundle identifiers are required.")
    keychain = keychain or bundle + ".shared"
    require(all(re.fullmatch(r"[A-Za-z0-9.-]+", value) for value in (teams[0], prefixes[0], bundle, group, keychain)), "Invalid identifier characters.")
    shared = prefix + keychain
    for role, p in profiles.items():
        e = p["Entitlements"]
        require(e.get("application-identifier") == prefix + bundle + SUFFIXES[role], role + ": bundle identifier must match the app and extension suffix.")
        require(any(fnmatch.fnmatchcase(shared, pattern) for pattern in e.get("keychain-access-groups", [])), role + ": shared Keychain group is not authorized.")
    return {"team": teams[0], "prefix": prefixes[0], "bundle": bundle, "group": group,
            "keychain": keychain, "certificates": sorted(certificates), "method": method,
            "profiles": {role: p["UUID"] for role, p in profiles.items()},
            "eligibleDeviceCount": len(set.intersection(*device_sets)),
            "expires": min(p["ExpirationDate"] for p in profiles.values()).isoformat()}

def decode(path):
    data = subprocess.check_output(["security", "cms", "-D", "-i", str(path)], stderr=subprocess.PIPE)
    return plistlib.loads(data)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--method", default="release-testing")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    profiles = {role: decode(args.directory / (role + ".mobileprovision")) for role in SUFFIXES}
    result = validate(profiles, args.method, os.getenv("FOX_APP_GROUP"), os.getenv("FOX_SHARED_KEYCHAIN"))
    args.output.write_text(json.dumps(result), encoding="utf8")
    print("PASS: Packet Tunnel, App Groups, shared Keychain, certificate, expiry and registered-device compatibility.")

if __name__ == "__main__":
    main()
