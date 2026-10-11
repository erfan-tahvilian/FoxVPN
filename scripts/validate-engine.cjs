const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DEFAULTS,engineConfig}=require('../src/core/settings.cjs');
const engine=path.resolve('engine/sing-box.exe');
fs.mkdirSync('test-results',{recursive:true});
for(const [name,settings] of Object.entries({default:DEFAULTS,custom:{...DEFAULTS,customDns:'9.9.9.9',excludedApps:['chrome.exe']},off:{...DEFAULTS,doh:'off'},google:{...DEFAULTS,doh:'google'},quad9:{...DEFAULTS,doh:'quad9'}})){
  const file=path.resolve(`test-results/engine-${name}.json`);
  fs.writeFileSync(file,JSON.stringify(engineConfig(settings,'203.0.113.1',null,'192.0.2.53')));
  execFileSync(engine,['check','-c',file],{stdio:'inherit'});
}
console.log('All Windows engine configurations accepted by the pinned binary.');
