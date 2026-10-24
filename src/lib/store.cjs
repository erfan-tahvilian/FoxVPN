// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {randomUUID}=require('node:crypto');
const {DEFAULTS,validate}=require('./settings.cjs');
class Store {
  constructor(directory, safeStorage) {
    this.directory=directory;this.safe=safeStorage;this.accounts=[];this.activeAccountId=null;this.accountPreferences={autoSwitch:true};this.traffic=null;this.servers=[];this.settings=structuredClone(DEFAULTS);this.loadError=null;
    fs.mkdirSync(directory,{recursive:true});
    try{const data=this.read();if(data){this.accounts=Array.isArray(data.accounts)?data.accounts.filter(a=>a&&typeof a.id==='string'&&typeof a.email==='string'):data.auth?[{id:randomUUID(),email:data.auth.email||'',auth:data.auth,status:'ready',quota:null}]:[];this.activeAccountId=this.accounts.some(a=>a.id===data.activeAccountId)?data.activeAccountId:this.accounts.find(a=>a.auth)?.id||null;this.accountPreferences={autoSwitch:data.accountPreferences?.autoSwitch!==false};this.traffic=data.traffic||null;this.settings=validate(data.settings);this.servers=cachedServers(data.servers);}}
    catch{this.loadError='Saved data could not be decrypted. Sign in again and review your settings.';}
  }
  read() {
    const file=path.join(this.directory,'vault.bin');
    if(!fs.existsSync(file))return null;
    if(!this.safe.isEncryptionAvailable())throw Error('System credential encryption is unavailable');
    return JSON.parse(this.safe.decryptString(fs.readFileSync(file)));
  }
  persist() {
    if(!this.safe.isEncryptionAvailable())throw Error('System credential encryption is unavailable. No credentials have been saved.');
    const file=path.join(this.directory,'vault.bin');
    fs.writeFileSync(file+'.tmp',this.safe.encryptString(JSON.stringify({schemaVersion:2,auth:this.auth,accounts:this.accounts,activeAccountId:this.activeAccountId,accountPreferences:this.accountPreferences,traffic:this.traffic,settings:this.settings,servers:this.servers})));
    fs.renameSync(file+'.tmp',file);
  }
  setServers(servers) {const old=this.servers;this.servers=cachedServers(servers);if(!this.servers.length){this.servers=old;throw Error('No usable locations were received.');}try{this.persist();}catch(e){this.servers=old;throw e;}}
  get activeAccount(){return this.accounts.find(a=>a.id===this.activeAccountId)||null;}
  get auth(){return this.activeAccount?.auth||null;}
  mutateAccounts(change){const old=structuredClone({accounts:this.accounts,activeAccountId:this.activeAccountId,accountPreferences:this.accountPreferences});try{const result=change();this.persist();return result;}catch(e){Object.assign(this,old);throw e;}}
  addAccount(auth,activate=true){return this.mutateAccounts(()=>{const email=auth.email||'',existing=this.accounts.find(a=>a.email.toLowerCase()===email.toLowerCase());const profile=existing||{id:randomUUID(),email,quota:null};Object.assign(profile,{auth,email,status:'ready'});if(!existing)this.accounts.push(profile);if(activate||!this.activeAccountId)this.activeAccountId=profile.id;return profile.id;});}
  setAuth(auth){if(!this.activeAccountId){if(auth)this.addAccount(auth);return;}this.setAccountAuth(this.activeAccountId,auth);}
  setAccountAuth(id,auth){return this.mutateAccounts(()=>{const a=this.accounts.find(a=>a.id===id);if(!a)throw Error('Account was removed.');a.auth=auth;a.status=auth?'ready':'sign-in-required';if(auth?.email)a.email=auth.email;});}
  accountStore(id){const self=this;return {get auth(){return self.accounts.find(a=>a.id===id)?.auth||null;},setAuth(auth){self.setAccountAuth(id,auth);}};}
  selectAccount(id){return this.mutateAccounts(()=>{const a=this.accounts.find(a=>a.id===id);if(!a?.auth)throw Error('Sign in to this account again before using it.');this.activeAccountId=id;});}
  removeAccount(id){return this.mutateAccounts(()=>{if(!this.accounts.some(a=>a.id===id))throw Error('Account no longer exists.');this.accounts=this.accounts.filter(a=>a.id!==id);if(this.activeAccountId===id)this.activeAccountId=this.accounts.find(a=>a.auth)?.id||null;});}
  updateAccount(id,changes){return this.mutateAccounts(()=>{const a=this.accounts.find(a=>a.id===id);if(!a)throw Error('Account was removed.');for(const key of ['quota','status','checkedAt'])if(Object.hasOwn(changes,key))a[key]=changes[key];});}
  setAccountPreferences(autoSwitch){if(typeof autoSwitch!=='boolean')throw Error('Invalid account preference.');return this.mutateAccounts(()=>{this.accountPreferences.autoSwitch=autoSwitch;});}
  publicAccounts(){return this.accounts.map(({id,email,status,quota,checkedAt,auth})=>({id,email,status:auth?status:'sign-in-required',quota,checkedAt:checkedAt||null,active:id===this.activeAccountId}));}
  setTraffic(value){const old=this.traffic;this.traffic=value;try{this.persist();}catch(e){this.traffic=old;throw e;}}
  setSettings(settings) {const old=this.settings;this.settings=validate(settings);try{this.persist();}catch(e){this.settings=old;throw e;}}
  publicSettings() {return {...this.settings,upstream:{...this.settings.upstream,password:'',hasPassword:!!this.settings.upstream.password}};}
}
function cachedServers(value) {
  if(!Array.isArray(value)||value.length>2000)return [];
  return value.filter(s=>s&&typeof s.id==='string'&&s.id.length<=512&&typeof s.country==='string'&&typeof s.city==='string'&&typeof s.code==='string'&&/^[a-z]{2,3}$/i.test(s.code)&&typeof s.host==='string'&&s.host.length<=253&&(net.isIP(s.host)||/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(s.host))&&Number.isInteger(s.port)&&s.port>0&&s.port<=65535).map(s=>({id:s.id,country:s.country,code:s.code,city:s.city,cityCode:s.cityCode||'',host:s.host,port:s.port}));
}
module.exports={Store};
