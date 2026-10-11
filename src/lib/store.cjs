const fs=require('node:fs');
const path=require('node:path');
const {DEFAULTS,validate}=require('./settings.cjs');
class Store {
  constructor(directory, safeStorage) {
    this.directory=directory;this.safe=safeStorage;this.auth=null;this.settings=structuredClone(DEFAULTS);this.loadError=null;
    fs.mkdirSync(directory,{recursive:true});
    try{const data=this.read();if(data){this.auth=data.auth;this.settings=validate(data.settings);}}
    catch{this.loadError='Saved data could not be decrypted. Sign in again and review your settings.';}
  }
  read() {
    const file=path.join(this.directory,'vault.bin');
    if(!fs.existsSync(file))return null;
    if(!this.safe.isEncryptionAvailable())throw Error('Windows credential encryption is unavailable');
    return JSON.parse(this.safe.decryptString(fs.readFileSync(file)));
  }
  persist() {
    if(!this.safe.isEncryptionAvailable())throw Error('Windows credential encryption is unavailable. No credentials have been saved.');
    const file=path.join(this.directory,'vault.bin');
    fs.writeFileSync(file+'.tmp',this.safe.encryptString(JSON.stringify({auth:this.auth,settings:this.settings})));
    fs.renameSync(file+'.tmp',file);
  }
  setAuth(auth) {const old=this.auth;this.auth=auth;try{this.persist();}catch(e){this.auth=old;throw e;}}
  setSettings(settings) {const old=this.settings;this.settings=validate(settings);try{this.persist();}catch(e){this.settings=old;throw e;}}
  publicSettings() {return {...this.settings,upstream:{...this.settings.upstream,password:'',hasPassword:!!this.settings.upstream.password}};}
}
module.exports={Store};
