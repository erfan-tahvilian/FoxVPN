// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const net=require('node:net');
const {performance}=require('node:perf_hooks');

// TCP connection time, including DNS resolution. No login or VPN pass is sent.
function measure(server,timeout=4000) {
  return new Promise(resolve=>{
    const start=performance.now();
    const socket=net.connect({host:server.host,port:server.port});
    let finished=false;
    const finish=ms=>{if(finished)return;finished=true;clearTimeout(timer);socket.destroy();resolve({ms,measuredAt:Date.now()});};
    const timer=setTimeout(()=>finish(null),timeout);
    socket.once('connect',()=>finish(Math.max(1,Math.round(performance.now()-start))));
    socket.once('error',()=>finish(null));
  });
}
async function measureAll(servers,onResult,concurrency=6,probe=measure) {
  let index=0;
  await Promise.all(Array.from({length:Math.min(concurrency,servers.length)},async()=>{
    while(index<servers.length){const server=servers[index++];const result=await probe(server);onResult(server.id,result);}
  }));
}
module.exports={measure,measureAll};
