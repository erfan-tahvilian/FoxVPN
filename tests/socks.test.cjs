const {test}=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {PassThrough}=require('node:stream');
const {Tunnel,Reader}=require('../src/lib/tunnel.cjs');
const {DEFAULTS}=require('../src/lib/settings.cjs');
test('SOCKS5 handles fragmented negotiation, remote hostname and bidirectional data',async()=>{
  const tunnel=new Tunnel({...DEFAULTS,socksPort:0},()=>{},()=>{});
  tunnel.session=async()=>({});let requested;
  tunnel.open=async(host,port)=>{requested={host,port};return new PassThrough();};
  await tunnel.start({country:'Test',city:'Fixture'},{token:'fixture'});
  const socket=net.connect(tunnel.server.address().port,'127.0.0.1');socket.on('error',()=>{});
  const reader=new Reader(socket);
  try{
    socket.write(Buffer.from([5]));socket.write(Buffer.from([1,0]));assert.deepEqual(await reader.read(2),Buffer.from([5,0]));
    const host=Buffer.from('example.com'),port=Buffer.from([1,187]);
    socket.write(Buffer.concat([Buffer.from([5,1,0,3,host.length]),host,port]));assert.equal((await reader.read(10))[1],0);assert.deepEqual(requested,{host:'example.com',port:443});
    socket.write('encrypted-test-payload');assert.equal((await reader.read(22)).toString(),'encrypted-test-payload');
  }finally{socket.destroy();tunnel.stop();}
});
test('SOCKS5 refuses clients without a supported authentication method',async()=>{
  const tunnel=new Tunnel({...DEFAULTS,socksPort:0},()=>{},()=>{});tunnel.session=async()=>({});await tunnel.start({country:'Test',city:'Fixture'},{token:'fixture'});
  const socket=net.connect(tunnel.server.address().port,'127.0.0.1'),reader=new Reader(socket);socket.on('error',()=>{});
  try{socket.write(Buffer.from([5,1,2]));assert.deepEqual(await reader.read(2),Buffer.from([5,255]));}finally{socket.destroy();tunnel.stop();}
});
