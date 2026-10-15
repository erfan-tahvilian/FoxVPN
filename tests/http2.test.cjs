// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const net=require('node:net');
const http2=require('node:http2');
const https=require('node:https');
const {once}=require('node:events');
const {Tunnel}=require('../src/lib/tunnel.cjs');
const {DEFAULTS}=require('../src/lib/settings.cjs');
const cert=fs.readFileSync('tests/fixtures/localhost-cert.pem'),key=fs.readFileSync('tests/fixtures/localhost-test-key.pem');
test('real TLS + HTTP/2 CONNECT carries authenticated streams and nested HTTPS with certificate verification',async()=>{
  const target=https.createServer({cert,key},(_req,res)=>res.end('private-response'));
  target.listen(0,'127.0.0.1');await once(target,'listening');
  const edge=http2.createSecureServer({cert,key});let authenticated=0;
  const sessions=new Set();edge.on('session',s=>{sessions.add(s);s.on('error',()=>{});s.once('close',()=>sessions.delete(s));});
  edge.on('stream',(stream,headers)=>{
    stream.on('error',()=>{});
    if(headers[':method']!=='CONNECT'||headers['proxy-authorization']!=='Bearer fixture-pass'){stream.respond({':status':403});stream.end();return;}
    authenticated++;
    const [host,port]=headers[':authority'].split(':');
    assert.equal(host,'localhost');assert.equal(Number(port),target.address().port);
    const socket=net.connect(Number(port),'127.0.0.1');socket.on('error',()=>stream.destroy());
    socket.once('connect',()=>{stream.respond({':status':200});stream.pipe(socket);socket.pipe(stream);});
    stream.once('close',()=>socket.destroy());
  });
  edge.listen(0,'127.0.0.1');await once(edge,'listening');
  const tunnel=new Tunnel({...DEFAULTS,socksPort:0},()=>{},()=>{});
  try {
    await tunnel.start({host:'localhost',port:edge.address().port,city:'Fixture',country:'Test'},{token:'fixture-pass'});
    const response=await tunnel.request(`https://localhost:${target.address().port}/private`);
    assert.equal(response.toString(),'private-response');assert.equal(authenticated,1);assert(tunnel.up>0);assert(tunnel.down>0);
  } finally{tunnel.stop();for(const session of sessions)session.destroy();edge.close();target.closeAllConnections();target.close();}
});
test('exit verification refuses a mismatching selected country',async()=>{
  const tunnel=new Tunnel(DEFAULTS,()=>{},()=>{});tunnel.request=async()=>Buffer.from('ip=203.0.113.2\nloc=DE\n');
  await assert.rejects(tunnel.exit('US'),/Exit mismatch/);
  assert.deepEqual(await tunnel.exit(null),{ip:'203.0.113.2',country:'DE'});
});
