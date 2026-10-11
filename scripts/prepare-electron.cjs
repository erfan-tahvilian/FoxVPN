// Pin and verify a genuine Windows Electron distribution for each target.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {target,machine}=require('./windows-target.cjs');
async function main(){
  const t=target(),root=path.resolve('.tools/electron',t.arch),version=t.electron;
  const executable=path.join(root,'electron.exe');
  if(fs.existsSync(executable)&&fs.existsSync(path.join(root,'version'))&&fs.readFileSync(path.join(root,'version'),'utf8').trim()===version&&machine(executable)===t.machine)return;
  const name=`electron-v${version}-win32-${t.arch}.zip`,zip=path.resolve('.tools',name);
  fs.mkdirSync(path.dirname(zip),{recursive:true});
  let expected;
  if(version===require('../node_modules/electron/package.json').version)expected=require('../node_modules/electron/checksums.json')[name];
  else {
    const response=await fetch(`https://github.com/electron/electron/releases/download/v${version}/SHASUMS256.txt`);
    if(!response.ok)throw Error('Electron checksum metadata unavailable');
    expected=(await response.text()).split('\n').find(line=>line.trim().endsWith(name))?.trim().split(/\s+/)[0];
  }
  if(!expected)throw Error('Missing official Electron checksum');
  let b=fs.existsSync(zip)?fs.readFileSync(zip):null;
  if(!b||crypto.createHash('sha256').update(b).digest('hex')!==expected){
    const r=await fetch(`https://github.com/electron/electron/releases/download/v${version}/${name}`,{signal:AbortSignal.timeout(300000)});
    if(!r.ok)throw Error(`Electron download failed (${r.status})`);
    b=Buffer.from(await r.arrayBuffer());
    if(crypto.createHash('sha256').update(b).digest('hex')!==expected)throw Error('Electron checksum mismatch');
    fs.writeFileSync(zip,b);
  }
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${zip.replace(/'/g,"''")}' -DestinationPath '${root.replace(/'/g,"''")}' -Force`],{windowsHide:true});
  if(machine(executable)!==t.machine)throw Error('Electron architecture mismatch');
  console.log(`Electron ${version} (${t.label}) prepared; official checksum verified.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
