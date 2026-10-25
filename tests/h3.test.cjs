// SPDX-License-Identifier: GPL-3.0-or-later
const test=require('node:test'),assert=require('node:assert/strict');const {AdaptiveTunnel}=require('../src/lib/h3-tunnel.cjs'),{Tunnel}=require('../src/lib/tunnel.cjs'),{DEFAULTS}=require('../src/lib/settings.cjs');
test('automatic protocol falls back when HTTP3 is unavailable while forced HTTP3 fails',async()=>{
  const original=Tunnel.prototype.session;let fallback=0;Tunnel.prototype.session=async()=>{fallback++;return {fallback:true};};
  try{for(const mode of ['auto','h3']){const t=new AdaptiveTunnel({...DEFAULTS,transport:mode},()=>{},()=>{},'missing-helper');t.active=true;t.candidate={host:'localhost',port:443};t.token='fixture';if(mode==='auto'){assert.deepEqual(await t.session(),{fallback:true});assert.equal(t.protocol,'h2');}else await assert.rejects(t.session(),/missing/);t.stop();}assert.equal(fallback,1);}finally{Tunnel.prototype.session=original;}
});
test('forced HTTP3 refuses an incompatible TCP upstream proxy',async()=>{const t=new AdaptiveTunnel({...DEFAULTS,transport:'h3',upstream:{...DEFAULTS.upstream,enabled:true}},()=>{},()=>{},'missing-helper');t.active=true;await assert.rejects(t.session(),/UDP/);t.stop();});

test('Windows encrypted bootstrap avoids native DNS and gives forced HTTP3 twenty seconds',async()=>{
 const {workerConfig}=require('../src/lib/h3-tunnel.cjs');
 const config=await workerConfig({...DEFAULTS,transport:'h3'},{host:'does-not-exist.invalid',port:2499},'win32');
 assert.deepEqual(config.edges,[]);assert.equal(config.bootstrapDNS,'automatic');assert.equal(config.timeout,20000);assert.equal(config.host,'does-not-exist.invalid');
 const custom=await workerConfig({...DEFAULTS,edge:'127.0.0.1',transport:'h3'},{host:'edge.example',port:2499},'win32');
 assert.equal(custom.bootstrapDNS,'');assert.equal(custom.edges[0],'127.0.0.1');assert.equal(custom.host,'edge.example');
});

test('Windows Recommended uses official anycast and manual locations remain explicit',()=>{
 const {connectionCandidates}=require('../src/lib/h3-tunnel.cjs');const servers=[{id:'de',code:'DE'},{id:'rec',code:'REC'},{id:'uk',code:'GB'}];
 assert.deepEqual(connectionCandidates(servers,'REC','win32'),[servers[1]]);
 assert.deepEqual(connectionCandidates(servers,'de','win32'),[servers[0]]);
 assert.equal(connectionCandidates(servers,'REC','darwin').length,3);
});
