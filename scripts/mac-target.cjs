// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs'),path=require('node:path');
function target(){const arch=process.env.FOX_TARGET_ARCH||process.arch;if(!['x64','arm64'].includes(arch))throw Error('Unsupported macOS architecture');return {arch,engine:arch==='x64'?'amd64':'arm64',cpu:arch==='x64'?0x01000007:0x0100000c};}
function machine(file){const b=fs.readFileSync(file);if(b.readUInt32LE(0)!==0xfeedfacf)throw Error('Expected a native 64-bit Mach-O executable: '+file);return b.readUInt32LE(4);}
function engineRoot(){return path.resolve('engine/darwin',target().arch);}
function outputRoot(){return path.resolve('dist',target().arch==='x64'?'mac':'mac-arm64','Fox VPN.app');}
module.exports={target,machine,engineRoot,outputRoot};
