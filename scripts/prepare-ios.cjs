// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'ios/Generated'),web=path.join(out,'Web');
fs.mkdirSync(web,{recursive:true});
for(const name of ['src/ui','assets','licenses'])fs.cpSync(path.join(root,name),path.join(web,name),{recursive:true});
for(const name of ['LICENSE','COPYRIGHT'])fs.copyFileSync(path.join(root,name),path.join(web,name));
let html=fs.readFileSync(path.join(web,'src/ui/index.html'),'utf8').replace('<script src="desktop.js"></script>','');
html=html.replace('<link rel="stylesheet" href="styles.css">','<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="mobile.css"><link rel="stylesheet" href="ios.css">');
html=html.replace('<script src="app.js"></script>','<script src="ios-bridge.js"></script><script src="app.js"></script>');
fs.writeFileSync(path.join(web,'src/ui/index.html'),html);
fs.copyFileSync(path.join(root,'android/ui/mobile.css'),path.join(web,'src/ui/mobile.css'));
for(const file of ['ios-bridge.js','ios.css'])fs.copyFileSync(path.join(root,'ios/UI',file),path.join(web,'src/ui',file));
fs.copyFileSync(path.join(root,'android/app/src/main/res/raw/cacert.pem'),path.join(out,'cacert.pem'));
console.log('iOS interface, country flags, branding, certificates and license assets prepared.');
