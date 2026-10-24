// SPDX-License-Identifier: GPL-3.0-or-later
const {performance}=require('node:perf_hooks');
const {Tunnel}=require('./tunnel.cjs');
// Two requests through one reusable proxy connection; report the smaller sample.
const TEST_URL='https://www.google.com/generate_204';
async function measure(server,settings,pass,timeout=5000,create=(...args)=>new Tunnel(...args)) {
  const probe=create(settings,()=>{},()=>{});
  probe.candidate=server;probe.token=pass.token;probe.active=true;
  const agent=probe.createProbeAgent?.(TEST_URL);let timer;
  try {
    const sample=async()=>{const times=[];for(let i=0;i<2;i++){
      const start=performance.now();await probe.request(TEST_URL,undefined,undefined,{agent,statuses:[200,204]});
      times.push(Math.max(1,Math.floor(performance.now()-start)));await new Promise(r=>setTimeout(r,100));
    }return Math.min(...times);};
    const ms=await Promise.race([sample(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Delay check timed out')),timeout);})]);
    return {ms,measuredAt:Date.now(),kind:'real-delay'};
  }catch{return {ms:null,measuredAt:Date.now(),kind:'real-delay'};}
  finally{clearTimeout(timer);agent?.destroy();probe.stop();}
}
async function measureAll(servers,onResult,concurrency=3,probe) {
  let index=0;
  await Promise.all(Array.from({length:Math.min(concurrency,servers.length)},async()=>{
    while(index<servers.length){const server=servers[index++];const result=await probe(server);onResult(server.id,result);}
  }));
}
module.exports={measure,measureAll};
