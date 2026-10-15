// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const {MacEngine}=require('../src/lib/mac-engine.cjs');const {DEFAULTS,engineConfig}=require('../src/lib/settings.cjs');const {engineRoot}=require('./mac-target.cjs');
async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'fox-mac-tun-'));
  const before=execFileSync('/sbin/ifconfig',['-l'],{encoding:'utf8'}).trim().split(/\s+/);
  let unexpected=false;const engine=new MacEngine(directory,path.join(engineRoot(),'sing-box'),()=>unexpected=true,command=>spawn('/usr/bin/sudo',['-n','/bin/sh','-c',command],{stdio:['ignore','ignore','pipe']}));
  const config=engineConfig(DEFAULTS,'203.0.113.1',null,'192.0.2.53');
  // Exercise a real root-owned utun adapter without changing the runner's
  // default route or requiring a production Firefox account.
  config.inbounds[0].auto_route=false;
  try{
    await engine.start(config);const after=execFileSync('/sbin/ifconfig',['-l'],{encoding:'utf8'}).trim().split(/\s+/),created=after.filter(n=>!before.includes(n)&&n.startsWith('utun'));
    assert.equal(created.length,1,'Native utun adapter was not created');assert(!unexpected);
    await engine.stop();const final=execFileSync('/sbin/ifconfig',['-l'],{encoding:'utf8'}).trim().split(/\s+/);assert(!final.includes(created[0]),'utun adapter remained after disconnect');
    console.log('Real privileged macOS utun creation, authenticated controller readiness and disconnect cleanup passed.');
  }finally{await engine.stop();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
