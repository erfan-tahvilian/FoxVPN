const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const asar=require('@electron/asar');
const {target,machine,engineRoot,outputRoot}=require('./windows-target.cjs');
const root=outputRoot(),archive=path.join(root,'resources/app.asar');
function hash(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function packaged(file){return asar.extractFile(archive,file.split('/').join(path.sep));}
for(const file of ['src/main.cjs','src/preload.cjs','src/lib/auth.cjs','src/lib/control.cjs','src/lib/settings.cjs','src/lib/store.cjs','src/lib/tunnel.cjs','src/ui/index.html','src/ui/app.js','src/ui/styles.css','assets/logo.png','assets/logo-light.png','src/lib/latency.cjs','assets/icon.ico','licenses/GPL-3.0.txt','LICENSE'])assert.equal(hash(packaged(file)),hash(fs.readFileSync(file)),`Packaged file differs: ${file}`);
for(const file of fs.readdirSync('assets/flags'))assert.equal(hash(packaged('assets/flags/'+file)),hash(fs.readFileSync('assets/flags/'+file)));
for(const file of ['src/lib/applications.cjs','src/lib/list-apps.ps1','src/ui/desktop.js','assets/app-placeholder.svg'])assert.equal(hash(packaged(file)),hash(fs.readFileSync(file)),file);
for(const file of ['sing-box.exe','wintun.dll','LICENSE-sing-box.txt','LICENSE-wintun.txt','provenance.txt'])assert.equal(hash(fs.readFileSync(path.join(root,'resources/engine',file))),hash(fs.readFileSync(path.join(engineRoot(),file))),`Engine resource differs: ${file}`);
for(const file of ['Fox VPN.exe','resources/engine/sing-box.exe','resources/engine/wintun.dll'])assert.equal(machine(path.join(root,file)),target().machine,'Wrong executable architecture: '+file);
const executable=fs.readFileSync(path.join(root,'Fox VPN.exe'));
assert(executable.includes(Buffer.from('requireAdministrator')),'Administrator manifest missing');
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,require('../package.json').version);
console.log('Packaged source, logo, all country flags, engine, driver, licenses, version and Administrator manifest verified.');
