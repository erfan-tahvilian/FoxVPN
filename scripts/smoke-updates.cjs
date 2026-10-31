// SPDX-License-Identifier: GPL-3.0-or-later
const {app,BrowserWindow}=require('electron'),path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{const win=new BrowserWindow({show:false,width:360,height:800,webPreferences:{preload:path.join(__dirname,'updates-smoke-preload.cjs'),contextIsolation:true,sandbox:false,backgroundThrottling:false}}),js=s=>win.webContents.executeJavaScript(s);
  try{
    await win.loadFile(path.join(__dirname,'../src/ui/index.html'));
    const calls=await js(`window.fox.call('testCalls').then(r=>r.data)`);
    assert.equal(calls.filter(c=>c.channel==='checkUpdates').length,1,'Startup must check without a timer');
    assert.equal(calls.find(c=>c.channel==='checkUpdates').args[0],true,'Startup bypasses stale caches');
    assert(await js(`document.getElementById('release-highlights').open`));
    assert.equal(await js(`document.getElementById('update-dialog').open`),false,'Do not stack dialogs');
    await js(`document.getElementById('release-highlights').close();new Promise(r=>setTimeout(r,50))`);
    assert(await js(`document.getElementById('update-dialog').open`),'Offer immediately after highlights close');
    await js(`document.getElementById('update-dialog').close();window.dispatchEvent(new Event('online'));new Promise(r=>setTimeout(r,50))`);
    assert.equal(await js(`document.getElementById('update-dialog').open`),false,'Automatic offer once per session');
    await js(`document.getElementById('check-updates').click();new Promise(r=>setTimeout(r,50))`);
    assert(await js(`document.getElementById('update-dialog').open`),'Manual check can reopen the offer');
    assert.equal(await js(`window.fox.call('testCalls').then(r=>r.data.filter(c=>c.channel==='downloadUpdate').length)`),0,'Checking must not start a download');
    await js(`document.getElementById('update-dialog').close();navigate('settings');new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='../../android/ui/mobile.css';link.onload=resolve;link.onerror=reject;document.head.append(link)})`);
    assert(await js(`(()=>{const check=document.getElementById('check-updates'),source=document.getElementById('source');return check.nextElementSibling===source&&source.getBoundingClientRect().top>=check.getBoundingClientRect().bottom+13})()`),'Mobile update action precedes GitHub with a separate row and gap');
    fs.writeFileSync('test-results/updates-about-mobile.png',(await win.webContents.capturePage()).toPNG());
    fs.writeFileSync('test-results/updates-smoke-status.txt','PASS: immediate fresh checks, dialog sequencing, session suppression, manual checks and mobile action order');app.exit(0);
  }catch(error){fs.writeFileSync('test-results/updates-smoke-status.txt','FAIL: '+error.stack);console.error(error);app.exit(1);}
});
