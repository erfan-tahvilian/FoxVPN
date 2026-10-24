// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {test}=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {measure,measureAll}=require('../src/lib/latency.cjs');
test('real delay requires a completed HTTPS probe and always closes its tunnel',async()=>{
  let closed=0,called=0;
  const factory=()=>({async request(url){assert.equal(url,'https://www.google.com/generate_204');called++;await new Promise(r=>setTimeout(r,15));},stop(){closed++;}});
  const result=await measure({host:'edge.example',port:443},{},{token:'pass'},1000,factory);
  assert(result.ms>=10);assert.equal(result.kind,'real-delay');assert.equal(closed,1);assert.equal(called,2);
  const failure=await measure({}, {}, {token:'pass'},1000,()=>({async request(){throw Error('CONNECT rejected');},stop(){closed++;}}));
  assert.equal(failure.ms,null);assert.equal(closed,2);
  const timeout=await measure({}, {}, {token:'pass'},5,()=>({request(){return new Promise(()=>{});},stop(){closed++;}}));
  assert.equal(timeout.ms,null);assert.equal(closed,3);
});
test('all endpoints are measured once with bounded concurrency and incremental results',async()=>{
  let active=0,peak=0;const seen=[];
  const servers=Array.from({length:17},(_,id)=>({id}));
  await measureAll(servers,id=>seen.push(id),3,async()=>{
    active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,3));active--;return {ms:12};
  });
  assert.equal(peak,3);assert.deepEqual(seen.sort((a,b)=>a-b),servers.map(s=>s.id));
});
