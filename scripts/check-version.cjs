// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),assert=require('node:assert/strict');
const pkg=require('../package.json'),notes=require('../release-notes.json');
assert.match(pkg.version,/^\d+\.\d+\.\d+$/);assert.equal(require('../package-lock.json').version,pkg.version);assert.equal(require('../package-lock.json').packages[''].version,pkg.version);
assert.equal(notes.version,pkg.version);assert(notes.items.length);
for(const item of notes.items){assert(typeof item.title==='string'&&item.title.trim());assert(typeof item.description==='string'&&item.description.trim());assert(Array.isArray(item.platforms)&&item.platforms.every(p=>['win32','darwin','linux','android'].includes(p)));}
assert.equal(/const appVersion\s*=\s*"([^"]+)"/.exec(fs.readFileSync('android/core/mobile/updates.go','utf8'))?.[1],pkg.version);
const [major,minor,patch]=pkg.version.split('.').map(Number);assert(major<2000&&minor<1000&&patch<1000,'Android version-code components are out of range');
assert(major*1000000+minor*1000+patch>1);console.log(`Version ${pkg.version}, Android metadata and release highlights agree.`);
