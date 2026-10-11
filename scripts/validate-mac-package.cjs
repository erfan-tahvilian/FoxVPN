const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),asar=require('@electron/asar');
const {target,machine,engineRoot,outputRoot}=require('./mac-target.cjs');
const root=outputRoot(),resources=path.join(root,'Contents/Resources'),archive=path.join(resources,'app.asar'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else assert.equal(hash(asar.extractFile(archive,f)),hash(fs.readFileSync(f)),f);}}
for(const dir of ['src','assets','licenses'])walk(dir);assert.equal(hash(asar.extractFile(archive,'LICENSE')),hash(fs.readFileSync('LICENSE')));
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,'1.0.0');
for(const f of ['sing-box','LICENSE-sing-box.txt','provenance.txt'])assert.equal(hash(fs.readFileSync(path.join(resources,'engine',f))),hash(fs.readFileSync(path.join(engineRoot(),f))),f);
assert.equal(machine(path.join(resources,'engine/sing-box')),target().cpu);assert.equal(machine(path.join(root,'Contents/MacOS/Fox VPN')),target().cpu);
assert(!fs.existsSync(path.join(resources,'engine/wintun.dll')));assert(fs.statSync(path.join(resources,'engine/sing-box')).mode&0o111);
execFileSync('/usr/bin/plutil',['-lint',path.join(root,'Contents/Info.plist')],{stdio:'inherit'});
assert(fs.readdirSync(resources).some(f=>f.endsWith('.icns')));console.log('macOS app source, icons, flags, licenses, Mach-O architecture, engine permissions and version verified.');
