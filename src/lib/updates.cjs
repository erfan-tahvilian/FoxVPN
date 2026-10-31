// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path');
const API='https://api.github.com/repos/erfan-tahvilian/FoxVPN/releases/latest';
const BASE='https://github.com/erfan-tahvilian/FoxVPN/releases/download/';
const TTL=60*1000;
function parts(version){if(!/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(version))throw Error('Invalid release version');return version.split('.').map(Number);}
function newer(candidate,current){const a=parts(candidate),b=parts(current);for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;}
function assetName(version,{platform,arch,format}){
  parts(version);
  const names={win32:{x64:'x64',ia32:'x86',arm64:'arm64'},darwin:{x64:'x64',arm64:'arm64'},linux:{x64:'x64',arm64:'arm64'},android:{'arm64-v8a':'arm64-v8a','armeabi-v7a':'armeabi-v7a',x86_64:'x86_64',x86:'x86',universal:'universal'}};
  const cpu=names[platform]?.[arch],formats={win32:['exe','zip'],darwin:['dmg','zip'],linux:['AppImage','deb','rpm'],android:['apk']};
  if(!cpu||!formats[platform]?.includes(format))throw Error('No update package matches this installation.');
  return `FoxVPN-${version}-${{win32:'Windows',darwin:'macOS',linux:'Linux',android:'Android'}[platform]}-${cpu}.${format}`;
}
function selectRelease(release,current,target){
  const version=String(release.tag_name||'').replace(/^v/,'');parts(version);parts(current);
  if(release.tag_name!=='v'+version||release.draft||release.prerelease)throw Error('The latest stable release is unavailable.');
  const result={available:false,currentVersion:current,latestVersion:version};
  if(!newer(version,current))return result;
  const name=assetName(version,target),asset=release.assets?.find(a=>a.name===name),url=BASE+release.tag_name+'/'+name;
  if(!asset||asset.browser_download_url!==url||asset.state!=='uploaded'||!Number.isSafeInteger(asset.size)||asset.size<=0||!/^sha256:[a-f0-9]{64}$/.test(asset.digest||''))throw Error('The matching update package is not available yet.');
  return {...result,available:true,name,url,size:asset.size,sha256:asset.digest.slice(7)};
}
class Updates {
  constructor({version,target,fetch,cacheFile}){parts(version);assetName(version,target);Object.assign(this,{version,target,fetch,cacheFile});this.key=JSON.stringify([version,target]);}
  async check(force=false){if(this.pending)return this.pending;this.pending=this.load(force);try{return await this.pending;}finally{this.pending=null;}}
  async load(force){
    let cache;
    try{cache=JSON.parse(fs.readFileSync(this.cacheFile,'utf8'));if(cache.key!==this.key)cache=null;else selectRelease(cache.release,this.version,this.target);}catch{cache=null;}
    if(!force&&cache&&Date.now()-cache.at>=0&&Date.now()-cache.at<TTL)return selectRelease(cache.release,this.version,this.target);
    const etag=cache&&typeof cache.etag==='string'&&/^[\x20-\x7e]{1,256}$/.test(cache.etag)?cache.etag:null;
    const response=await this.fetch(API,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/vnd.github+json','User-Agent':'FoxVPN/'+this.version,'X-GitHub-Api-Version':'2022-11-28',...(etag?{'If-None-Match':etag}:{})}});
    let release;
    if(response.status===304&&cache)release=cache.release;
    else{if(!response.ok)throw Error('Could not check for updates. Try again later.');const raw=await response.text();if(raw.length>1024*1024)throw Error('Invalid update response.');release=JSON.parse(raw);}
    const result=selectRelease(release,this.version,this.target),value={key:this.key,at:Date.now(),etag:response.headers.get('etag')||etag,release};
    try{fs.mkdirSync(path.dirname(this.cacheFile),{recursive:true});const temporary=this.cacheFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value));fs.renameSync(temporary,this.cacheFile);}catch{}
    return result;
  }
}
module.exports={Updates,newer,assetName,selectRelease};
