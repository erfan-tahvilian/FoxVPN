// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('test-results',{recursive:true});
app.setPath('userData',path.resolve('test-results/main-profile'));
app.setPath('sessionData',path.resolve('test-results/main-profile'));
app.disableHardwareAcceleration();
require('../src/main.cjs');
async function run(){
  const win=BrowserWindow.getAllWindows()[0];
  if(!win){setTimeout(run,100);return;}
  win.hide();
  if(win.webContents.isLoading())await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
  try{
    const state=await win.webContents.executeJavaScript(`window.fox.call('state')`);
    assert(state.ok);assert.equal(state.data.connection,'disconnected');assert.equal(state.data.signedIn,false);
    const theme=await win.webContents.executeJavaScript(`window.fox.call('theme','light')`);assert(theme.ok);
    assert((await win.webContents.executeJavaScript(`window.fox.call('locationSort','ping-desc')`)).ok);
    await win.webContents.executeJavaScript(`new Promise(r=>{location.reload();setTimeout(r,200)})`).catch(()=>{});
    if(win.webContents.isLoading())await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
    const persisted=await win.webContents.executeJavaScript(`window.fox.call('state')`);assert.equal(persisted.data.settings.locationSort,'ping-desc');
    const apps=await win.webContents.executeJavaScript(`window.fox.call('apps')`);assert(apps.ok&&Array.isArray(apps.data),apps.error||'Application catalog must return a list');
    if(apps.data.length){const image=await win.webContents.executeJavaScript(`window.fox.call('appIcon',${JSON.stringify(apps.data[0].id)})`);assert(image.ok&&(image.data===null||image.data.startsWith('data:image/')));}
    const deniedIcon=await win.webContents.executeJavaScript(`window.fox.call('appIcon','../../vault.bin')`);assert(deniedIcon.ok&&deniedIcon.data===null);
    assert(fs.existsSync('test-results/main-profile/vault.bin'));
    const reject=await win.webContents.executeJavaScript(`window.fox.call('settings',{socksPort:0})`);assert.equal(reject.ok,false);
    const noAuth=await win.webContents.executeJavaScript(`window.fox.call('account')`);assert.equal(noAuth.ok,false);
    const unknown=await win.webContents.executeJavaScript(`window.fox.call('openLink','not-allowed')`);assert.equal(unknown.ok,false);
    fs.writeFileSync('test-results/main-smoke-status.txt','PASS: real main process, sandboxed preload IPC, OS-encrypted vault, settings rejection, signed-out behavior and URL allowlist');
    console.log('Main-process smoke checks passed.');
  }catch(e){fs.writeFileSync('test-results/main-smoke-status.txt','FAIL: '+e.stack);}
  // Regression: quitting must finish even if a renderer vetoes normal closure.
  if(!win.isDestroyed())await win.webContents.executeJavaScript(`window.onbeforeunload=()=>false;void 0`);
  app.quit();
}
app.whenReady().then(()=>setTimeout(run,250));
