// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit same-version maintenance publication. Normal releases remain immutable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {binaries,validateRelease}=require('./release-tools.cjs');
const version=require('../../package.json').version,tag='v'+version,repo='erfan-tahvilian/FoxVPN',folder='release-assets';
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main(){
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,repo);assert.equal(process.env.FOX_CONFIRM_VERSION,version);
  const endpoint=`repos/${repo}/releases/tags/${tag}`,before=JSON.parse(gh('api',endpoint));assert.equal(before.draft,false);assert.equal(before.tag_name,tag);
  const names=[...binaries(version),'sing-box-1.12.0-source.tar.gz','SHA256SUMS-Android.txt'];
  assert.deepEqual(fs.readdirSync(folder).sort(),[...names].sort(),'The complete package set is required before replacing any file');
  const assets=names.map(name=>{const file=path.join(folder,name);return {name,state:'uploaded',size:fs.statSync(file).size,digest:'sha256:'+digest(file)};});
  const manifest=validateRelease({tag_name:tag,prerelease:false,assets},version);
  fs.writeFileSync(path.join(folder,'SHA256SUMS.txt'),manifest);names.push('SHA256SUMS.txt');
  // All builds, signatures and files are validated before the first replacement.
  // Keep the existing release and its source tag; publish the manifest last.
  gh('release','upload',tag,...names.filter(name=>name!=='SHA256SUMS.txt').map(name=>path.join(folder,name)),'--repo',repo,'--clobber');
  gh('release','upload',tag,path.join(folder,'SHA256SUMS.txt'),'--repo',repo,'--clobber');
  const expected=new Map(names.map(name=>[name,'sha256:'+digest(path.join(folder,name))]));
  let after;
  for(let attempt=0;attempt<6;attempt++){
    after=JSON.parse(gh('api',endpoint));
    if(after.assets.length===expected.size&&after.assets.every(a=>expected.get(a.name)===a.digest))break;
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  assert.equal(after.id,before.id);assert.equal(after.assets.length,24);validateRelease(after,version);
  for(const asset of after.assets)assert.equal(asset.digest,expected.get(asset.name),asset.name);
  gh('release','edit',tag,'--repo',repo,'--notes-file','RELEASE_NOTES.md','--latest');
  assert.equal(JSON.parse(gh('api',`repos/${repo}/releases/latest`)).id,before.id);
  console.log(`Verified all 21 maintenance packages and source/checksum assets for ${tag}. Existing source tags were retained.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
