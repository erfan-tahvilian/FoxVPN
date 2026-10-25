// SPDX-License-Identifier: GPL-3.0-or-later
const {spawn}=require('node:child_process'),net=require('node:net'),crypto=require('node:crypto'),dns=require('node:dns').promises,fs=require('node:fs');
const {Tunnel,Reader}=require('./tunnel.cjs');
// Desktop transports share encrypted bootstrap and verified automatic selection.
async function workerConfig(settings,candidate,platform=process.platform){
  const hostname=settings.edge||candidate.host;
  const encrypted=!settings.edge&&!settings.customDns&&settings.doh!=='off';
  const addresses=encrypted?[]:await dns.lookup(hostname,{all:true});
  return {host:candidate.host,edge:hostname,edges:addresses.map(a=>a.address),bootstrapDNS:encrypted?(settings.doh||'automatic'):'',port:candidate.port,timeout:settings.transport==='h3'?20000:3500};
}
function connectionCandidates(servers,id,platform=process.platform){
  if(id!=='REC')return servers.filter(s=>s.id===id);
  const recommended=servers.filter(s=>s.code==='REC');if(recommended.length)return recommended;
  return [...servers].sort(()=>Math.random()-.5);
}
// Race completed HTTPS probes, rather than treating a TCP/QUIC handshake as
// proof of working internet access. A losing path must release its resources.
async function raceHealthyPaths(paths,signal){
  const controllers=paths.map(()=>new AbortController());
  let rejectAbort;
  const interrupted=new Promise((_,reject)=>{rejectAbort=reject;});
  const cancel=()=>{controllers.forEach(c=>c.abort());rejectAbort(Error('Connection cancelled'));};
  if(signal?.aborted)throw Error('Connection cancelled');
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    const winner=await Promise.race([interrupted,Promise.any(paths.map((path,i)=>Promise.resolve().then(()=>path.run(controllers[i].signal)).then(value=>{
      if(controllers[i].signal.aborted)throw Error('Connection cancelled');
      return {index:i,protocol:path.protocol,value};
    })))]);
    controllers.forEach((c,i)=>{if(i!==winner.index)c.abort();});
    return winner;
  }catch(error){cancel();throw signal?.aborted?Error('Connection cancelled'):Error('Neither HTTP/3 nor HTTP/2 could complete a secure connection.');}
  finally{signal?.removeEventListener('abort',cancel);}
}
async function probePath(open){
  const probe=Object.create(Tunnel.prototype);probe.open=open;
  await probe.request('https://www.google.com/generate_204',undefined,undefined,{statuses:[200,204]});
}
class H3Worker {
  constructor(executable,config){this.executable=executable;this.config=config;this.secret=crypto.randomBytes(32).toString('hex');this.sockets=new Set();this.stopped=false;}
  start(){if(this.ready)return this.ready;this.ready=new Promise((resolve,reject)=>{if(!fs.existsSync(this.executable)){reject(Error('HTTP/3 transport is missing. Reinstall Fox VPN.'));return;}const child=this.child=spawn(this.executable,[],{windowsHide:true,stdio:['pipe','pipe','ignore']});let buffer='',settled=false;const finish=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){this.stop();reject(error);}else{this.port=data.port;this.edgeIP=data.edgeIP;resolve();}};const timer=setTimeout(()=>finish(Error('HTTP/3 connection timed out.')),this.config.timeout+2500);child.once('error',()=>finish(Error('HTTP/3 transport could not start.')));child.once('exit',()=>{this.dead=true;finish(Error('HTTP/3 connection could not be established.'));});child.stdin.on('error',()=>{});child.stdout.on('data',chunk=>{buffer+=chunk.toString();if(buffer.length>8192){finish(Error('Invalid HTTP/3 transport response.'));return;}const end=buffer.indexOf('\n');if(end>=0&&!settled){try{const data=JSON.parse(buffer.slice(0,end));finish(data.error?Error(data.error):!Number.isInteger(data.port)||data.port<1?Error('Invalid HTTP/3 port.'):null,data);}catch{finish(Error('Invalid HTTP/3 response.'));}}});child.stdin.write(JSON.stringify({...this.config,secret:this.secret})+'\n');});return this.ready;}
  update(token){this.config.token=token;if(this.child&&!this.dead&&!this.stopped)this.child.stdin.write(JSON.stringify({type:'token',token})+'\n');}
  async open(host,port){await this.start();if(this.dead||this.stopped)throw Error('HTTP/3 transport stopped.');const socket=net.connect({host:'127.0.0.1',port:this.port});this.sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>this.sockets.delete(socket));const timer=setTimeout(()=>socket.destroy(Error('HTTP/3 CONNECT timed out.')),16000);try{await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});const reader=new Reader(socket),data=Buffer.from(JSON.stringify({secret:this.secret,host,port})),size=Buffer.alloc(4);size.writeUInt32BE(data.length);socket.write(Buffer.concat([size,data]));const length=(await reader.read(4)).readUInt32BE();if(length>65536)throw Error('Invalid HTTP/3 response.');const response=JSON.parse((await reader.read(length)).toString());reader.release();if(!response.ok)throw Object.assign(Error(response.error||'HTTP/3 CONNECT failed.'),{status:response.status,quota:response.quota});return socket;}catch(error){socket.destroy();throw error;}finally{clearTimeout(timer);}}
  stop(){this.stopped=true;for(const socket of this.sockets)socket.destroy();this.sockets.clear();if(this.child){this.child.stdin.end();this.child.kill();this.child=null;}}
}
class AdaptiveTunnel extends Tunnel {
  constructor(settings,log,onFatal,helper){super(settings,log,onFatal);this.helper=helper;this.protocol=settings.transport==='h2'||settings.upstream?.enabled&&settings.transport!=='h3'?'h2':null;this.worker=null;this.h3Opening=null;}
  get token(){return this._token;}set token(value){this._token=value;this.worker?.update(value);}
  async automaticSession(){
    const abort=this.automaticAbort=new AbortController();
    const h2=new Tunnel({...this.settings,transport:'h2'},()=>{},this.onFatal);
    h2.active=true;h2.candidate=this.candidate;h2.token=this.token;
    let candidateWorker;
    const winner=await raceHealthyPaths([
      {protocol:'h3',run:async signal=>{
        const config=await workerConfig({...this.settings,transport:'h3'},this.candidate);
        if(signal.aborted)throw Error('Connection cancelled');
        candidateWorker=new H3Worker(this.helper,{...config,token:this.token});
        signal.addEventListener('abort',()=>candidateWorker.stop(),{once:true});
        await candidateWorker.start();
        if(!net.isIP(candidateWorker.edgeIP))throw Error('Invalid HTTP/3 edge address.');
        await probePath((host,port)=>candidateWorker.open(host,port));
        return candidateWorker;
      }},
      {protocol:'h2',run:async signal=>{
        if(signal.aborted){h2.stop();throw Error('Connection cancelled');}
        signal.addEventListener('abort',()=>h2.stop(),{once:true});
        await h2.session();await probePath((host,port)=>h2.open(host,port));
        return h2.current;
      }}
    ],abort.signal);
    if(!this.active){candidateWorker?.stop();h2.stop();throw Error('Connection cancelled');}
    this.protocol=winner.protocol;
    if(winner.protocol==='h3'){this.worker=winner.value;this.edgeIP=this.worker.edgeIP;}
    else{
      const session=winner.value;h2.sessions.delete(session);h2.current=null;h2.stop();
      this.edgeIP=h2.edgeIP;
      this.current=session;this.sessions.add(session);
      session.on('goaway',()=>{if(this.current===session)this.current=null;});
      session.on('close',()=>{this.sessions.delete(session);if(this.current===session)this.current=null;});
    }
    this.log('info',`Automatic selected ${this.protocol==='h3'?'HTTP/3':'HTTP/2'} after a successful HTTPS response.`);
    return this.protocol==='h3'?{http3:true}:this.current;
  }
  async session(){
    if(this.protocol==='h2')return super.session();
    if(!this.active)throw Error('Tunnel is disconnected.');
    if(this.settings.transport==='h3'&&this.settings.upstream?.enabled)throw Error('HTTP/3 requires a direct UDP connection. Disable the upstream proxy or choose Automatic.');
    if(this.h3Opening)return this.h3Opening;
    const pending=this.settings.transport==='auto'&&!this.protocol?this.automaticSession():(async()=>{try{if(!this.worker||this.worker.dead){this.worker?.stop();const config=await workerConfig(this.settings,this.candidate);this.worker=new H3Worker(this.helper,{...config,token:this.token});await this.worker.start();if(!net.isIP(this.worker.edgeIP))throw Error('Invalid HTTP/3 edge address.');this.edgeIP=this.worker.edgeIP;}if(!this.active){this.worker.stop();throw Error('Tunnel is disconnected.');}this.protocol='h3';return {http3:true};}catch(error){this.worker?.stop();this.worker=null;if(this.settings.transport==='h3'||!this.active)throw error;this.protocol='h2';if(this.edgeIP)this.settings.edge=this.edgeIP;this.log('info','HTTP/3 unavailable on this network. Using HTTP/2 over TLS.');return super.session();}})();this.h3Opening=pending;
    try{return await pending;}finally{if(this.h3Opening===pending)this.h3Opening=null;}
  }
  async open(host,port){await this.session();if(this.protocol==='h2')return super.open(host,port);try{const socket=await this.worker.open(host,port);const push=socket.push,write=socket.write;socket.push=(chunk,...args)=>{if(chunk)this.down+=Buffer.byteLength(chunk);return push.call(socket,chunk,...args);};socket.write=(chunk,...args)=>{this.up+=Buffer.byteLength(chunk);return write.call(socket,chunk,...args);};return socket;}catch(error){if([401,403,429].includes(error.status)){this.onFatal(error);throw error;}if(this.settings.transport==='h3'||!this.active)throw error;this.worker?.stop();this.worker=null;this.protocol='h2';if(this.edgeIP)this.settings.edge=this.edgeIP;this.log('info','HTTP/3 interrupted. New connections will use HTTP/2 over TLS.');return super.open(host,port);}}
  stop(){this.automaticAbort?.abort();super.stop();this.worker?.stop();this.worker=null;}
}
module.exports={H3Worker,AdaptiveTunnel,workerConfig,connectionCandidates,raceHealthyPaths};
