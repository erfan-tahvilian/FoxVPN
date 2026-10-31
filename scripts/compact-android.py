# SPDX-License-Identifier: GPL-3.0-or-later
"""Losslessly recompress unsigned Android APKs; never modify DEX or native code."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile


def entries(file):
    with zipfile.ZipFile(file) as archive:
        records = archive.infolist()
        if len({i.filename for i in records}) != len(records):
            raise ValueError("Duplicate APK entry")
        return {i.filename: (hashlib.sha256(archive.read(i)).hexdigest(),
                             i.compress_type, i.external_attr)
                for i in records}


def recompress(source, output):
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(output, "w") as compact:
        compact.comment = original.comment
        for info in original.infolist():
            if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                raise ValueError("Unsupported APK compression method")
            if info.filename.upper().endswith((".RSA", ".DSA", ".EC", ".SF")) and info.filename.startswith("META-INF/"):
                raise ValueError("Only unsigned APKs may be recompressed")
            target = copy.copy(info)
            compact.writestr(target, original.read(info), compresslevel=9)
            # zipfile supplies Unix permissions when an Android entry has zero
            # attributes. Restore the original value before the central directory
            # is emitted; APK/JAR entries normally have no Unix attributes.
            target.external_attr = info.external_attr
    before, after = entries(source), entries(output)
    if before != after:
        changed = [name for name, value in before.items() if after.get(name) != value]
        raise ValueError("APK contents or compression semantics changed: " + ", ".join(changed[:5]))


def main():
    folder = Path("android/app/build/outputs/apk/release")
    align = Path(os.environ["ANDROID_HOME"]) / "build-tools/35.0.0/zipalign"
    packages = sorted(folder.glob("*-release-unsigned.apk"))
    if len(packages) != 5:
        raise ValueError("All five release architectures are required")
    reports = []
    for package in packages:
        before = package.stat().st_size
        with tempfile.TemporaryDirectory(prefix="fox-apk-") as temp:
            candidate, aligned = Path(temp) / "compact.apk", Path(temp) / "aligned.apk"
            recompress(package, candidate)
            subprocess.run([str(align), "-P", "16", "-f", "4", str(candidate), str(aligned)], check=True)
            subprocess.run([str(align), "-c", "-P", "16", "4", str(aligned)], check=True)
            if entries(package) != entries(aligned):
                raise ValueError("APK alignment changed an entry")
            if aligned.stat().st_size < before:
                package.write_bytes(aligned.read_bytes())
        reports.append({"file": package.name, "beforeBytes": before,
                        "afterBytes": package.stat().st_size,
                        "verifiedEntries": len(entries(package))})
    output = Path("android/app/build/reports/apk-compression.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(reports, indent=2) + "\n")
    print(output.read_text())


if __name__ == "__main__":
    main()
