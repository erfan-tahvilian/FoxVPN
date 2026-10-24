// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path');
function target(){const arch=process.env.FOX_TARGET_ARCH||process.arch;if(!['x64','arm64'].includes(arch))throw Error('Unsupported Linux architecture');return {arch,engine:arch==='x64'?'amd64':'arm64',cpu:arch==='x64'?62:183};}
function machine(file){const b=fs.readFileSync(file);if(b.toString('hex',0,4)!=='7f454c46'||b[4]!==2||b[5]!==1)throw Error('Expected a native little-endian 64-bit ELF executable');return b.readUInt16LE(18);}
function engineRoot(){return path.resolve('engine/linux',target().arch);}
function outputRoot(){return path.resolve('dist',target().arch==='x64'?'linux-unpacked':'linux-arm64-unpacked');}
module.exports={target,machine,engineRoot,outputRoot};
