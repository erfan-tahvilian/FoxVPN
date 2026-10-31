// SPDX-License-Identifier: GPL-3.0-or-later
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Updates,newer,assetName,selectRelease}=require('../src/lib/updates.cjs');
function release(version,target){const name=assetName(version,target);return {tag_name:'v'+version,draft:false,prerelease:false,assets:[{name,browser_download_url:`https://github.com/erfan-tahvilian/FoxVPN/releases/download/v${version}/${name}`,state:'uploaded',size:1024,digest:'sha256:'+'ab'.repeat(32)}]};}
test('update versions compare numerically and never offer equal, older or prerelease versions',()=>{
  assert(newer('1.0.10','1.0.9'));assert(newer('2.0.0','1.99.99'));assert(!newer('1.0.1','1.0.1'));assert(!newer('1.0.0','1.0.1'));
  for(const version of ['1.0.2-beta','1.0','01.0.1','1.0.0.1','javascript:alert(1)'])assert.throws(()=>newer(version,'1.0.1'));
});
test('all 21 supported installation variants map to their exact release package',()=>{
  let count=0;
  for(const [platform,arches,formats] of [['win32',['x64','ia32','arm64'],['exe','zip']],['darwin',['x64','arm64'],['dmg','zip']],['linux',['x64','arm64'],['AppImage','deb','rpm']],['android',['arm64-v8a','armeabi-v7a','x86_64','x86','universal'],['apk']]])for(const arch of arches)for(const format of formats){
    const target={platform,arch,format},result=selectRelease(release('1.0.2',target),'1.0.1',target);assert(result.available);assert.equal(result.name,assetName('1.0.2',target));assert(result.url.endsWith(result.name));count++;
  }
  assert.equal(count,21);assert.throws(()=>assetName('1.0.2',{platform:'linux',arch:'ia32',format:'deb'}));
});
test('update metadata refuses redirected assets, missing files, incomplete uploads and unknown digests',()=>{
  const target={platform:'android',arch:'arm64-v8a',format:'apk'};
  for(const edit of [r=>r.draft=true,r=>r.prerelease=true,r=>r.assets=[],r=>r.assets[0].browser_download_url='https://example.com/update.apk',r=>r.assets[0].state='new',r=>delete r.assets[0].digest]){const r=release('1.0.2',target);edit(r);assert.throws(()=>selectRelease(r,'1.0.1',target));}
  assert.equal(selectRelease(release('1.0.0',target),'1.0.1',target).available,false);
});
test('update checks share requests, reuse their cache and send an ETag on manual rechecks',async()=>{
  const target={platform:'win32',arch:'x64',format:'exe'},calls=[],cacheFile=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'fox-updates-')),'cache.json');
  const updates=new Updates({version:'1.0.1',target,cacheFile,fetch:async(url,options)=>{calls.push({url,options});return calls.length===1?new Response(JSON.stringify(release('1.0.2',target)),{headers:{etag:'"fixture"'}}):new Response(null,{status:304});}});
  const [a,b]=await Promise.all([updates.check(),updates.check()]);assert.deepEqual(a,b);assert.equal(calls.length,1);
  await updates.check();assert.equal(calls.length,1);await updates.check(true);assert.equal(calls.length,2);assert.equal(calls[1].options.headers['If-None-Match'],'"fixture"');assert.equal(calls[1].options.redirect,'error');
});
