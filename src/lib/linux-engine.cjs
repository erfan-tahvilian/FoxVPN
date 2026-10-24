// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),net=require('node:net');
const {spawn}=require('node:child_process');
const {MacEngine}=require('./mac-engine.cjs');
class LinuxEngine extends MacEngine {
  constructor(directory,executable,onExit,authorize){super(directory,executable,onExit,authorize||((command)=>spawn('/usr/bin/pkexec',['/bin/sh','-c',command],{cwd:'/',stdio:['ignore','ignore','pipe']})));}
  async start(config){try{return await super.start(config);}catch(error){if(error.message.startsWith('macOS VPN could not start'))throw Error('Linux VPN could not start. Approve the authentication prompt and check Polkit and /dev/net/tun.');throw error;}}
}
async function networkDns(){const text=await fs.promises.readFile('/etc/resolv.conf','utf8');const ip=text.match(/^nameserver\s+(\S+)/m)?.[1];if(!net.isIP(ip))throw Error('Cannot identify the network DNS resolver. Choose a DoH provider or custom DNS.');return ip;}
module.exports={LinuxEngine,networkDns};
