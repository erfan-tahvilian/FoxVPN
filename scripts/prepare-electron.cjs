// Deterministic fallback for environments that disable npm lifecycle scripts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
async function main(){
  const root=path.resolve('node_modules/electron'),version=require(path.join(root,'package.json')).version;
  if(fs.existsSync(path.join(root,'dist/electron.exe')))return;
  const name=`electron-v${version}-win32-x64.zip`,zip=path.resolve('.tools',name);
  fs.mkdirSync(path.dirname(zip),{recursive:true});
  const r=await fetch(`https://github.com/electron/electron/releases/download/v${version}/${name}`,{signal:AbortSignal.timeout(300000)});
  if(!r.ok)throw Error(`Electron download failed (${r.status})`);
  const b=Buffer.from(await r.arrayBuffer());
  const expected=require(path.join(root,'checksums.json'))[name];
  if(crypto.createHash('sha256').update(b).digest('hex')!==expected)throw Error('Electron checksum mismatch');
  fs.writeFileSync(zip,b);
  const dist=path.join(root,'dist');
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${zip.replace(/'/g,"''")}' -DestinationPath '${dist.replace(/'/g,"''")}' -Force`],{windowsHide:true});
  fs.writeFileSync(path.join(root,'path.txt'),'electron.exe');
  console.log(`Electron ${version} prepared; official package checksum verified.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
