// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {target,machine,engineRoot}=require('./windows-target.cjs');
const t=target();
const electron=path.resolve('.tools/electron',t.arch);
for(const file of [path.join(electron,'electron.exe'),path.join(engineRoot(),'sing-box.exe'),path.join(engineRoot(),'wintun.dll')]){
  if(machine(file)!==t.machine)throw Error('Incorrect architecture: '+file);
}
const config=path.resolve('.tools',`build-${t.arch}.json`);
fs.mkdirSync(path.dirname(config),{recursive:true});
fs.writeFileSync(config,JSON.stringify({...require('../package.json').build,electronVersion:t.electron,electronDist:electron,artifactName:`FoxVPN-\${version}-Windows-${t.label}.\${ext}`},null,2));
execFileSync(process.execPath,[require.resolve('electron-builder/cli.js'),'--win','nsis','zip','--'+t.arch,'--config',config,'--publish','never'],{stdio:'inherit'});
