// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {assetName,newer}=require('../../src/lib/updates.cjs');
const version=require('../../package.json').version,tag='v'+version;
function binaries(v){const result=[];for(const [platform,arches,formats]of[['win32',['x64','ia32','arm64'],['exe','zip']],['darwin',['x64','arm64'],['dmg','zip']],['linux',['x64','arm64'],['AppImage','deb','rpm']],['android',['arm64-v8a','armeabi-v7a','x86_64','x86','universal'],['apk']]])for(const arch of arches)for(const format of formats)result.push(assetName(v,{platform,arch,format}));return result;}
function validateRelease(release,v){
  assert.equal(release.tag_name,'v'+v);assert.equal(release.prerelease,false);
  // Fox VPN source is provided by GitHub's version-tag archives. Keep the
  // separately bundled GPL dependency source and all installation variants.
  const required=[...binaries(v),'sing-box-1.12.0-source.tar.gz','SHA256SUMS-Android.txt'];
  const allowed=new Set([...required,'SHA256SUMS.txt']);
  assert.equal(new Set(release.assets.map(a=>a.name)).size,release.assets.length,'Duplicate release asset');
  for(const name of required)assert(release.assets.some(a=>a.name===name),`Missing release asset: ${name}`);
  for(const a of release.assets){assert(allowed.has(a.name),`Unexpected or transient asset: ${a.name}`);assert.equal(a.state,'uploaded');assert(a.size>0);assert.match(a.digest,/^sha256:[a-f0-9]{64}$/);}
  return release.assets.filter(a=>a.name!=='SHA256SUMS.txt').sort((a,b)=>a.name.localeCompare(b.name)).map(a=>`${a.digest.slice(7)}  ${a.name}`).join('\n')+'\n';
}
function olderTags(releases,v){return releases.filter(r=>!r.draft&&r.tag_name!=='v'+v&&/^v\d+\.\d+\.\d+$/.test(r.tag_name)&&newer(v,r.tag_name.slice(1))).map(r=>r.tag_name);}
function archivedNotes(body){
  let downloads=false;const lines=[];
  for(const line of (body||'').split(/\r?\n/)){
    if(/^## Downloads\s*$/.test(line)){downloads=true;continue;}
    if(downloads&&/^## /.test(line))downloads=false;
    if(!downloads)lines.push(line);
  }
  const notice='Installers for older versions are no longer distributed. Download the [latest release](https://github.com/erfan-tahvilian/FoxVPN/releases/latest).';
  const notes=lines.join('\n').trim();return notes+(notes.includes(notice)?'\n':'\n\n'+notice+'\n');
}
function archiveRelease(repo,release,temporary,invoke=gh){
  assert(Number.isSafeInteger(release.id)&&release.id>0);assert(!release.draft);
  const body=archivedNotes(release.body);
  if(body!==release.body){const file=path.join(temporary,`archive-${release.id}.json`);fs.writeFileSync(file,JSON.stringify({body}));invoke('api','--method','PATCH',`repos/${repo}/releases/${release.id}`,'--input',file);}
  for(const asset of release.assets){assert(Number.isSafeInteger(asset.id)&&asset.id>0);invoke('api','--method','DELETE',`repos/${repo}/releases/assets/${asset.id}`);}
}
function gh(...args){return execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function api(endpoint){return JSON.parse(gh('api',endpoint));}
// GitHub can omit an unpublished draft from the tag endpoint until its tag
// exists. The authenticated release list includes drafts and their release ID.
function findRelease(repo){return api(`repos/${repo}/releases?per_page=100`).find(release=>release.tag_name===tag)||null;}
async function main(){
  const mode=process.argv[2],repo=process.env.GITHUB_REPOSITORY||'erfan-tahvilian/FoxVPN';assert.equal(repo,'erfan-tahvilian/FoxVPN');
  if(mode==='metadata'){console.log(`FOX_VERSION=${version}\nFOX_TAG=${tag}`);return;}
  if(mode==='ensure-draft'){
    try{const latest=api(`repos/${repo}/releases/latest`);assert(newer(version,latest.tag_name.replace(/^v/,'')),'Use a version newer than the published stable release');}catch(error){if(!String(error.stderr).includes('HTTP 404'))throw error;}
    let release=findRelease(repo);
    if(!release){try{gh('release','create',tag,'--repo',repo,'--draft','--target',process.env.GITHUB_SHA||gh('api',`repos/${repo}/commits/main`,'--jq','.sha'),'--title',`Fox VPN ${tag}`,'--notes-file','RELEASE_NOTES.md');}catch(error){if(!findRelease(repo))throw error;}release=findRelease(repo);}
    assert(release.draft,'Published versions cannot be overwritten. Increase the application version.');
    assert.equal(release.target_commitish,process.env.GITHUB_SHA||gh('api',`repos/${repo}/commits/main`,'--jq','.sha'),'Draft source must match the release commit');
    return;
  }
  if(mode!=='finalize')throw Error('Unsupported release operation');
  const release=findRelease(repo);assert(release,'Stage the complete release first');
  const manifest=validateRelease(release,version);
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'fox-release-'));
  gh('release','download',tag,'--repo',repo,'--pattern','SHA256SUMS-Android.txt','--dir',temporary);
  const android=fs.readFileSync(path.join(temporary,'SHA256SUMS-Android.txt'),'utf8').trim().split(/\r?\n/);
  assert.equal(android.length,5);
  for(const line of android){const match=/^([a-f0-9]{64})\s+(.+\.apk)$/.exec(line);assert(match);assert(release.assets.some(a=>a.name===match[2]&&a.digest==='sha256:'+match[1]),'Android checksum differs');}
  if(release.draft){
    const checksum=path.join(temporary,'SHA256SUMS.txt');fs.writeFileSync(checksum,manifest);gh('release','upload',tag,checksum,'--repo',repo,'--clobber');
    const body=path.join(temporary,'publish.json');fs.writeFileSync(body,JSON.stringify({draft:false,prerelease:false,make_latest:'true',name:`Fox VPN ${tag} - Windows, macOS, Linux & Android`,body:fs.readFileSync('RELEASE_NOTES.md','utf8')}));
    gh('api','--method','PATCH',`repos/${repo}/releases/${release.id}`,'--input',body);
  }
  let latest;
  for(let attempt=0;attempt<6;attempt++){latest=api(`repos/${repo}/releases/latest`);if(latest.id===release.id)break;await new Promise(resolve=>setTimeout(resolve,2000));}
  assert.equal(latest.id,release.id,'The new release is not latest; older downloads were preserved');
  validateRelease(latest,version);
  const releases=api(`repos/${repo}/releases?per_page=100`),old=olderTags(releases,version);
  for(const oldTag of old)archiveRelease(repo,releases.find(r=>r.tag_name===oldTag),temporary);
  console.log(`Published and verified ${tag}; retired downloads from ${old.length} older releases. Release notes, git tags and source history were retained.`);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={binaries,validateRelease,olderTags,archivedNotes,archiveRelease};
