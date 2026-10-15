// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs').promises;
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const {DEFAULTS,validate}=require('./settings.cjs');
class ApplicationCatalog {
  constructor(app){this.app=app;this.entries=new Map();this.loading=null;this.loadedAt=0;this.icons=new Map();}
  async scan(){
    if(Date.now()-this.loadedAt<300000)return;
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      let entries=[];
      if(process.platform==='win32'){
        const source=await fs.readFile(path.join(__dirname,'list-apps.ps1'),'utf8');
        const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(source,'utf16le').toString('base64')],{windowsHide:true,timeout:45000,maxBuffer:8*1024*1024,encoding:'utf8'});
        const data=JSON.parse(stdout.replace(/^\uFEFF/,'').trim()||'[]');
        entries=Array.isArray(data)?data:[data];
      }else if(process.platform==='darwin'){
        const bundles=[];
        const walk=async(dir,depth)=>{for(const entry of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){
          if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
          const file=path.join(dir,entry.name);
          if(entry.name.endsWith('.app'))bundles.push(file);else if(depth>0)await walk(file,depth-1);
        }};
        for(const root of ['/Applications',path.join(os.homedir(),'Applications'),'/System/Applications'])await walk(root,2);
        for(let offset=0;offset<bundles.length;offset+=8)entries.push(...(await Promise.all(bundles.slice(offset,offset+8).map(file=>this.macBundle(file)))).filter(Boolean));
      }
      this.entries.clear();this.icons.clear();
      for(const entry of entries){
        if(!entry?.id||!entry.name||!path.isAbsolute(entry.path)||!Array.isArray(entry.processes))continue;
        try{validate({...DEFAULTS,excludedApps:[entry.id]});}catch{continue;}
        if(['fox vpn.exe','electron.exe','sing-box.exe','fox vpn','electron','sing-box'].includes(entry.id.toLowerCase()))continue;
        const key=process.platform==='win32'?entry.id.toLowerCase():entry.id;
        if(!this.entries.has(key))this.entries.set(key,entry);
      }
      this.loadedAt=Date.now();
    })();
    try{await this.loading;}finally{this.loading=null;}
  }
  async macBundle(file){
    try{
      const {stdout}=await run('/usr/bin/plutil',['-convert','json','-o','-',path.join(file,'Contents/Info.plist')],{timeout:5000,maxBuffer:1024*1024});
      const info=JSON.parse(stdout),id=info.CFBundleExecutable;
      if(!id||id.includes('/'))return null;
      const processes=[id];
      const helpers=async(dir,depth)=>{if(depth<0)return;for(const entry of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){
        if(!entry.isDirectory())continue;
        const nested=path.join(dir,entry.name);
        if(entry.name.endsWith('.app')){
          try{const result=await run('/usr/bin/plutil',['-convert','json','-o','-',path.join(nested,'Contents/Info.plist')],{timeout:3000,maxBuffer:1024*1024});const executable=JSON.parse(result.stdout).CFBundleExecutable;if(executable&&!executable.includes('/'))processes.push(executable);}catch{}
        }else await helpers(nested,depth-1);
      }};
      await helpers(path.join(file,'Contents/Frameworks'),4);
      return {id,name:info.CFBundleDisplayName||info.CFBundleName||path.basename(file,'.app'),path:file,processes:[...new Set(processes)]};
    }catch{return null;}
  }
  async list(){await this.scan();return [...this.entries.values()].map(({id,name})=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));}
  async icon(id){
    const entry=this.entries.get(process.platform==='win32'?String(id).toLowerCase():id);
    if(!entry)return null;
    if(!this.icons.has(entry.id))this.icons.set(entry.id,this.app.getFileIcon(entry.path,{size:'normal'}).then(image=>image.isEmpty()?null:image.toDataURL()).catch(()=>null));
    return this.icons.get(entry.id);
  }
  async expand(selected){
    if(process.platform!=='darwin'||!selected.length)return selected;
    await this.scan();
    return [...new Set(selected.flatMap(name=>this.entries.get(name.replace(/\.app$/i,''))?.processes||[name]))];
  }
}
module.exports={ApplicationCatalog};
