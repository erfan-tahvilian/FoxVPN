// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {target,machine,engineRoot}=require('./mac-target.cjs');
const t=target();if(process.platform!=='darwin'||process.arch!==t.arch)throw Error('Build on the matching native macOS architecture');
if(machine(path.join(engineRoot(),'sing-box'))!==t.cpu)throw Error('Engine architecture mismatch');
const config={...require('../package.json').build,electronDist:'node_modules/electron/dist',artifactName:`FoxVPN-\${version}-macOS-${t.arch}.\${ext}`,extraResources:[{from:`engine/darwin/${t.arch}`,to:'engine',filter:['sing-box','fox-h3','LICENSE*','*.txt']}],mac:{target:['dmg','zip'],category:'public.app-category.utilities',icon:'assets/logo-light.png',minimumSystemVersion:'13.0.0',identity:'-',signIgnore:['/engine/(sing-box|fox-h3)$'],hardenedRuntime:false,notarize:false},dmg:{format:'UDBZ',sign:false,title:'Fox VPN',contents:[{x:140,y:180},{x:420,y:180,type:'link',path:'/Applications'}]}};
fs.mkdirSync('.tools',{recursive:true});const file=path.resolve('.tools/build-mac.json');fs.writeFileSync(file,JSON.stringify(config,null,2));
process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL='9';
execFileSync(process.execPath,[require.resolve('electron-builder/cli.js'),'--mac','dmg','zip','--'+t.arch,'--config',file,'--publish','never'],{stdio:'inherit'});
