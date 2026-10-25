// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');
const https = require('node:https');
const http2 = require('node:http2');
const dgram = require('node:dgram');
const {SocksClient} = require('socks');
class Reader {
  constructor(socket) {
    this.socket=socket; this.buffer=Buffer.alloc(0); this.waiter=null; this.error=null;
    this.onData = data=>{this.buffer=Buffer.concat([this.buffer,data]); if(this.buffer.length>65536) socket.destroy(Error('SOCKS handshake too large')); this.pump();};
    this.onClose = ()=>{this.error=Error('Socket closed');this.pump();};
    socket.on('data',this.onData); socket.on('close',this.onClose);
  }
  pump() {
    if(!this.waiter) return;
    const {size,resolve,reject}=this.waiter;
    if(this.error) {this.waiter=null;reject(this.error);}
    else if(this.buffer.length>=size) {const data=this.buffer.subarray(0,size);this.buffer=this.buffer.subarray(size);this.waiter=null;resolve(data);}
  }
  read(size) {return new Promise((resolve,reject)=>{this.waiter={size,resolve,reject};this.pump();});}
  release() {this.socket.pause();this.socket.removeListener('data',this.onData);this.socket.removeListener('close',this.onClose);if(this.buffer.length)this.socket.unshift(this.buffer);}
}
async function address(reader, type) {
  if(type===1) return [...await reader.read(4)].join('.');
  if(type===3) return (await reader.read((await reader.read(1))[0])).toString();
  if(type===4) {const b=await reader.read(16);return Array.from({length:8},(_,i)=>b.readUInt16BE(i*2).toString(16)).join(':');}
  throw Error('Unsupported SOCKS address type');
}
async function rawSocket(host, port, proxy) {
  if(proxy.enabled && proxy.type==='socks5') {
    return (await SocksClient.createConnection({command:'connect',proxy:{host:proxy.host,port:proxy.port,type:5,userId:proxy.username,password:proxy.password},destination:{host,port},timeout:15000})).socket;
  }
  if(proxy.enabled && proxy.type==='http') {
    return new Promise((resolve,reject)=>{
      const authority=net.isIP(host)===6 ? `[${host}]:${port}` : `${host}:${port}`;
      const request=http.request({host:proxy.host,port:proxy.port,method:'CONNECT',path:authority,headers:{Host:authority,...(proxy.username ? {'Proxy-Authorization':'Basic '+Buffer.from(`${proxy.username}:${proxy.password || ''}`).toString('base64')} : {})}});
      request.setTimeout(15000,()=>request.destroy(Error('Upstream proxy timed out')));
      request.on('error',reject);
      request.on('connect',(response,socket,head)=>{if(response.statusCode!==200){socket.destroy();reject(Error(`Upstream proxy refused CONNECT (${response.statusCode})`));}else{if(head.length)socket.unshift(head);resolve(socket);}});
      request.end();
    });
  }
  return new Promise((resolve,reject)=>{const socket=net.connect({host,port});socket.setTimeout(15000,()=>socket.destroy(Error('Edge connection timed out')));socket.once('connect',()=>{socket.setTimeout(0);resolve(socket);});socket.once('error',reject);});
}
class Tunnel {
  constructor(settings, log, onFatal) {
    this.settings=settings;this.log=log;this.onFatal=onFatal;this.sessions=new Set();this.sockets=new Set();this.server=null;this.active=false;this.up=0;this.down=0;
  }
  async start(candidate, pass) {
    this.candidate=candidate;this.token=pass.token;this.active=true;
    await this.session();
    this.server=net.createServer(socket=>{
      this.sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>this.sockets.delete(socket));
      this.accept(socket).catch(()=>{if(!socket.destroyed)socket.end(Buffer.from([5,1,0,1,0,0,0,0,0,0]));});
    });
    await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(this.settings.socksPort,this.settings.bind,resolve);});
    this.log('info',`${this.protocol==='h3'?'HTTP/3':'HTTP/2'} tunnel ready · ${[candidate.country,candidate.city].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ')}`);
    this.keepalive=setInterval(()=>{for(const s of this.sessions)if(!s.closed&&!s.destroyed)s.ping((e)=>{if(e)s.destroy();});},20000);
  }
  async session() {
    if(!this.active)throw Error('Tunnel is disconnected');
    if(this.current && !this.current.closed && !this.current.destroyed) return this.current;
    if(this.opening)return this.opening;
    this.opening=this.openSession();
    try{return await this.opening;}finally{this.opening=null;}
  }
  async openSession() {
    const c=this.candidate;
    const raw=await rawSocket(this.edgeIP||this.settings.edge||c.host,c.port,this.settings.upstream);
    if(!this.active){raw.destroy();throw Error('Connection cancelled');}
    raw.setNoDelay(true);raw.setKeepAlive(true,30000);if(!this.settings.upstream.enabled)this.edgeIP=raw.remoteAddress?.replace(/^::ffff:/,'');
    const socket=tls.connect({socket:raw,servername:net.isIP(c.host)?undefined:c.host,ALPNProtocols:['h2'],rejectUnauthorized:true,checkServerIdentity:(_host,cert)=>tls.checkServerIdentity(c.host,cert)});
    await new Promise((resolve,reject)=>{socket.setTimeout(15000,()=>socket.destroy(Error('TLS handshake timed out')));socket.once('error',reject);socket.once('secureConnect',()=>{socket.setTimeout(0);if(socket.alpnProtocol!=='h2'){socket.destroy();reject(Error('The edge did not negotiate HTTP/2'));}else resolve();});});
    const s=http2.connect(`https://${c.host}:${c.port}`,{createConnection:()=>socket,settings:{initialWindowSize:4*1024*1024}});
    this.sessions.add(s);this.current=s;
    s.on('error',e=>this.log('warn',`Edge session: ${e.code || 'connection interrupted'}`));
    s.on('goaway',()=>{if(this.current===s)this.current=null;s.close();});
    s.on('close',()=>{this.sessions.delete(s);if(this.current===s)this.current=null;});
    await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('error',reject);});
    // Ensure enough aggregate receive credit on high-RTT paths without reducing
    // a larger window supplied by a newer runtime.
    s.setLocalWindowSize(Math.max(s.state.effectiveLocalWindowSize,8*1024*1024));
    if(!this.active){s.destroy();throw Error('Connection cancelled');}
    return s;
  }
  async open(host,port) {
    const s=await this.session();
    const stream=s.request({':method':'CONNECT',':authority':net.isIP(host)===6 ? `[${host}]:${port}` : `${host}:${port}`,'proxy-authorization':'Bearer '+this.token},{endStream:false});
    stream.on('error',()=>{});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{stream.close();reject(Error('CONNECT timed out'));},15000);
      const fail=e=>{clearTimeout(timer);reject(e);};
      stream.once('error',fail);stream.once('close',()=>fail(Error('CONNECT closed')));
      stream.once('response',headers=>{clearTimeout(timer);if(headers[':status']>=200 && headers[':status']<300)resolve();else{stream.close();if([401,403,429].includes(headers[':status'])){const error=Object.assign(Error('The proxy pass was rejected or the account quota was exhausted.'),{status:Number(headers[':status']),quota:{limit:headers['x-quota-limit'],remaining:headers['x-quota-remaining'],reset:headers['x-quota-reset']}});this.onFatal(error);}reject(Error(`CONNECT rejected (${headers[':status']})`));}});
    });
    // Count ingress without putting the stream into flowing mode before its consumer attaches.
    const originalPush=stream.push;
    stream.push=(chunk,...args)=>{if(chunk)this.down+=Buffer.byteLength(chunk);return originalPush.call(stream,chunk,...args);};
    const original=stream.write;
    stream.write=(chunk,...args)=>{this.up+=Buffer.byteLength(chunk);return original.call(stream,chunk,...args);};
    return stream;
  }
  async accept(socket) {
    socket.setTimeout(15000,()=>socket.destroy());
    const reader=new Reader(socket);
    const header=await reader.read(2);
    if(header[0]!==5)throw Error('SOCKS5 required');
    const methods=await reader.read(header[1]);
    if(!methods.includes(0)){socket.end(Buffer.from([5,255]));return;}
    socket.write(Buffer.from([5,0]));
    const request=await reader.read(4);
    if(request[0]!==5 || request[2]!==0)throw Error('Invalid SOCKS request');
    const host=await address(reader,request[3]);const port=(await reader.read(2)).readUInt16BE();
    if(request[1]===3) {reader.release();await this.udp(socket);socket.setTimeout(0);socket.resume();return;}
    if(request[1]!==1){socket.end(Buffer.from([5,7,0,1,0,0,0,0,0,0]));return;}
    reader.release();
    const stream=await this.open(host,port);
    socket.setTimeout(0);socket.write(Buffer.from([5,0,0,1,127,0,0,1,0,0]));
    socket.on('error',()=>stream.destroy());stream.on('error',()=>socket.destroy());
    socket.once('close',()=>stream.destroy());stream.once('close',()=>socket.destroy());
    socket.pipe(stream);stream.pipe(socket);socket.resume();
  }
  createProbeAgent(url) {
    const u=new URL(url),host=u.hostname.replace(/^\[|\]$/g,'');
    const agent=new https.Agent({keepAlive:true,maxSockets:1});
    agent.createConnection=(_options,callback)=>{
      this.open(host,Number(u.port)||443).then(stream=>{
        let finished=false;const done=(err,socket)=>{if(!finished){finished=true;callback(err,socket);}};
        const socket=tls.connect({socket:stream,servername:net.isIP(host)?undefined:host,rejectUnauthorized:true,checkServerIdentity:(_host,cert)=>tls.checkServerIdentity(host,cert)});
        socket.once('secureConnect',()=>done(null,socket));socket.once('error',done);
      },callback);
    };
    return agent;
  }
  async request(url, body, contentType, options={}) {
    const u=new URL(url), host=u.hostname.replace(/^\[|\]$/g,'');
    const stream=options.agent?null:await this.open(host,Number(u.port)||443);
    const agent=options.agent||new https.Agent({keepAlive:false});
    if(!options.agent)agent.createConnection=(_options,callback)=>{
      const socket=tls.connect({socket:stream,servername:net.isIP(host)?undefined:host,rejectUnauthorized:true,checkServerIdentity:(_host,cert)=>tls.checkServerIdentity(host,cert)});
      socket.once('secureConnect',()=>callback(null,socket));socket.once('error',callback);
    };
    try {
      return await new Promise((resolve,reject)=>{
        const req=https.request(u,{agent,method:body?'POST':'GET',headers:body?{'Content-Type':contentType,Accept:contentType,'Content-Length':body.length}:{}},res=>{
          if(!(options.statuses||[200]).includes(res.statusCode)){res.resume();reject(Error(`Tunneled request failed (${res.statusCode})`));return;}
          let size=0;const chunks=[];res.on('data',b=>{size+=b.length;if(size>1024*1024)req.destroy(Error('Response too large'));else chunks.push(b);});res.on('end',()=>resolve(Buffer.concat(chunks)));res.on('error',reject);
        });req.setTimeout(15000,()=>req.destroy(Error('Tunneled request timed out')));req.on('error',reject);req.end(body);
      });
    } finally {if(!options.agent){agent.destroy();stream.destroy();}}
  }
  async dns(query, host) {
    const providers={automatic:['1.1.1.1','8.8.8.8','9.9.9.9'],cloudflare:['1.1.1.1'],google:['8.8.8.8'],quad9:['9.9.9.9']};
    const targets=providers[this.settings.doh];
    if(targets && !this.settings.customDns) {
      for(const ip of targets)try{return await this.request(`https://${ip}/dns-query`,query,'application/dns-message');}catch{/* Try the next encrypted provider. */}
      throw Error('Encrypted DNS providers are unreachable');
    }
    const s=await this.open(this.settings.customDns || host,53);
    try {
      const reader=new Reader(s);const n=Buffer.alloc(2);n.writeUInt16BE(query.length);s.write(Buffer.concat([n,query]));
      const timer=setTimeout(()=>s.destroy(),10000);
      try{const size=(await reader.read(2)).readUInt16BE();if(size>4096)throw Error('DNS response too large');return await reader.read(size);}finally{clearTimeout(timer);reader.release();}
    } finally{s.destroy();}
  }
  async udp(socket) {
    const udp=dgram.createSocket('udp4');let active=0;
    udp.on('error',()=>socket.destroy());socket.once('close',()=>udp.close());
    await new Promise((resolve,reject)=>{udp.once('error',reject);udp.bind(0,this.settings.bind,resolve);});
    const response=Buffer.from([5,0,0,1,127,0,0,1,0,0]);
    const local=socket.localAddress?.replace(/^::ffff:/,'');if(net.isIP(local)===4)Buffer.from(local.split('.').map(Number)).copy(response,4);
    response.writeUInt16BE(udp.address().port,8);socket.write(response);
    udp.on('message',async(data,remote)=>{
      if(remote.address!==socket.remoteAddress || active>=32 || data.length>4352 || data[0]!==0 || data[1]!==0 || data[2]!==0)return;
      let offset=4,host;
      if(data[3]===1 && data.length>=10){host=[...data.subarray(4,8)].join('.');offset=8;}
      else if(data[3]===3 && data.length>=7+data[4]){host=data.subarray(5,5+data[4]).toString();offset=5+data[4];}
      else if(data[3]===4 && data.length>=22){host=Array.from({length:8},(_,i)=>data.readUInt16BE(4+i*2).toString(16)).join(':');offset=20;}
      else return;
      if(data.readUInt16BE(offset)!==53)return; // The upstream service carries TCP and DNS only.
      offset+=2;const query=data.subarray(offset);if(query.length<12)return;
      active++;
      try{const answer=await this.dns(query,host);if(!socket.destroyed)udp.send(Buffer.concat([data.subarray(0,offset),answer]),remote.port,remote.address);}catch{/* Failed DNS queries time out at the caller. */}finally{active--;}
    });
  }
  async exit(expected) {
    const text=(await this.request('https://www.cloudflare.com/cdn-cgi/trace')).toString();
    const fields=Object.fromEntries(text.trim().split('\n').map(l=>l.split('=')));
    if(!net.isIP(fields.ip||'') || !/^[a-z]{2}$/i.test(fields.loc||''))throw Error('Exit verification returned no IP or country.');
    if(expected && expected!=='REC' && expected.toUpperCase()!==fields.loc.toUpperCase())throw Error(`Exit mismatch: expected ${expected}, received ${fields.loc}.`);
    return {ip:fields.ip,country:fields.loc,ipv4:net.isIP(fields.ip)===4?fields.ip:'',ipv6:net.isIP(fields.ip)===6?fields.ip:'',pending:true};
  }
  async addresses(base) {
    const result={...base};
    const family=result.ipv4?6:4;
    try {
      const address=family===4?'1.1.1.1':'[2606:4700:4700::1111]';
      const fields=Object.fromEntries((await this.request(`https://${address}/cdn-cgi/trace`)).toString().trim().split('\n').map(line=>line.split('=')));
      if(net.isIP(fields.ip||'')===family&&fields.loc?.toUpperCase()===base.country.toUpperCase())result[family===4?'ipv4':'ipv6']=fields.ip;
    } catch {/* A missing address family does not interrupt an established connection. */}
    return result;
  }
  stop() {
    this.active=false;clearInterval(this.keepalive);
    for(const socket of this.sockets)socket.destroy();this.sockets.clear();
    if(this.server){this.server.close();this.server=null;}
    for(const s of this.sessions)s.destroy();this.sessions.clear();this.current=null;
  }
}
module.exports={Tunnel, Reader, address, rawSocket};
