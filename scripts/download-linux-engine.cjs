// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {target,machine,engineRoot}=require('./linux-target.cjs');
async function main(){
  if(process.platform!=='linux')throw Error('Prepare Linux engines on Linux CI.');
  const t=target(),root=engineRoot(),version='1.12.0',name=`sing-box-${version}-linux-${t.engine}.tar.gz`;
  const headers={Accept:'application/vnd.github+json'};if(process.env.GITHUB_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
  const response=await fetch(`https://api.github.com/repos/SagerNet/sing-box/releases/tags/v${version}`,{headers});if(!response.ok)throw Error('Cannot resolve pinned engine metadata');
  const release=await response.json(),asset=release.assets.find(a=>a.name===name),expected=asset?.digest?.replace('sha256:','');if(!expected)throw Error('Pinned Linux engine digest unavailable');
  const r=await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Engine download failed');const b=Buffer.from(await r.arrayBuffer());if(crypto.createHash('sha256').update(b).digest('hex')!==expected)throw Error('Engine checksum mismatch');
  fs.mkdirSync(root,{recursive:true});const archive=path.join(root,name);fs.writeFileSync(archive,b);execFileSync('/usr/bin/tar',['-xzf',archive,'-C',root]);
  fs.copyFileSync(path.join(root,`sing-box-${version}-linux-${t.engine}/sing-box`),path.join(root,'sing-box'));fs.chmodSync(path.join(root,'sing-box'),0o755);
  const license=await fetch(`https://raw.githubusercontent.com/SagerNet/sing-box/v${version}/LICENSE`);if(!license.ok)throw Error('Engine license unavailable');fs.writeFileSync(path.join(root,'LICENSE-sing-box.txt'),await license.text());
  fs.writeFileSync(path.join(root,'provenance.txt'),`sing-box ${version}\n${asset.browser_download_url}\nsha256 ${expected}\nSource: https://github.com/SagerNet/sing-box/tree/v${version}\n`);
  if(machine(path.join(root,'sing-box'))!==t.cpu)throw Error('Engine architecture mismatch');console.log(`Native Linux ${t.arch} engine checksum and ELF architecture verified.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
