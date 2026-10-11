const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {target}=require('./windows-target.cjs');
const electron=path.resolve('.tools/electron',target().arch,'electron.exe');
for(const [script,status] of [['scripts/smoke.cjs','test-results/smoke-status.txt'],['scripts/smoke-main.cjs','test-results/main-smoke-status.txt']]){
  if(fs.existsSync(status))fs.unlinkSync(status);
  const run=spawnSync(electron,[script],{stdio:'inherit',timeout:60000,windowsHide:true});
  if(run.error||run.status!==0||!fs.existsSync(status)||!fs.readFileSync(status,'utf8').startsWith('PASS:')){
    console.error(run.error?.message || (fs.existsSync(status)?fs.readFileSync(status,'utf8'):'Smoke test did not complete'));process.exit(1);
  }
  console.log(fs.readFileSync(status,'utf8'));
}
