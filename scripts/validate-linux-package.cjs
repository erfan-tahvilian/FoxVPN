// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),asar=require('@electron/asar');
const {target,machine,engineRoot,outputRoot}=require('./linux-target.cjs'),root=outputRoot(),resources=path.join(root,'resources'),archive=path.join(resources,'app.asar');const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else assert.equal(hash(asar.extractFile(archive,file)),hash(fs.readFileSync(file)),file);}}
for(const dir of ['src','assets','licenses'])walk(dir);for(const file of ['LICENSE','COPYRIGHT'])assert.equal(hash(asar.extractFile(archive,file)),hash(fs.readFileSync(file)));
for(const file of ['sing-box','fox-h3','LICENSE-sing-box.txt','provenance.txt'])assert.equal(hash(fs.readFileSync(path.join(resources,'engine',file))),hash(fs.readFileSync(path.join(engineRoot(),file))),file);
for(const file of ['fox-vpn','resources/engine/sing-box','resources/engine/fox-h3']){assert.equal(machine(path.join(root,file)),target().cpu);assert(fs.statSync(path.join(root,file)).mode&0o111);}
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,'1.0.0');console.log('Linux source, licenses, native ELF architectures, executable permissions and version verified.');
