// SPDX-License-Identifier: GPL-3.0-or-later
const test=require('node:test'),assert=require('node:assert/strict');const {AdaptiveTunnel}=require('../src/lib/h3-tunnel.cjs'),{Tunnel}=require('../src/lib/tunnel.cjs'),{DEFAULTS}=require('../src/lib/settings.cjs');
test('automatic requires a working HTTPS probe before using HTTP2 and forced HTTP3 still fails',async()=>{
 const originalSession=Tunnel.prototype.session,originalRequest=Tunnel.prototype.request;let fallback=0,probes=0;
 const session=new (require('node:events').EventEmitter)();session.destroy=()=>{};
 Tunnel.prototype.session=async function(){fallback++;this.current=session;this.sessions.add(session);return session;};
 Tunnel.prototype.request=async()=>{probes++;return Buffer.alloc(0);};
 try{for(const mode of ['auto','h3']){const t=new AdaptiveTunnel({...DEFAULTS,transport:mode},()=>{},()=>{},'missing-helper');t.active=true;t.candidate={host:'localhost',port:443};t.token='fixture';if(mode==='auto'){assert.equal(await t.session(),session);assert.equal(t.protocol,'h2');}else await assert.rejects(t.session(),/missing/);t.stop();}assert.equal(fallback,1);assert.equal(probes,1);}finally{Tunnel.prototype.session=originalSession;Tunnel.prototype.request=originalRequest;}
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
 assert.deepEqual(connectionCandidates(servers,'REC','darwin'),[servers[1]]);
});

test('Automatic chooses the first healthy HTTPS path and releases its competitor',async()=>{
 const {raceHealthyPaths}=require('../src/lib/h3-tunnel.cjs');
 for(const fastest of ['h2','h3']){
  let cancelled=false;
  const winner=await raceHealthyPaths(['h2','h3'].map(protocol=>({protocol,run:signal=>protocol===fastest?Promise.resolve('verified HTTPS'):new Promise((_,reject)=>signal.addEventListener('abort',()=>{cancelled=true;reject(Error('cancelled'));},{once:true}))})));
  assert.equal(winner.protocol,fastest);assert.equal(cancelled,true);
 }
});

test('Automatic ignores a failed path and refuses two unhealthy paths',async()=>{
 const {raceHealthyPaths}=require('../src/lib/h3-tunnel.cjs');
 const failed={protocol:'h3',run:async()=>{throw Error('Handshake succeeded but HTTPS failed');}};
 assert.equal((await raceHealthyPaths([failed,{protocol:'h2',run:async()=>true}])).protocol,'h2');
 await assert.rejects(raceHealthyPaths([failed,failed]),/Neither/);
});

test('cancelling Automatic immediately stops both pending protocol paths',async()=>{
 const {raceHealthyPaths}=require('../src/lib/h3-tunnel.cjs'),abort=new AbortController();let stopped=0;
 const pending=raceHealthyPaths(['h2','h3'].map(protocol=>({protocol,run:signal=>new Promise(()=>signal.addEventListener('abort',()=>stopped++,{once:true}))})),abort.signal);
 await new Promise(resolve=>setImmediate(resolve));abort.abort();
 await assert.rejects(pending,/cancelled/);assert.equal(stopped,2);
});
