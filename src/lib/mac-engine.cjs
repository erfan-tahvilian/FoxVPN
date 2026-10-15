// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const crypto=require('node:crypto');
const {spawn,execFile}=require('node:child_process');
const quote=value=>"'"+String(value).replace(/'/g,"'\\''")+"'";
function supervisor(executable,config,stop,parent) {
  if(!Number.isInteger(parent)||parent<=1)throw Error('Invalid supervisor parent');
  // No root-owned files are written into user-writable directories. The stop file
  // can only terminate this supervisor's own child, never a caller-supplied PID.
  return `${quote(executable)} run -c ${quote(config)} >/dev/null 2>&1 &\npid=$!\ntrap 'kill -TERM "$pid" 2>/dev/null; wait "$pid"' EXIT HUP INT TERM\nwhile kill -0 "$pid" 2>/dev/null; do\n  if ! kill -0 ${parent} 2>/dev/null || test -e ${quote(stop)}; then break; fi\n  /bin/sleep 1\ndone`;
}
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
class MacEngine {
  constructor(directory,executable,onExit,authorize){this.directory=directory;this.executable=executable;this.onExit=onExit;this.authorize=authorize;this.stopping=false;}
  async start(config){
    this.work=fs.mkdtempSync(path.join(this.directory,'mac-tunnel-'));fs.chmodSync(this.work,0o700);
    this.stopFile=path.join(this.work,'stop');const file=path.join(this.work,'config.json');
    const port=await freePort();if(this.stopping)return;const secret=crypto.randomBytes(32).toString('hex');
    config.experimental={clash_api:{external_controller:`127.0.0.1:${port}`,secret}};
    fs.writeFileSync(file,JSON.stringify(config),{mode:0o600});
    const command=supervisor(this.executable,file,this.stopFile,process.pid);
    if(this.authorize)this.child=this.authorize(command);
    else {
      this.child=spawn('/usr/bin/osascript',['-'],{stdio:['pipe','ignore','pipe']});
      this.child.stdin.end(`do shell script ${JSON.stringify(command)} with administrator privileges\n`);
    }
    this.closed=new Promise(resolve=>{
      this.child.once('error',()=>{this.ended=true;resolve();});
      this.child.once('exit',()=>{this.ended=true;resolve();if(!this.stopping)this.onExit();});
    });
    this.child.stderr?.resume();
    const deadline=Date.now()+120000;
    while(!this.ended&&!this.stopping&&Date.now()<deadline){
      try{const r=await fetch(`http://127.0.0.1:${port}/version`,{headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(1000)});if(r.ok)return;}
      catch{/* Wait for authorization and utun readiness. */}
      await new Promise(r=>setTimeout(r,200));
    }
    await this.stop();throw Error('macOS VPN could not start. Approve the administrator prompt and check that the engine is available.');
  }
  async stop(){
    this.stopping=true;if(this.stopFile&&fs.existsSync(this.work))fs.writeFileSync(this.stopFile,'stop',{mode:0o600});
    if(this.closed)await Promise.race([this.closed,new Promise(r=>setTimeout(r,7000))]);
    // Keep the marker until the root supervisor has exited, including if the
    // user is still deciding at an authorization dialog after cancellation.
    if(this.ended&&this.work)fs.rmSync(this.work,{recursive:true,force:true});
  }
}
async function networkDns(){return new Promise((resolve,reject)=>execFile('/usr/sbin/scutil',['--dns'],{timeout:10000},(error,out)=>{
  const ip=out?.match(/nameserver\[\d+\]\s*:\s*([^\s]+)/)?.[1];
  if(error||!net.isIP(ip))reject(Error('Cannot identify the network DNS resolver. Choose a DoH provider or custom DNS.'));else resolve(ip);
}));}
module.exports={MacEngine,supervisor,quote,networkDns};
