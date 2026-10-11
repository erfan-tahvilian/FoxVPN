const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Auth,hkdf,authPW,hawk}=require('../src/lib/auth.cjs');
const {candidates,solvePow}=require('../src/lib/control.cjs');
const {DEFAULTS,validate,engineConfig}=require('../src/lib/settings.cjs');
const {Store}=require('../src/lib/store.cjs');
test('HKDF expansion follows RFC 5869 semantics with a zero salt',()=>{
  const input=Buffer.alloc(22,0x0b),info=Buffer.from('test');
  const prk=crypto.createHmac('sha256',Buffer.alloc(32)).update(input).digest();
  const t1=crypto.createHmac('sha256',prk).update(Buffer.concat([info,Buffer.from([1])])).digest();
  const t2=crypto.createHmac('sha256',prk).update(Buffer.concat([t1,info,Buffer.from([2])])).digest();
  assert.deepEqual(hkdf(input,'test',42),Buffer.concat([t1,t2]).subarray(0,42));
});
test('Firefox auth derivation is case-sensitive and produces a 32-byte key',()=>{
  assert.match(authPW('user@example.com','password'),/^[a-f0-9]{64}$/);
  assert.notEqual(authPW('User@example.com','password'),authPW('user@example.com','password'));
});
test('Hawk signs the request path, payload and explicit port',()=>{
  const first=hawk('POST','https://api.accounts.firefox.com/v1/oauth/token','ab'.repeat(32),'{}',123,'nonce');
  assert.match(first,/^Hawk id="[a-f0-9]{64}", ts="123", nonce="nonce", mac="/);
  assert.notEqual(first,hawk('POST','https://api.accounts.firefox.com:8443/v1/oauth/token','ab'.repeat(32),'{}',123,'nonce'));
  assert.notEqual(first,hawk('POST','https://api.accounts.firefox.com/v1/oauth/token','ab'.repeat(32),'{"x":1}',123,'nonce'));
});
test('unverified sign-in stores no token until email verification succeeds',async()=>{
  const calls=[],store={auth:null,setAuth(auth){this.auth=auth;}};
  const http={async json(url,options){calls.push({url,options});return {data:url.endsWith('/account/login')?{sessionToken:'ab'.repeat(32),verified:false}:url.endsWith('/oauth/token')?{access_token:'access',refresh_token:'refresh',expires_in:3600}:{}};}};
  const auth=new Auth(http,store);
  assert.deepEqual(await auth.login('user@example.com','secret'),{needsCode:true});assert.equal(store.auth,null);
  await auth.verify('123456');assert.equal(store.auth.access_token,'access');assert.equal(auth.pending,null);
  assert(!JSON.stringify(calls).includes('secret'));
  assert(calls[1].options.authorization.startsWith('Hawk '));
});
test('transient token renewal preserves session; permanent rejection clears it',async()=>{
  const store={auth:{access_token:'old',refresh_token:'refresh',expiresAt:0},setAuth(a){this.auth=a;}};
  let status=503;const auth=new Auth({async json(){const e=Error('rejected');e.status=status;throw e;}},store);
  await assert.rejects(auth.token());assert(store.auth);status=401;await assert.rejects(auth.token());assert.equal(store.auth,null);
});
test('server parsing excludes quarantined and non-CONNECT endpoints',()=>{
  const result=candidates([{country:{code:'US',name:'United States',cities:[{code:'ny',name:'New York',servers:[{hostname:'bad',quarantined:true},{hostname:'wg',protocols:[{name:'wireguard'}]},{hostname:'fallback',port:443,protocols:[{name:'connect',host:'edge.example',port:8443}]}]}]}},{code:'ZZ',name:'CatchAll Anycast',cities:[{servers:[{hostname:'excluded'}]}]}]);
  assert.equal(result.length,1);assert.equal(result[0].host,'edge.example');assert.equal(result[0].port,8443);
});
test('proof of work returns the matching suffix and rejects an unsolved challenge',()=>{
  const hash=crypto.createHash('sha256').update('fixtureaB').digest('hex');assert.equal(solvePow('fixture',hash),'aB');assert.throws(()=>solvePow('fixture','invalid'));
});
test('network settings reject malformed ports, DNS IPs and executable names',()=>{
  for(const change of [{socksPort:0},{socksPort:1080.1},{customDns:'example.com'},{edge:'bad/host'},{excludedApps:['a.exe; Stop-Process']},{doh:'insecure'}])assert.throws(()=>validate({...DEFAULTS,...change}));
  assert.doesNotThrow(()=>validate({...DEFAULTS,customDns:'2606:4700:4700::1111',excludedApps:['chrome.exe','My App.exe']}));
});
test('TUN configuration routes private DNS through SOCKS and bypasses edge and excluded apps',()=>{
  const config=engineConfig({...DEFAULTS,excludedApps:['chrome.exe']},'203.0.113.1','2001:db8::1');
  assert.equal(config.dns.servers[0].detour,'fox');assert.equal(config.route.final,'fox');
  assert.deepEqual(config.inbounds[0].route_exclude_address,['203.0.113.1/32','2001:db8::1/128']);
  assert(config.route.rules.find(r=>r.process_name)?.process_name.includes('chrome.exe'));
  assert.equal(config.route.rules.at(-1).action,'reject');
  assert.equal(engineConfig({...DEFAULTS,customDns:'9.9.9.9'},'1.1.1.1').dns.servers[0].type,'tcp');
  const network=engineConfig({...DEFAULTS,doh:'off'},'1.1.1.1',null,'192.0.2.53');assert.equal(network.dns.servers[0].server,'192.0.2.53');assert.equal(network.dns.servers[0].detour,'direct');
});
test('credential vault encrypts on disk, redacts public passwords and rolls back failed saves',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fox-vault-test-'));
  const safe={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).map(v=>v^0x5a),decryptString:b=>Buffer.from(b.map(v=>v^0x5a)).toString()};
  try{const store=new Store(dir,safe);store.setAuth({access_token:'private-token'});store.setSettings({...DEFAULTS,upstream:{...DEFAULTS.upstream,password:'private-password'}});
    assert(!fs.readFileSync(path.join(dir,'vault.bin')).toString().includes('private-token'));assert.equal(store.publicSettings().upstream.password,'');assert.equal(new Store(dir,safe).auth.access_token,'private-token');
    safe.isEncryptionAvailable=()=>false;assert.throws(()=>store.setAuth(null));assert.equal(store.auth.access_token,'private-token');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
