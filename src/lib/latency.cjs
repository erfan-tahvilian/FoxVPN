// SPDX-License-Identifier: GPL-3.0-or-later
const {performance}=require('node:perf_hooks');
const {Tunnel}=require('./tunnel.cjs');
// End-to-end HTTPS delay, including edge TLS, authenticated CONNECT and target TLS.
async function measure(server,settings,pass,timeout=12000,create=(...args)=>new Tunnel(...args)) {
  const probe=create(settings,()=>{},()=>{});
  probe.candidate=server;probe.token=pass.token;probe.active=true;
  const start=performance.now();let timer;
  try {
    await Promise.race([probe.request('https://www.cloudflare.com/cdn-cgi/trace'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Delay check timed out')),timeout);})]);
    return {ms:Math.max(1,Math.round(performance.now()-start)),measuredAt:Date.now(),kind:'real-delay'};
  }catch{return {ms:null,measuredAt:Date.now(),kind:'real-delay'};}
  finally{clearTimeout(timer);probe.stop();}
}
async function measureAll(servers,onResult,concurrency=3,probe) {
  let index=0;
  await Promise.all(Array.from({length:Math.min(concurrency,servers.length)},async()=>{
    while(index<servers.length){const server=servers[index++];const result=await probe(server);onResult(server.id,result);}
  }));
}
module.exports={measure,measureAll};
