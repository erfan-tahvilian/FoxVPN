# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify native GitHub source contains every exported file of this commit."""
import hashlib
import argparse
import io
import json
from pathlib import Path
import subprocess
import tarfile
import urllib.request


def inventory(data):
    result = {}
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive:
            parts = member.name.split("/", 1)
            if len(parts) != 2 or not parts[1] or member.isdir():
                continue
            name = parts[1]
            if name.startswith("/") or ".." in name.split("/"):
                raise ValueError("Unsafe source archive path")
            if member.issym():
                result[name] = {"link": member.linkname}
            elif member.isfile():
                result[name] = {"sha256": hashlib.sha256(archive.extractfile(member).read()).hexdigest(),
                                "executable": bool(member.mode & 0o111)}
            else:
                raise ValueError("Unsupported source entry")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", default="HEAD")
    parser.add_argument("--url")
    parser.add_argument("--sha256")
    parser.add_argument("--report", default="source-archive-verification.json")
    args = parser.parse_args()
    commit = subprocess.check_output(["git", "rev-parse", args.commit], text=True).strip()
    exported = subprocess.check_output(["git", "archive", "--format=tar", "--prefix=FoxVPN/", commit])
    url = args.url or "https://codeload.github.com/erfan-tahvilian/FoxVPN/tar.gz/" + commit
    request = urllib.request.Request(url, headers={"User-Agent": "FoxVPN-source-verifier"})
    with urllib.request.urlopen(request, timeout=120) as response:
        downloaded = response.read()
    if args.sha256 and hashlib.sha256(downloaded).hexdigest() != args.sha256:
        raise ValueError("Historical release source digest mismatch")
    expected, actual = inventory(exported), inventory(downloaded)
    if expected != actual:
        raise ValueError("GitHub source archive differs from the exported release commit")
    for required in ["package.json", "package-lock.json", "LICENSE", "BUILDING.md",
                     "android/core/go.mod", "android/core/go.sum", "desktop/h3/go.mod",
                     "desktop/h3/go.sum", ".github/workflows/android.yml", "scripts/build-windows.cjs"]:
        if required not in actual:
            raise ValueError("Source archive missing " + required)
    report = {"commit": commit, "url": url, "verifiedEntries": len(actual),
              "bytes": len(downloaded), "sha256": hashlib.sha256(downloaded).hexdigest()}
    Path("test-results").mkdir(exist_ok=True)
    Path("test-results", args.report).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
