// SPDX-License-Identifier: GPL-3.0-or-later
const test=require('node:test'),assert=require('node:assert/strict');const {AdaptiveTunnel}=require('../src/lib/h3-tunnel.cjs'),{Tunnel}=require('../src/lib/tunnel.cjs'),{DEFAULTS}=require('../src/lib/settings.cjs');
test('automatic protocol falls back when HTTP3 is unavailable while forced HTTP3 fails',async()=>{
  const original=Tunnel.prototype.session;let fallback=0;Tunnel.prototype.session=async()=>{fallback++;return {fallback:true};};
  try{for(const mode of ['auto','h3']){const t=new AdaptiveTunnel({...DEFAULTS,transport:mode},()=>{},()=>{},'missing-helper');t.active=true;t.candidate={host:'localhost',port:443};t.token='fixture';if(mode==='auto'){assert.deepEqual(await t.session(),{fallback:true});assert.equal(t.protocol,'h2');}else await assert.rejects(t.session(),/missing/);t.stop();}assert.equal(fallback,1);}finally{Tunnel.prototype.session=original;}
});
test('forced HTTP3 refuses an incompatible TCP upstream proxy',async()=>{const t=new AdaptiveTunnel({...DEFAULTS,transport:'h3',upstream:{...DEFAULTS.upstream,enabled:true}},()=>{},()=>{},'missing-helper');t.active=true;await assert.rejects(t.session(),/UDP/);t.stop();});
