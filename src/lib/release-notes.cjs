// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path');
class ReleaseNotes {
  constructor({notes,version,platform,stateFile}){if(notes.version!==version||!Array.isArray(notes.items))throw Error('Release highlights do not match the app version');Object.assign(this,{notes,version,platform,stateFile});}
  read(){let seen=false;try{seen=JSON.parse(fs.readFileSync(this.stateFile,'utf8')).version===this.version;}catch{}return {version:this.version,seen,items:this.notes.items.filter(item=>item.platforms.includes(this.platform)).map(({title,description})=>({title,description}))};}
  acknowledge(){fs.mkdirSync(path.dirname(this.stateFile),{recursive:true});const temporary=this.stateFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify({version:this.version}));fs.renameSync(temporary,this.stateFile);}
}
module.exports={ReleaseNotes};
