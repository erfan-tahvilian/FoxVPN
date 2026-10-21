# SPDX-License-Identifier: GPL-3.0-or-later
"""Publish verified iOS deliverables without altering other platforms' assets."""
import hashlib,json,os,re,subprocess,tempfile,time
from pathlib import Path
repo=os.environ["GITHUB_REPOSITORY"];tag=os.environ["IOS_RELEASE_TAG"];folder=Path("dist/ios/release")
version=json.loads(Path("package.json").read_text())["version"]
if tag!="v"+version:raise SystemExit("Release tag must match the project version.")
report=json.loads((folder/"iOS-BUILD-INFO.json").read_text())
if not report["simulatorTestsPassed"]:raise SystemExit("Simulator checks must pass before publication.")
if report["sourceCommit"]!=os.environ["GITHUB_SHA"]:raise SystemExit("Build/source identity mismatch.")
files=sorted(file for file in folder.iterdir() if file.is_file())
for line in (folder/"SHA256SUMS-iOS.txt").read_text().splitlines():
    expected,name=line.split("  ",1)
    if Path(name).name!=name or hashlib.sha256((folder/name).read_bytes()).hexdigest()!=expected:raise SystemExit("iOS asset checksum mismatch.")
def gh(*args):return subprocess.check_output(["gh",*args],text=True)
exists=subprocess.run(["gh","release","view",tag,"--repo",repo],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
if not exists:
    gh("release","create",tag,"--repo",repo,"--target",report["sourceCommit"],"--draft","--title","Fox VPN "+tag,"--notes","")
gh("release","upload",tag,*[str(file) for file in files],"--clobber","--repo",repo)
release=json.loads(gh("api",f"repos/{repo}/releases/tags/{tag}"))
for file in files:
    asset=next((a for a in release["assets"] if a["name"]==file.name),None)
    if not asset or asset.get("digest")!="sha256:"+hashlib.sha256(file.read_bytes()).hexdigest():raise SystemExit("Uploaded iOS asset digest mismatch: "+file.name)
base=f"https://github.com/{repo}/releases/download/{tag}"
guide=f"https://github.com/{repo}/blob/{report['sourceCommit']}/IOS_INSTALL.md"
section=f"""<!-- foxvpn-ios:start -->
## iOS and iPadOS

**iOS/iPadOS 18+ · iPhone and iPad · ARM64 · experimental, physical VPN testing pending**

[Download IPA for signing]({base}/FoxVPN-{version}-iOS-arm64-unsigned.ipa) · [Installation guide — English / فارسی]({guide}) · [Signing tools]({base}/FoxVPN-{version}-iOS-signing-tools.zip)

The unsigned IPA contains the device app, Packet Tunnel VPN extension and Control Center/Live Activity extension. **It is not directly installable.** Ordinary free Apple Account signing with AltStore, SideStore or Sideloadly does not authorize this VPN's required Network Extension permissions. The guide explains conditional installation with an authorized signer, including users who only have an iPhone.

Builds, simulator unit/UI tests, ARM64 executable inspection and package checks passed. Installation, actual VPN traffic, background operation and system controls have not been verified on a physical iPhone. No simulator result is presented as proof of live device routing.

Matching source, requested entitlements, `iOS-BUILD-INFO.json` and `SHA256SUMS-iOS.txt` are attached. Optional signing automation requires valid certificates and profiles; it verifies the actual exported permissions and fails if Packet Tunnel or shared storage is missing.
"""
if report.get("signedIPAAvailable"):
    section+=f"\n[Device-eligible signed IPA]({base}/FoxVPN-{version}-iOS-arm64-signed.ipa) is also attached. It only covers devices authorized by its profiles; see `iOS-SIGNING-REPORT.json`. This is not universal public-install authorization.\n"
else:section+="\nNo signed device-install IPA is supplied by this run because signing credentials were not configured.\n"
section+="<!-- foxvpn-ios:end -->"
body=release.get("body") or "# Fox VPN "+tag
pattern=r"<!-- foxvpn-ios:start -->.*?<!-- foxvpn-ios:end -->"
body=re.sub(pattern,lambda _:section,body,flags=re.S) if re.search(pattern,body,re.S) else body.rstrip()+"\n\n"+section+"\n"
with tempfile.TemporaryDirectory() as temp:
    notes=Path(temp)/"release.md";notes.write_text(body,encoding="utf8")
    gh("release","edit",tag,"--repo",repo,"--notes-file",str(notes),"--draft=false")
    release=json.loads(gh("api",f"repos/{repo}/releases/tags/{tag}"))
    sums=[]
    for a in release["assets"]:
        if a["name"]=="SHA256SUMS.txt":continue
        if not re.fullmatch(r"sha256:[a-f0-9]{64}",a.get("digest") or ""):raise SystemExit("Missing GitHub digest: "+a["name"])
        sums.append((a["name"],a["digest"][7:]))
    checksums=Path(temp)/"SHA256SUMS.txt";checksums.write_text("".join(digest+"  "+name+"\n" for name,digest in sorted(sums)),encoding="utf8")
    gh("release","upload",tag,str(checksums),"--repo",repo,"--clobber")
    release=json.loads(gh("api",f"repos/{repo}/releases/tags/{tag}"))
    expected="sha256:"+hashlib.sha256(checksums.read_bytes()).hexdigest()
    if next(a for a in release["assets"] if a["name"]=="SHA256SUMS.txt")["digest"]!=expected:raise SystemExit("Global checksum asset verification failed.")
print(release["html_url"])
