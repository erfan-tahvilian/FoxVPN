const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {target,engineRoot,machine}=require('./windows-target.cjs');
const t=target(),root=engineRoot();
const VERSION='1.12.0';
async function download(url,file,hash) {
  const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Download failed (${r.status})`);
  const buffer=Buffer.from(await r.arrayBuffer());
  const actual=crypto.createHash('sha256').update(buffer).digest('hex');
  if(hash && actual!==hash.toLowerCase())throw Error('Engine checksum mismatch');
  fs.writeFileSync(file,buffer);return actual;
}
async function main() {
  if(process.platform!=='win32')throw Error('Run engine preparation on Windows.');
  fs.mkdirSync(root,{recursive:true});
  const name=`sing-box-${VERSION}-windows-${t.engine}.zip`;
  const apiHeaders={Accept:'application/vnd.github+json'};
  if(process.env.GITHUB_TOKEN)apiHeaders.Authorization='Bearer '+process.env.GITHUB_TOKEN;
  const releaseResponse=await fetch(`https://api.github.com/repos/SagerNet/sing-box/releases/tags/v${VERSION}`,{headers:apiHeaders});
  if(!releaseResponse.ok)throw Error(`Cannot resolve the pinned engine metadata (GitHub HTTP ${releaseResponse.status}). In CI, pass GITHUB_TOKEN to avoid shared-IP rate limits.`);
  const release=await releaseResponse.json();
  const asset=release.assets?.find(a=>a.name===name);if(!asset)throw Error('Pinned sing-box release not found');
  // GitHub asset digest authenticates the pinned download. Older assets use checksums.txt.
  let checksum=asset.digest?.replace('sha256:','');
  const checksumAsset=release.assets.find(a=>/checksums.*\.txt$/.test(a.name));
  if(!checksum&&checksumAsset){const text=await(await fetch(checksumAsset.browser_download_url)).text();checksum=text.split('\n').find(l=>l.includes(name))?.trim().split(/\s+/)[0];}
  if(!checksum)throw Error('No published checksum is available for the pinned engine.');
  const zip=path.join(root,name);await download(asset.browser_download_url,zip,checksum);
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${zip.replace(/'/g,"''")}' -DestinationPath '${root.replace(/'/g,"''")}' -Force`],{windowsHide:true});
  const extracted=path.join(root,`sing-box-${VERSION}-windows-${t.engine}`);
  fs.copyFileSync(path.join(extracted,'sing-box.exe'),path.join(root,'sing-box.exe'));
  const license=await(await fetch(`https://raw.githubusercontent.com/SagerNet/sing-box/v${VERSION}/LICENSE`)).text();
  fs.writeFileSync(path.join(root,'LICENSE-sing-box.txt'),license);
  const wintun=path.join(root,'wintun.zip');
  const wintunHash=await download('https://www.wintun.net/builds/wintun-0.14.1.zip',wintun,'07c256185d6ee3652e09fa55c0b673e2624b565e02c4b9091c79ca7d2f24ef51');
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${wintun.replace(/'/g,"''")}' -DestinationPath '${root.replace(/'/g,"''")}' -Force`],{windowsHide:true});
  fs.copyFileSync(path.join(root,'wintun/bin',t.wintun,'wintun.dll'),path.join(root,'wintun.dll'));
  fs.copyFileSync(path.join(root,'wintun/LICENSE.txt'),path.join(root,'LICENSE-wintun.txt'));
  fs.writeFileSync(path.join(root,'provenance.txt'),`sing-box ${VERSION}\n${asset.browser_download_url}\nsha256 ${checksum}\nWintun 0.14.1\nhttps://www.wintun.net/builds/wintun-0.14.1.zip\nsha256 ${wintunHash}\nSource: https://github.com/SagerNet/sing-box/tree/v${VERSION}\n`);
  for(const file of ['sing-box.exe','wintun.dll'])if(machine(path.join(root,file))!==t.machine)throw Error('Engine architecture mismatch: '+file);
  console.log(`Windows ${t.label} engine prepared and checksums verified.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
