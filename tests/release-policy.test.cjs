// SPDX-License-Identifier: GPL-3.0-or-later
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {ReleaseNotes}=require('../src/lib/release-notes.cjs');
const {binaries,validateRelease,olderTags,archivedNotes,archiveRelease}=require('../.github/scripts/release-tools.cjs');
const {compare}=require('../.github/scripts/release-size-report.cjs');
test('size report covers every architecture and separates compression from a retired source duplicate',()=>{
  const before={tag_name:'v1.0.1',assets:binaries('1.0.1').map(name=>({name,size:1000})).concat({name:'FoxVPN-1.0.1-source.tar.gz',size:500})};
  const after={tag_name:'v1.0.2',assets:binaries('1.0.2').map(name=>({name,size:900}))};
  const result=compare(before,after);assert.equal(result.rows.length,21);assert.equal(result.totals.savedBytes,2100);assert.equal(result.releaseTotals.savedBytes,2600);assert.equal(result.auxiliary[0].status,'retired');
  assert.throws(()=>compare(before,{...after,assets:after.assets.slice(1)}),/Missing comparable asset/);
});
test('release highlights are acknowledged once per version and filtered for the installed platform',()=>{
  const stateFile=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'fox-notes-')),'state.json'),notes={version:'1.0.1',items:[{platforms:['win32'],title:'Windows improvement',description:'Fixture'},{platforms:['android'],title:'Android improvement',description:'Fixture'}]};
  const store=new ReleaseNotes({notes,version:'1.0.1',platform:'win32',stateFile});assert.equal(store.read().seen,false);assert.deepEqual(store.read().items,[{title:'Windows improvement',description:'Fixture'}]);store.acknowledge();assert.equal(store.read().seen,true);
  const next=new ReleaseNotes({notes:{...notes,version:'1.0.2'},version:'1.0.2',platform:'win32',stateFile});assert.equal(next.read().seen,false);assert.throws(()=>new ReleaseNotes({notes,version:'1.0.2',platform:'win32',stateFile}));
});
test('release publication requires every supported binary and rejects temporary or stale assets',()=>{
  const names=[...binaries('1.0.1'),'sing-box-1.12.0-source.tar.gz','SHA256SUMS-Android.txt'];
  const release={tag_name:'v1.0.1',draft:true,prerelease:false,assets:names.map(name=>({name,state:'uploaded',size:1024,digest:'sha256:'+'ab'.repeat(32)}))};
  assert.equal(validateRelease(release,'1.0.1').trim().split('\n').length,23);
  assert.throws(()=>validateRelease({...release,assets:release.assets.slice(1)},'1.0.1'));
  assert.throws(()=>validateRelease({...release,assets:[...release.assets,{name:'android-signing-envelope.json'}]},'1.0.1'));
  assert.throws(()=>validateRelease({...release,tag_name:'v1.0.0'},'1.0.1'));
  assert.throws(()=>validateRelease({...release,assets:[...release.assets,{name:'FoxVPN-1.0.1-source.tar.gz'}]},'1.0.1'));
});
test('release cleanup selects only older versioned releases and preserves newer releases',()=>{
  assert.deepEqual(olderTags([{tag_name:'v1.0.0'},{tag_name:'v1.0.1'},{tag_name:'v1.0.2'},{tag_name:'v2.0.0'},{tag_name:'development'}],'1.0.1'),['v1.0.0']);
});
test('older release notes survive asset retirement without stale download links',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'fox-archive-')),calls=[];
  const body='# Fox VPN v1.0.0\n\n- Account sign-in improvements.\n\n## Downloads\n\n[Old APK](https://example.test/old.apk)\n\n## Installation\n\nAndroid 8 or later.\n';
  archiveRelease('erfan-tahvilian/FoxVPN',{id:17,draft:false,body,assets:[{id:31},{id:32}]},temporary,(...args)=>calls.push(args));
  const archived=JSON.parse(fs.readFileSync(calls[0].at(-1),'utf8')).body;
  assert(archived.includes('Account sign-in improvements.'));assert(archived.includes('Android 8 or later.'));assert(!archived.includes('old.apk'));assert(archived.includes('/releases/latest'));
  assert.equal(archivedNotes(archived),archived);
  assert.deepEqual(calls.slice(1),[['api','--method','DELETE','repos/erfan-tahvilian/FoxVPN/releases/assets/31'],['api','--method','DELETE','repos/erfan-tahvilian/FoxVPN/releases/assets/32']]);
  assert.deepEqual(olderTags([{tag_name:'v1.0.0',draft:true}],'1.0.1'),[]);
});
