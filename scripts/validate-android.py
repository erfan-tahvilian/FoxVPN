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
    with zipfile.ZipFile(path) as apk, path.open("rb") as raw:
        libraries = [n for n in apk.namelist() if n.startswith("lib/") and n.endswith(".so")]
        actual = {n.split("/")[1] for n in libraries}
        if actual != expected:
            raise RuntimeError(f"{path.name}: ABIs {actual}, expected {expected}")
        if not libraries or "classes.dex" not in apk.namelist() or "AndroidManifest.xml" not in apk.namelist():
            raise RuntimeError(f"{path.name}: incomplete APK")
        if "assets/src/ui/index.html" not in apk.namelist() or "assets/LICENSE-Android.txt" not in apk.namelist():
            raise RuntimeError(f"{path.name}: missing interface or license")
        for name in libraries:
            abi = name.split("/")[1]
            data = apk.read(name)
            kind, machine = abi_info[abi]
            if data[:4] != b"\x7fELF" or data[4] != kind or data[5] != 1 or struct.unpack_from("<H", data, 18)[0] != machine:
                raise RuntimeError(f"{path.name}: wrong ELF architecture: {name}")
            info = apk.getinfo(name)
            raw.seek(info.header_offset)
            local = raw.read(30)
            filename_length, extra_length = struct.unpack_from("<HH", local, 26)
            offset = info.header_offset + 30 + filename_length + extra_length
            if info.compress_type != zipfile.ZIP_STORED or offset % 16384:
                raise RuntimeError(f"{path.name}: native library is not aligned for 16 KB pages")
            if kind == 2:
                phoff = struct.unpack_from("<Q", data, 32)[0]
                phsize, count = struct.unpack_from("<HH", data, 54)
                for index in range(count):
                    position = phoff + index * phsize
                    if struct.unpack_from("<I", data, position)[0] == 1 and struct.unpack_from("<Q", data, position + 48)[0] < 16384:
                        raise RuntimeError(f"{path.name}: ELF segment does not support 16 KB pages")
    reports.append({"file": path.name, "abis": sorted(expected), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
print(json.dumps(reports, indent=2))
