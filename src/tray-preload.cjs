// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('trayUI',{
  call:action=>ipcRenderer.invoke('fox:tray',action),
  onState:callback=>ipcRenderer.on('fox:tray-state',(_event,state)=>callback(state))
});
