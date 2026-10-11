const fs=require('node:fs'),path=require('node:path');
const targets={
  x64:{label:'x64',engine:'amd64',wintun:'amd64',electron:'44.7.0',machine:0x8664},
  ia32:{label:'x86',engine:'386',wintun:'x86',electron:'43.7.9',machine:0x014c},
  arm64:{label:'arm64',engine:'arm64',wintun:'arm64',electron:'44.7.0',machine:0xaa64}
};
function target(){const arch=process.env.FOX_TARGET_ARCH||process.arch;if(!targets[arch])throw Error('Unsupported Windows architecture: '+arch);return {arch,...targets[arch]};}
function machine(file){const b=fs.readFileSync(file);if(b.toString('ascii',0,2)!=='MZ')throw Error('Invalid Windows executable');const offset=b.readUInt32LE(0x3c);if(b.toString('ascii',offset,offset+4)!=='PE\u0000\u0000')throw Error('Invalid PE header');return b.readUInt16LE(offset+4);}
function engineRoot(){return path.resolve('engine',target().arch);}
function outputRoot(){const {arch}=target();return path.resolve('dist',arch==='x64'?'win-unpacked':`win-${arch}-unpacked`);}
module.exports={targets,target,machine,engineRoot,outputRoot};
