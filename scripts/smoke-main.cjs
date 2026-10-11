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
    assert(fs.existsSync('test-results/main-profile/vault.bin'));
    const reject=await win.webContents.executeJavaScript(`window.fox.call('settings',{socksPort:0})`);assert.equal(reject.ok,false);
    const noAuth=await win.webContents.executeJavaScript(`window.fox.call('account')`);assert.equal(noAuth.ok,false);
    const unknown=await win.webContents.executeJavaScript(`window.fox.call('openLink','not-allowed')`);assert.equal(unknown.ok,false);
    fs.writeFileSync('test-results/main-smoke-status.txt','PASS: real main process, sandboxed preload IPC, DPAPI vault, settings rejection, signed-out behavior and URL allowlist');
    console.log('Main-process smoke checks passed.');
  }catch(e){fs.writeFileSync('test-results/main-smoke-status.txt','FAIL: '+e.stack);}
  app.quit();
}
app.whenReady().then(()=>setTimeout(run,250));
