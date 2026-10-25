// SPDX-License-Identifier: GPL-3.0-or-later
const {performance}=require('node:perf_hooks');
const {Tunnel}=require('./tunnel.cjs');
// Two requests through one reusable proxy connection; report the smaller sample.
const TEST_URL='https://www.google.com/generate_204';
async function measure(server,settings,pass,timeout=5000,create=(...args)=>new Tunnel(...args),options={}) {
  const probe=create(settings,()=>{},()=>{});
  probe.candidate=server;probe.token=pass.token;probe.active=true;
  const agent=probe.createProbeAgent?.(TEST_URL);
  let phase='setup';
  const deadline=async(promise,budget)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Delay check timed out')),budget);})]);}finally{clearTimeout(timer);}};
  try {
    // A slow but valid QUIC handshake must not consume the HTTPS delay budget.
    // Start timing only after the selected transport is ready.
    if(probe.session)await deadline(probe.session(),options.setupTimeout??(['h3','auto'].includes(settings.transport)?22000:15000));
    phase='https';
    const times=[];
    for(let i=0;i<2;i++){
      if(i)await new Promise(r=>setTimeout(r,100));
      const start=performance.now();
      try{await deadline(probe.request(TEST_URL,undefined,undefined,{agent,statuses:[200,204]}),timeout);times.push(Math.max(1,Math.floor(performance.now()-start)));}
      catch(error){if(!times.length)throw error;break;}
    }
    return {ms:Math.min(...times),measuredAt:Date.now(),kind:'real-delay',protocol:probe.protocol||null};
  }catch(error){return {ms:null,measuredAt:Date.now(),kind:'real-delay',protocol:probe.protocol||null,phase,reason:/timed? out|timeout|deadline/i.test(error.message)?'timeout':'unavailable'};}
  finally{agent?.destroy();probe.stop();}
}
async function measureAll(servers,onResult,concurrency=3,probe) {
  let index=0;
  await Promise.all(Array.from({length:Math.min(concurrency,servers.length)},async()=>{
    while(index<servers.length){const server=servers[index++];const result=await probe(server);onResult(server.id,result);}
  }));
}
module.exports={measure,measureAll};
