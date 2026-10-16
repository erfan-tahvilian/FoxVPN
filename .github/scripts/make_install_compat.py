# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Erfan Tahvilian
"""Create an unsigned installation experiment from a verified 64-bit APK.

Only extractNativeLibs and native-library ZIP compression change. Callers must
zipalign and sign the result with the existing project identity. This tool does
not publish packages or change the production build's packaging defaults.
"""
import copy
import hashlib
import json
from pathlib import Path
import struct
import sys
import zipfile


def extraction_manifest(original):
    data = bytearray(original)
    kind, header, total = struct.unpack_from("<HHI", data)
    if kind != 3 or header != 8 or total != len(data):
        raise ValueError("Expected a complete binary Android manifest")
    strings = []
    changed = []
    pos = header
    while pos < total:
        kind, size, length = struct.unpack_from("<HHI", data, pos)
        if size < 8 or length < size or pos + length > total:
            raise ValueError("Malformed manifest chunk")
        if kind == 1:
            count, _, flags, start, _ = struct.unpack_from("<IIIII", data, pos + 8)
            def read_length(index, utf8):
                value = data[index] if utf8 else struct.unpack_from("<H", data, index)[0]
                step, mask = (1, 128) if utf8 else (2, 32768)
                index += step
                if value & mask:
                    other = data[index] if utf8 else struct.unpack_from("<H", data, index)[0]
                    value = ((value & (mask - 1)) << (8 if utf8 else 16)) | other
                    index += step
                return value, index
            for index in range(count):
                offset = struct.unpack_from("<I", data, pos + size + index * 4)[0]
                cursor = pos + start + offset
                utf8 = bool(flags & 256)
                length_chars, cursor = read_length(cursor, utf8)
                if utf8:
                    byte_count, cursor = read_length(cursor, True)
                    value = data[cursor:cursor + byte_count].decode("utf-8")
                else:
                    value = data[cursor:cursor + length_chars * 2].decode("utf-16le")
                strings.append(value)
        elif kind == 0x102:
            extension = pos + size
            name = struct.unpack_from("<I", data, extension + 4)[0]
            if strings[name] == "application":
                start, stride, count = struct.unpack_from("<HHH", data, extension + 8)
                if stride != 20:
                    raise ValueError("Unexpected manifest attribute format")
                for index in range(count):
                    attr = extension + start + index * stride
                    namespace, name = struct.unpack_from("<II", data, attr)
                    if strings[name] == "extractNativeLibs" and strings[namespace] == "http://schemas.android.com/apk/res/android":
                        if data[attr + 15] != 0x12 or struct.unpack_from("<I", data, attr + 16)[0] != 0:
                            raise ValueError("Expected extractNativeLibs=false")
                        struct.pack_into("<I", data, attr + 16, 0xFFFFFFFF)
                        changed.append(attr + 16)
        pos += length
    if pos != total or len(changed) != 1:
        raise ValueError("Expected exactly one extractNativeLibs attribute")
    return bytes(data), changed[0]


def create(source, destination, abi="arm64-v8a"):
    if abi not in ("arm64-v8a", "x86_64"):
        raise ValueError("Only ARM64 device and x86_64 emulator experiments are supported")
    if source.resolve() == destination.resolve():
        raise ValueError("Source APK must be preserved")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as src:
        names = src.namelist()
        if len(names) != len(set(names)) or src.testzip() is not None:
            raise ValueError("Source APK integrity check failed")
        libraries = [name for name in names if name.startswith("lib/") and name.endswith(".so")]
        if not libraries or {name.split('/')[1] for name in libraries} != {abi}:
            raise ValueError("Expected only the requested ABI: " + abi)
        original_manifest = src.read("AndroidManifest.xml")
        manifest, offset = extraction_manifest(original_manifest)
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as dst:
            for entry in src.infolist():
                info = copy.copy(entry)
                info.extra = b""  # zipalign regenerates required stored-entry padding.
                payload = manifest if entry.filename == "AndroidManifest.xml" else src.read(entry)
                if entry.filename in libraries:
                    info.compress_type = zipfile.ZIP_DEFLATED
                dst.writestr(info, payload)
        with zipfile.ZipFile(destination) as dst:
            if dst.namelist() != names or dst.testzip() is not None:
                raise ValueError("Experiment APK integrity check failed")
            for name in names:
                expected = manifest if name == "AndroidManifest.xml" else src.read(name)
                if dst.read(name) != expected:
                    raise ValueError("Unexpected payload change: " + name)
            if any(dst.getinfo(name).compress_type != zipfile.ZIP_DEFLATED for name in libraries):
                raise ValueError("Native libraries must be extracted at installation")
        return {"source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "unsigned_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                "manifest_boolean_offset": offset,
                "native_libraries": libraries,
                "unchanged_payload_entries": len(names) - 1,
                "purpose": "Unpublished installation compatibility experiment; requires target-device confirmation"}


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        raise SystemExit("Usage: make_install_compat.py VERIFIED.apk OUTPUT_UNSIGNED.apk [arm64-v8a|x86_64]")
    print(json.dumps(create(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3] if len(sys.argv) == 4 else "arm64-v8a"), indent=2))
