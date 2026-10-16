// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
fs.mkdirSync('test-results',{recursive:true});
app.setPath('userData',path.resolve('test-results/smoke-profile'));
app.setPath('sessionData',path.resolve('test-results/smoke-profile'));
function status(step){fs.writeFileSync('test-results/smoke-status.txt',step);}
status('Waiting for Electron readiness');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  status('Electron ready');
  const win=new BrowserWindow({width:1180,height:820,show:false,webPreferences:{preload:path.join(__dirname,'smoke-preload.cjs'),sandbox:false,contextIsolation:true,nodeIntegration:false}});
  const errors=[];win.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});
  try {
    await win.loadFile(path.join(__dirname,'../src/ui/index.html'));
    status('Renderer loaded');
    await win.webContents.executeJavaScript(`new Promise(r=>setTimeout(r,250))`);
    assert.equal(await win.webContents.executeJavaScript(`document.getElementById('status-label').textContent`),'Disconnected');
    assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.getElementById('verify-exit')).cursor`),'default');
    assert.equal(await win.webContents.executeJavaScript(`document.getElementById('server-sort').value`),'ping-asc');
    assert.deepEqual(await win.webContents.executeJavaScript(`[...document.querySelector('#server-sort').options].map(o=>o.value)`),['ping-asc','ping-desc','name-asc','name-desc']);
    assert(await win.webContents.executeJavaScript(`new Set([...document.querySelectorAll('[id]')].map(e=>e.id)).size===document.querySelectorAll('[id]').length`));
    fs.mkdirSync('test-results',{recursive:true});
    assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.engine-badge')`),null);
    assert(await win.webContents.executeJavaScript(`[...document.querySelectorAll('[data-theme-logo]')].every(i=>i.getAttribute('src').endsWith('logo-light.png'))`));
    fs.writeFileSync('test-results/overview-dark.png',(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript(`document.getElementById('theme-toggle').click();new Promise(r=>setTimeout(r,100))`);
    assert(await win.webContents.executeJavaScript(`document.body.classList.contains('light')`));
    assert.equal(await win.webContents.executeJavaScript(`document.querySelector('#theme-toggle use').getAttribute('href')`),'#glyph-moon');
    assert(await win.webContents.executeJavaScript(`[...document.querySelectorAll('[data-theme-logo]')].every(i=>i.getAttribute('src').endsWith('logo.png'))`));
    assert(await win.webContents.executeJavaScript(`(()=>{const r=document.querySelector('.globe-visual svg').getBoundingClientRect();return Math.abs(r.width-r.height)<1})()`));
    fs.writeFileSync('test-results/overview-light.png',(await win.webContents.capturePage()).toPNG());
    for(const page of ['locations','account','settings','logs']) {
      await win.webContents.executeJavaScript(`document.querySelector('[data-page="${page}"]').click()`);
      await win.webContents.executeJavaScript(`new Promise(r=>setTimeout(r,100))`);
      assert(await win.webContents.executeJavaScript(`document.getElementById('${page}').classList.contains('active')`));
      if(page==='locations')assert(await win.webContents.executeJavaScript(`document.querySelectorAll('.server-row .country-flag').length>0 && [...document.querySelectorAll('.server-row .country-flag')].every(i=>i.complete&&i.naturalWidth>0)`));
      if(page==='locations') {
        assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.server-row').length`),await win.webContents.executeJavaScript(`new Set(currentState.servers.filter(s=>!automaticServer(s)).map(s=>s.code+'/'+s.cityCode)).size`));
        await win.webContents.executeJavaScript(`document.getElementById('ping-servers').click();new Promise(r=>setTimeout(r,100))`);
        assert(await win.webContents.executeJavaScript(`[...document.querySelectorAll('.latency')].every(e=>/ms$|Unreachable/.test(e.textContent))`));
        for(const mode of ['name-asc','name-desc','ping-asc','ping-desc']) {
          await win.webContents.executeJavaScript(`document.getElementById('server-sort').value='${mode}';document.getElementById('server-sort').dispatchEvent(new Event('change'))`);
          assert(await win.webContents.executeJavaScript(`(()=>{const rows=[...document.querySelectorAll('.server-choice')],mode='${mode}';if(mode.startsWith('name')){const names=rows.map(e=>e.querySelector('strong').textContent);return names.every((name,i)=>i===0||(mode==='name-asc'?names[i-1].localeCompare(name)<=0:names[i-1].localeCompare(name)>=0));}const values=rows.map(e=>currentState.latencies[e.dataset.serverId]?.ms).filter(Number.isFinite);return values.every((value,i)=>i===0||(mode==='ping-asc'?values[i-1]<=value:values[i-1]>=value))&&rows.slice(values.length).every(e=>!Number.isFinite(currentState.latencies[e.dataset.serverId]?.ms));})()`));
        }
        assert(await win.webContents.executeJavaScript(`[...document.querySelectorAll('.server-row')].every(row=>row.children[1].classList.contains('server-ping')&&row.children[2].classList.contains('server-select'))`));
        const beforeSelection=await win.webContents.executeJavaScript(`currentState.settings.serverId`);
        await win.webContents.executeJavaScript(`document.querySelector('.server-row .server-ping').click();new Promise(r=>setTimeout(r,100))`);
        assert.equal(await win.webContents.executeJavaScript(`page`),'locations');
        assert.equal(await win.webContents.executeJavaScript(`currentState.settings.serverId`),beforeSelection);
        assert(await win.webContents.executeJavaScript(`[...document.querySelectorAll('.latency')].some(e=>e.textContent==='7 ms')`));
        await win.webContents.executeJavaScript(`document.getElementById('server-sort').value='name-asc';document.getElementById('server-sort').dispatchEvent(new Event('change'));new Promise(r=>setTimeout(r,150))`);
      }
      if(page==='settings') {
        assert.equal(await win.webContents.executeJavaScript(`document.querySelector('#settings-form button[type="submit"]')`),null);
        await win.webContents.executeJavaScript(`document.getElementById('split-mode').value='include';document.getElementById('split-mode').dispatchEvent(new Event('change',{bubbles:true}));new Promise(r=>setTimeout(r,100))`);
        assert.equal(await win.webContents.executeJavaScript(`currentState.settings.splitMode`),'include');
        await win.webContents.executeJavaScript(`document.getElementById('choose-apps').click();new Promise(r=>setTimeout(r,100))`);
        assert(await win.webContents.executeJavaScript(`document.querySelector('#app-picker').open&&document.querySelectorAll('.app-picker-row').length===2`));
        await win.webContents.executeJavaScript(`document.querySelector('.app-picker-row:last-child input').click();new Promise(r=>setTimeout(r,100))`);
        assert.equal(await win.webContents.executeJavaScript(`currentState.settings.excludedApps.length`),1);
        await win.webContents.executeJavaScript(`document.querySelector('#app-picker .primary').click();document.getElementById('choose-apps').click();new Promise(r=>setTimeout(r,100))`);
        assert(await win.webContents.executeJavaScript(`document.querySelector('.app-picker-row input').checked`));
        fs.writeFileSync('test-results/app-picker.png',(await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript(`document.querySelector('#app-picker input[type=search]').value='Chrome';document.querySelector('#app-picker input[type=search]').dispatchEvent(new Event('input'))`);
        assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.app-picker-row').length`),1);
        await win.webContents.executeJavaScript(`document.querySelector('#app-picker .primary').click()`);
        assert(await win.webContents.executeJavaScript(`[...document.querySelectorAll('select')].every(e=>e.hidden)&&document.querySelectorAll('[role=combobox]').length===document.querySelectorAll('select').length`));
        await win.webContents.executeJavaScript(`document.getElementById('theme-trigger').click()`);
        fs.writeFileSync('test-results/settings-dropdown.png',(await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript(`document.querySelector('#theme-menu .select-option:last-child').click()`);
        assert.equal(await win.webContents.executeJavaScript(`document.getElementById('theme').value`),'light');
        assert.equal(await win.webContents.executeJavaScript(`document.getElementById('theme-trigger').getAttribute('aria-expanded')`),'false');
      }
      fs.writeFileSync(`test-results/${page}.png`,(await win.webContents.capturePage()).toPNG());
    }
    await win.webContents.executeJavaScript(`document.querySelector('[data-page="locations"]').click(); document.querySelector('.server-choice').click(); new Promise(r=>setTimeout(r,100))`);
    await win.webContents.executeJavaScript(`window.fox.call('login',{});new Promise(r=>setTimeout(r,100))`);
    assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.avatar').textContent`),'A');
    assert(await win.webContents.executeJavaScript(`(()=>{const r=document.querySelector('.avatar').getBoundingClientRect();return Math.abs(r.width-r.height)<1&&getComputedStyle(document.body).userSelect==='none'})()`));
    assert(await win.webContents.executeJavaScript(`document.querySelector('#selected-symbol .country-flag').naturalWidth>0`));
    fs.writeFileSync('test-results/selected-location.png',(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript(`window.fox.call('select','REC').then(()=>window.fox.call('connect'));new Promise(r=>setTimeout(r,100))`);
    assert.equal(await win.webContents.executeJavaScript(`document.getElementById('selected-location').textContent`),'Canada');
    assert(await win.webContents.executeJavaScript(`document.getElementById('selected-detail').textContent.startsWith('Recommended · Connected to ')`));
    assert.equal(await win.webContents.executeJavaScript(`document.getElementById('exit-ipv4').textContent`),'203.0.113.1');
    assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.getElementById('verify-exit')).cursor`),'pointer');
    await win.webContents.executeJavaScript(`document.getElementById('ping-selected').click();new Promise(r=>setTimeout(r,100))`);
    assert.equal(await win.webContents.executeJavaScript(`document.getElementById('selected-latency').textContent`),'7 ms');
    assert.equal(await win.webContents.executeJavaScript(`locationLabel({country:'Germany',city:'Germany'})`),'Germany');
    assert.equal(await win.webContents.executeJavaScript(`locationLabel({country:'Germany',city:'Frankfurt'})`),'Germany, Frankfurt');
    assert.equal(await win.webContents.executeJavaScript(`typeof require`),'undefined');
    assert(await win.webContents.executeJavaScript(`!!(document.getElementById('exitCheck').compareDocumentPosition(document.getElementById('proxyOnly')) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='../../android/ui/mobile.css';link.onload=resolve;link.onerror=reject;document.head.append(link)})`);
    win.setContentSize(360,800);
    await win.webContents.executeJavaScript(`document.getElementById('selected-location').textContent='United Kingdom';document.getElementById('selected-latency').textContent='Unreachable';new Promise(r=>setTimeout(r,100))`);
    assert(await win.webContents.executeJavaScript(`(()=>{const label=document.getElementById('selected-location'),heading=document.querySelector('.server-selector small');return label.scrollWidth<=label.clientWidth && heading.scrollWidth<=heading.clientWidth})()`),'Android location name and heading should fit on one line');
    fs.writeFileSync('test-results/android-overview-compact.png',(await win.webContents.capturePage()).toPNG());
    assert.deepEqual(errors,[]);
    status('PASS: navigation, themes, renderer isolation and console checks');
    console.log('Renderer smoke checks passed: navigation, theme, account form, isolated renderer, no console errors.');
    app.exit(0);
  } catch(e){status('FAIL: '+e.stack);console.error(e);app.exit(1);}
});
