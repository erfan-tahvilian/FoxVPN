// SPDX-License-Identifier: GPL-3.0-or-later
const {contextBridge}=require('electron'),{DEFAULTS}=require('../src/lib/settings.cjs');
const calls=[],listeners=new Set();
const state={version:'1.0.2',platform:'android',signedIn:false,settings:structuredClone(DEFAULTS),servers:[],logs:[],latencies:{},pinging:false,pingingIds:[],connection:'disconnected',busy:false,systemDark:true,startedAt:null,up:0,down:0};
contextBridge.exposeInMainWorld('fox',{onState(fn){listeners.add(fn);return()=>listeners.delete(fn);},async call(channel,...args){calls.push({channel,args,at:Date.now()});let data=state;
  if(channel==='checkUpdates')data={available:true,currentVersion:'1.0.2',latestVersion:'1.0.3',size:1024,url:'https://github.com/erfan-tahvilian/FoxVPN/releases/download/v1.0.3/FoxVPN-1.0.3-Android-arm64-v8a.apk'};
  if(channel==='releaseNotes')data={seen:false,version:'1.0.2',items:[{title:'Welcome',description:'Release highlights fixture.'}]};
  if(channel==='testCalls')data=calls;
  return {ok:true,data};}});
// Reproduce the mobile About card before the shared update controls are set up.
window.addEventListener('DOMContentLoaded',()=>{const about=document.createElement('div');about.className='settings-card';about.dataset.appAbout='';const heading=document.createElement('h3');heading.textContent='About Fox VPN';about.append(heading,document.getElementById('source'));document.querySelector('.settings-footer').before(about);});
