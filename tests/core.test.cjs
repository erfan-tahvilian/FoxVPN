// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
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
test('macOS split tunneling uses native process names and automatic utun allocation',()=>{
  const settings=validate({...DEFAULTS,excludedApps:['Google Chrome.app','Steam']},'darwin');
  const config=engineConfig(settings,'203.0.113.2',null,'192.0.2.53','darwin');
  assert.equal(config.inbounds[0].interface_name,undefined);
  const bypass=config.route.rules.find(r=>r.process_name).process_name;
  assert(bypass.includes('Google Chrome'));assert(bypass.includes('Steam'));assert(bypass.includes('sing-box'));
  assert(!bypass.includes('sing-box.exe'));
  for(const name of ['/Applications/App.app','bad; command','$(command)'])assert.throws(()=>validate({...DEFAULTS,excludedApps:[name]},'darwin'));
});
test('include mode routes only selected apps while keeping other TCP and UDP traffic direct',()=>{
  for(const [platform,selected,other,own] of [['win32','chrome.exe','other.exe','Fox VPN.exe'],['darwin','Google Chrome','Safari','Fox VPN']]){
    const config=engineConfig({...DEFAULTS,splitMode:'include',excludedApps:[selected]},'203.0.113.2',null,null,platform);
    const route=(name,network)=>config.route.rules.find(rule=>rule.process_name?.includes(name)&&(!rule.network||rule.network===network));
    assert.equal(config.route.final,'direct');assert.equal(route(selected,'tcp').outbound,'fox');assert.equal(route(selected,'udp').action,'reject');assert.equal(route(own,'tcp').outbound,'direct');assert.equal(route(other,'tcp'),undefined);assert.equal(route(other,'udp'),undefined);
    const empty=engineConfig({...DEFAULTS,splitMode:'include'},'203.0.113.2',null,null,platform);
    assert(!empty.route.rules.some(rule=>rule.outbound==='fox'));
  }
});
test('location order and split mode migrate safely and survive a vault reload',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fox-preferences-'));
  const safe={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()};
  try{
    const old={...DEFAULTS};delete old.locationSort;delete old.splitMode;
    fs.writeFileSync(path.join(dir,'vault.bin'),JSON.stringify({auth:null,settings:old}));
    const store=new Store(dir,safe);assert.equal(store.settings.locationSort,'ping-asc');assert.equal(store.settings.splitMode,'exclude');
    store.setSettings({...store.settings,locationSort:'name-desc',splitMode:'include',excludedApps:[process.platform==='darwin'?'Safari':'chrome.exe']});
    const reloaded=new Store(dir,safe);assert.equal(reloaded.settings.locationSort,'name-desc');assert.equal(reloaded.settings.splitMode,'include');assert.equal(reloaded.settings.excludedApps.length,1);
    assert.throws(()=>validate({...DEFAULTS,locationSort:'invalid'}));assert.throws(()=>validate({...DEFAULTS,splitMode:'invalid'}));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
