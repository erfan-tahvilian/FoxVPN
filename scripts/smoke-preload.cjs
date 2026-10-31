// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {contextBridge}=require('electron');
const {DEFAULTS}=require('../src/lib/settings.cjs');
const fs=require('node:fs'),path=require('node:path');
let state={version:'1.0.0',platform:process.platform,latencies:{},pinging:false,pingingIds:[],activeServer:null,settings:structuredClone(DEFAULTS),signedIn:false,email:'',servers:[],logs:[],connection:'disconnected',startedAt:null,exit:null,quota:null,lastError:null,up:0,down:0,systemDark:true,busy:false};const listeners=new Set();const listener=state=>{for(const callback of listeners)callback(state);};
const live=path.join(__dirname,'../test-results/live-servers.json');
state.servers=fs.existsSync(live)?JSON.parse(fs.readFileSync(live,'utf8')):[{id:'US/fixture/localhost:443',code:'US',country:'United States',city:'Fixture',cityCode:'fixture',host:'localhost',port:443}];
state.servers.push({id:'XX/auto/fixture:443',code:'XX',country:'Recomended Location',city:'Recomended City',cityCode:'auto',host:'fixture',port:443});
contextBridge.exposeInMainWorld('fox',{
  call:async(channel,...args)=>{
    if(channel==='releaseNotes')return {ok:true,data:{seen:true,items:[]}};
    if(channel==='checkUpdates')return {ok:true,data:{available:false,currentVersion:state.version,latestVersion:state.version}};
    if(channel==='apps')return {ok:true,data:[{id:process.platform==='darwin'?'Google Chrome':'chrome.exe',name:'Google Chrome'},{id:process.platform==='darwin'?'Firefox':'firefox.exe',name:'Firefox'}]};
    if(channel==='appIcon')return {ok:true,data:require('electron').nativeImage.createFromPath(path.join(__dirname,'../assets/logo-light.png')).resize({width:32}).toDataURL()};
    if(channel==='locationSort'){state.settings.locationSort=args[0];listener?.(state);}
    if(channel==='login'){state.signedIn=true;state.email='alice@example.com';listener?.(state);}
    if(channel==='theme'){state.settings.theme=args[0];listener?.(state);}
    if(channel==='settings'){state.settings=args[0];listener?.(state);}
    if(channel==='ping'){if(args[0])state.latencies[args[0]]={ms:7,measuredAt:Date.now()};else state.latencies=Object.fromEntries(state.servers.map((s,i)=>[s.id,{ms:i===0?null:20+i*9,measuredAt:Date.now()}]));listener?.(state);}
    if(channel==='connect'){state.connection='connected';state.activeServer=state.servers[0];state.exit={ip:'203.0.113.1',country:'CA'};listener?.(state);}
    if(channel==='select'){state.settings.serverId=args[0];listener?.(state);}
    return {ok:true,data:state};
  },onState:callback=>{listeners.add(callback);return ()=>listeners.delete(callback); }
});
