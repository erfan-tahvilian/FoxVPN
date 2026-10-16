// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {TrayPopup}=require('../src/tray.cjs');
app.disableHardwareAcceleration();app.setPath('userData',path.resolve('test-results/tray-profile'));
app.whenReady().then(async()=>{
  let state={version:'1.0.0',connection:'disconnected',light:false,signedIn:true,busy:false,location:''};
  const commands=[];
  const popup=new TrayPopup({state:()=>state,command:async action=>commands.push(action),bounds:()=>({x:100,y:100,width:20,height:20})});
  try{
    await popup.show();
    const js=code=>popup.window.webContents.executeJavaScript(code);
    assert.equal(await js(`document.getElementById('toggle-label').textContent`),'Connect');
    assert.equal(await js(`typeof require`),'undefined');
    state={...state,connection:'connected',light:true,location:'Germany, Frankfurt'};popup.update();
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await js(`document.getElementById('toggle-label').textContent`),'Disconnect');
    assert(await js(`document.body.classList.contains('light')`));
    assert.equal(await js(`document.getElementById('location').textContent`),'Germany, Frankfurt');
    fs.writeFileSync('test-results/tray-light.png',(await popup.window.webContents.capturePage()).toPNG());
    await assert.rejects(js(`window.trayUI.call('arbitrary-command')`),/Unsupported tray action/);
    const other=new BrowserWindow({show:false,webPreferences:{preload:path.resolve('src/tray-preload.cjs'),sandbox:true,nodeIntegration:false,contextIsolation:true}});
    await other.loadURL('about:blank');
    await assert.rejects(other.webContents.executeJavaScript(`window.trayUI.call('state')`),/Invalid tray sender/);other.destroy();
    await js(`window.trayUI.call('toggle')`);assert.deepEqual(commands,['toggle']);
    state={...state,connection:'disconnected',light:false};await popup.show();
    fs.writeFileSync('test-results/tray-dark.png',(await popup.window.webContents.capturePage()).toPNG());
    fs.writeFileSync('test-results/tray-smoke-status.txt','PASS: real tray popup, connection labels, appearance, restricted IPC sender and command allowlist');
    popup.destroy();app.exit(0);
  }catch(error){fs.writeFileSync('test-results/tray-smoke-status.txt','FAIL: '+error.stack);popup.destroy();app.exit(1);}
});
