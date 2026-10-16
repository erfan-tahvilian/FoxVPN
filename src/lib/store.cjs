// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {DEFAULTS,validate}=require('./settings.cjs');
class Store {
  constructor(directory, safeStorage) {
    this.directory=directory;this.safe=safeStorage;this.auth=null;this.servers=[];this.settings=structuredClone(DEFAULTS);this.loadError=null;
    fs.mkdirSync(directory,{recursive:true});
    try{const data=this.read();if(data){this.auth=data.auth;this.settings=validate(data.settings);this.servers=cachedServers(data.servers);}}
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
    fs.writeFileSync(file+'.tmp',this.safe.encryptString(JSON.stringify({auth:this.auth,settings:this.settings,servers:this.servers})));
    fs.renameSync(file+'.tmp',file);
  }
  setServers(servers) {const old=this.servers;this.servers=cachedServers(servers);if(!this.servers.length){this.servers=old;throw Error('No usable locations were received.');}try{this.persist();}catch(e){this.servers=old;throw e;}}
  setAuth(auth) {const old=this.auth;this.auth=auth;try{this.persist();}catch(e){this.auth=old;throw e;}}
  setSettings(settings) {const old=this.settings;this.settings=validate(settings);try{this.persist();}catch(e){this.settings=old;throw e;}}
  publicSettings() {return {...this.settings,upstream:{...this.settings.upstream,password:'',hasPassword:!!this.settings.upstream.password}};}
}
function cachedServers(value) {
  if(!Array.isArray(value)||value.length>2000)return [];
  return value.filter(s=>s&&typeof s.id==='string'&&s.id.length<=512&&typeof s.country==='string'&&typeof s.city==='string'&&typeof s.code==='string'&&/^[a-z]{2,3}$/i.test(s.code)&&typeof s.host==='string'&&s.host.length<=253&&(net.isIP(s.host)||/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(s.host))&&Number.isInteger(s.port)&&s.port>0&&s.port<=65535).map(s=>({id:s.id,country:s.country,code:s.code,city:s.city,cityCode:s.cityCode||'',host:s.host,port:s.port}));
}
module.exports={Store};
