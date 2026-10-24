// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DEFAULTS,engineConfig}=require('../src/lib/settings.cjs');
const {engineRoot}=require(process.platform==='darwin'?'./mac-target.cjs':process.platform==='linux'?'./linux-target.cjs':'./windows-target.cjs');
const engine=path.join(engineRoot(),process.platform!=='win32'?'sing-box':'sing-box.exe');
fs.mkdirSync('test-results',{recursive:true});
for(const [name,settings] of Object.entries({default:DEFAULTS,include:{...DEFAULTS,splitMode:'include',excludedApps:[process.platform==='darwin'?'Safari':process.platform==='linux'?'firefox':'chrome.exe']},includeEmpty:{...DEFAULTS,splitMode:'include'},custom:{...DEFAULTS,customDns:'9.9.9.9',excludedApps:['chrome.exe']},off:{...DEFAULTS,doh:'off'},google:{...DEFAULTS,doh:'google'},quad9:{...DEFAULTS,doh:'quad9'}})){
  const file=path.resolve(`test-results/engine-${name}.json`);
  fs.writeFileSync(file,JSON.stringify(engineConfig(settings,'203.0.113.1',null,'192.0.2.53')));
  execFileSync(engine,['check','-c',file],{stdio:'inherit'});
}
console.log('All native engine configurations accepted by the pinned binary.');
