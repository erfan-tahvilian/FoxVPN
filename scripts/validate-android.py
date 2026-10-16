# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Erfan Tahvilian
"""Verify release APK architectures, native alignment and package completeness."""
from pathlib import Path
import hashlib
import json
import struct
import subprocess
import sys
import zipfile

root = Path(sys.argv[1] if len(sys.argv) > 1 else "android/app/build/outputs/apk/release")
abi_info = {"arm64-v8a": (2, 183), "armeabi-v7a": (1, 40), "x86_64": (2, 62), "x86": (1, 3)}
reports = []
for target in [*abi_info, "universal"]:
    files = list(root.glob(f"*{target}*.apk"))
    files = [p for p in files if target != "x86" or "x86_64" not in p.name]
    if len(files) != 1:
        raise RuntimeError(f"Expected one APK for {target}: {files}")
    path = files[0]
    expected = set(abi_info) if target == "universal" else {target}
    with zipfile.ZipFile(path) as apk:
        libraries = [n for n in apk.namelist() if n.startswith("lib/") and n.endswith(".so")]
        actual = {n.split("/")[1] for n in libraries}
        if actual != expected:
            raise RuntimeError(f"{path.name}: ABIs {actual}, expected {expected}")
        if not libraries or "classes.dex" not in apk.namelist() or "AndroidManifest.xml" not in apk.namelist():
            raise RuntimeError(f"{path.name}: incomplete APK")
        if "assets/src/ui/index.html" not in apk.namelist() or "assets/LICENSE-Android.txt" not in apk.namelist():
            raise RuntimeError(f"{path.name}: missing interface or license")
        for notice in ("LICENSE", "COPYRIGHT", "licenses/GPL-3.0.txt"):
            if "assets/" + notice not in apk.namelist():
                raise RuntimeError(f"{path.name}: missing GPL notice: {notice}")
        if b"GPL-3.0-or-later" not in apk.read("assets/COPYRIGHT"):
            raise RuntimeError(f"{path.name}: incorrect application license")
        for name in libraries:
            abi = name.split("/")[1]
            data = apk.read(name)
            kind, machine = abi_info[abi]
            if data[:4] != b"\x7fELF" or data[4] != kind or data[5] != 1 or struct.unpack_from("<H", data, 18)[0] != machine:
                raise RuntimeError(f"{path.name}: wrong ELF architecture: {name}")
            info = apk.getinfo(name)
            if info.compress_type != zipfile.ZIP_DEFLATED:
                raise RuntimeError(f"{path.name}: native library must use installation-time extraction")
            if kind == 2:
                phoff = struct.unpack_from("<Q", data, 32)[0]
                phsize, count = struct.unpack_from("<HH", data, 54)
                for index in range(count):
                    position = phoff + index * phsize
                    if struct.unpack_from("<I", data, position)[0] == 1 and struct.unpack_from("<Q", data, position + 48)[0] < 16384:
                        raise RuntimeError(f"{path.name}: ELF segment does not support 16 KB pages")
    reports.append({"file": path.name, "abis": sorted(expected), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
print(json.dumps(reports, indent=2))
