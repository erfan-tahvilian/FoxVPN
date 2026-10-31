// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {contextBridge,ipcRenderer}=require('electron');
const channels=['releaseNotes','ackReleaseNotes','checkUpdates','downloadUpdate','cancelAccountLogin','accountPreferences','selectAccount','removeAccount','state','login','verify','logout','servers','ping','account','activate','settings','theme','locationSort','apps','appIcon','select','connect','cancel','disconnect','exit','clearLogs','exportLogs','openLink'];
contextBridge.exposeInMainWorld('fox',{
  call:(channel,...args)=>{if(!channels.includes(channel))throw Error('Unsupported action');return ipcRenderer.invoke('fox:'+channel,...args);},
  onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('fox:state',listener);return ()=>ipcRenderer.removeListener('fox:state',listener);}
});
