// SPDX-License-Identifier: GPL-3.0-or-later
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {ReleaseNotes}=require('../src/lib/release-notes.cjs');
const {binaries,validateRelease,olderTags}=require('../.github/scripts/release-tools.cjs');
test('release highlights are acknowledged once per version and filtered for the installed platform',()=>{
  const stateFile=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'fox-notes-')),'state.json'),notes={version:'1.0.1',items:[{platforms:['win32'],title:'Windows improvement',description:'Fixture'},{platforms:['android'],title:'Android improvement',description:'Fixture'}]};
  const store=new ReleaseNotes({notes,version:'1.0.1',platform:'win32',stateFile});assert.equal(store.read().seen,false);assert.deepEqual(store.read().items,[{title:'Windows improvement',description:'Fixture'}]);store.acknowledge();assert.equal(store.read().seen,true);
  const next=new ReleaseNotes({notes:{...notes,version:'1.0.2'},version:'1.0.2',platform:'win32',stateFile});assert.equal(next.read().seen,false);assert.throws(()=>new ReleaseNotes({notes,version:'1.0.2',platform:'win32',stateFile}));
});
test('release publication requires every supported binary and rejects temporary or stale assets',()=>{
  const names=[...binaries('1.0.1'),'FoxVPN-1.0.1-source.tar.gz','sing-box-1.12.0-source.tar.gz','SHA256SUMS-Android.txt'];
  const release={tag_name:'v1.0.1',draft:true,prerelease:false,assets:names.map(name=>({name,state:'uploaded',size:1024,digest:'sha256:'+'ab'.repeat(32)}))};
  assert.equal(validateRelease(release,'1.0.1').trim().split('\n').length,24);
  assert.throws(()=>validateRelease({...release,assets:release.assets.slice(1)},'1.0.1'));
  assert.throws(()=>validateRelease({...release,assets:[...release.assets,{name:'android-signing-envelope.json'}]},'1.0.1'));
  assert.throws(()=>validateRelease({...release,tag_name:'v1.0.0'},'1.0.1'));
});
test('release cleanup selects only older versioned releases and preserves newer releases',()=>{
  assert.deepEqual(olderTags([{tag_name:'v1.0.0'},{tag_name:'v1.0.1'},{tag_name:'v1.0.2'},{tag_name:'v2.0.0'},{tag_name:'development'}],'1.0.1'),['v1.0.0']);
});
