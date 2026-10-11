const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const asar=require('@electron/asar');
const root=path.resolve('dist/win-unpacked'),archive=path.join(root,'resources/app.asar');
function hash(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
for(const file of ['src/main.cjs','src/preload.cjs','src/core/auth.cjs','src/core/control.cjs','src/core/settings.cjs','src/core/store.cjs','src/core/tunnel.cjs','src/ui/index.html','src/ui/app.js','src/ui/styles.css','assets/logo.png','assets/icon.ico','licenses/FoxyVPN-MIT.txt','licenses/GPL-3.0.txt'])assert.equal(hash(asar.extractFile(archive,file)),hash(fs.readFileSync(file)),`Packaged file differs: ${file}`);
for(const file of fs.readdirSync('assets/flags'))assert.equal(hash(asar.extractFile(archive,'assets/flags/'+file)),hash(fs.readFileSync('assets/flags/'+file)));
for(const file of ['sing-box.exe','wintun.dll','LICENSE-sing-box.txt','LICENSE-wintun.txt','provenance.txt'])assert.equal(hash(fs.readFileSync(path.join(root,'resources/engine',file))),hash(fs.readFileSync(path.join('engine',file))),`Engine resource differs: ${file}`);
const executable=fs.readFileSync(path.join(root,'Fox VPN.exe'));
assert(executable.includes(Buffer.from('requireAdministrator')),'Administrator manifest missing');
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,'1.0.0');
console.log('Packaged source, logo, all country flags, engine, driver, licenses, version and Administrator manifest verified.');
