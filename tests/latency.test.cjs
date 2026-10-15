// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {test}=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {measure,measureAll}=require('../src/lib/latency.cjs');
test('TCP latency measures reachable endpoints and marks refused endpoints unreachable',async()=>{
  const server=net.createServer(socket=>socket.end());
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const endpoint={host:'127.0.0.1',port:server.address().port};
  const result=await measure(endpoint);
  assert(result.ms>=1);assert(result.measuredAt<=Date.now());
  await new Promise(resolve=>server.close(resolve));
  assert.equal((await measure(endpoint)).ms,null);
});
test('all endpoints are measured once with bounded concurrency and incremental results',async()=>{
  let active=0,peak=0;const seen=[];
  const servers=Array.from({length:17},(_,id)=>({id}));
  await measureAll(servers,id=>seen.push(id),3,async()=>{
    active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,3));active--;return {ms:12};
  });
  assert.equal(peak,3);assert.deepEqual(seen.sort((a,b)=>a-b),servers.map(s=>s.id));
});
