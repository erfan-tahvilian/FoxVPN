// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function updateTarget(platform,arch,executable,env=process.env){
  let format;
  if(platform==='win32')format=fs.existsSync(path.join(path.dirname(executable),'.foxvpn-installed'))?'exe':'zip';
  else if(platform==='darwin')format='dmg';
  else if(platform==='linux'){
    format='AppImage';
    if(!env.APPIMAGE){try{execFileSync('dpkg-query',['-S',executable],{stdio:'ignore',timeout:2000});format='deb';}catch{try{execFileSync('rpm',['-qf',executable],{stdio:'ignore',timeout:2000});format='rpm';}catch{}}}
  }
  return {platform,arch,format};
}
module.exports={updateTarget};
