const {app,BrowserWindow,ipcMain,safeStorage,nativeTheme,dialog,Tray,Menu,shell}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const dns=require('node:dns').promises;
const net=require('node:net');
const {spawn,execFile}=require('node:child_process');
const {Store}=require('./lib/store.cjs');
const {Control,Guardian}=require('./lib/control.cjs');
const {Auth}=require('./lib/auth.cjs');
const {Tunnel}=require('./lib/tunnel.cjs');
const {measure,measureAll}=require('./lib/latency.cjs');
const {engineConfig}=require('./lib/settings.cjs');
let window,tray,store,guardian,tunnel,pendingTunnel,engine,refreshTimer,busy=false,quitting=false,generation=0;
let latencies={},pinging=false;const pingingIds=new Set();
let servers=[],logs=[],connection='disconnected',startedAt=null,exit=null,quota=null,lastError=null;
const icon=path.join(__dirname,'../assets/icon.ico');
function log(level,message) {
  // Do not write service responses, tokens, credentials or destination traffic to logs.
  const entry={time:new Date().toISOString(),level,message:String(message).slice(0,1000)};
  logs.push(entry);if(logs.length>1000)logs.shift();emit();
}
function state() {return {version:app.getVersion(),settings:store.publicSettings(),signedIn:!!store.auth,email:store.auth?.email || '',servers,latencies,pinging,pingingIds:[...pingingIds],activeServer:connection==='connected'?tunnel?.candidate:null,logs,connection,startedAt,exit,quota,lastError,up:tunnel?.up || 0,down:tunnel?.down || 0,systemDark:nativeTheme.shouldUseDarkColors,busy};}
function emit() {if(window&&!window.isDestroyed())window.webContents.send('fox:state',state());}
function engineDir() {return app.isPackaged?path.join(process.resourcesPath,'engine'):path.join(__dirname,'../engine',process.arch);}
async function admin() {
  return new Promise(resolve=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command','([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'],{windowsHide:true},(e,out)=>resolve(!e&&out.trim()==='True')));
}
async function refreshServers() {servers=await guardian.servers();log('info',`Updated server list · ${servers.length} available endpoints`);return servers;}
async function launchEngine(candidate, epoch) {
  const executable=path.join(engineDir(),'sing-box.exe');
  if(!fs.existsSync(executable)||!fs.existsSync(path.join(engineDir(),'wintun.dll')))throw Error('The Windows tunnel engine is missing. Reinstall Fox VPN.');
  if(!await admin())throw Error('System VPN mode requires Administrator access. Close Fox VPN and run it as administrator, or enable proxy-only mode.');
  const edgeHost=store.settings.edge||candidate.host;
  const edgeIP=(await dns.lookup(edgeHost)).address;
  const proxyIP=store.settings.upstream.enabled?(await dns.lookup(store.settings.upstream.host)).address:null;
  let networkDns;
  if(store.settings.doh==='off'&&!store.settings.customDns){
    networkDns=await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -or $_.IPv6DefaultGateway } | ForEach-Object { $_.DNSServer.ServerAddresses } | Select-Object -First 1"],{windowsHide:true,timeout:10000},(e,out)=>{const ip=out.trim();if(e||!net.isIP(ip))reject(Error('Cannot identify the network DNS resolver. Choose a DoH provider or custom DNS.'));else resolve(ip);}));
  }
  if(epoch!==generation)throw Error('Connection cancelled');
  const configPath=path.join(app.getPath('userData'),'tunnel.json');
  fs.writeFileSync(configPath,JSON.stringify(engineConfig(store.settings,edgeIP,proxyIP,networkDns),null,2));
  engine=spawn(executable,['run','-c',configPath],{cwd:engineDir(),windowsHide:true,stdio:['ignore','pipe','pipe']});
  const child=engine;
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{child.kill();reject(Error('The Windows tunnel engine did not become ready.'));},15000);
    const output=data=>{
      const text=data.toString();
      if(/sing-box started/.test(text)){clearTimeout(timeout);resolve();}
      if(/FATAL|ERROR/.test(text))log('warn','Windows tunnel engine reported an error. Check Administrator access and your network adapter.');
    };
    child.stdout.on('data',output);child.stderr.on('data',output);
    child.once('error',()=>{clearTimeout(timeout);reject(Error('Unable to start the Windows tunnel engine.'));});
    child.once('exit',code=>{clearTimeout(timeout);reject(Error(`Windows tunnel engine stopped (${code}).`));if(engine===child){engine=null;if(connection==='connected')fail(Error('The Windows tunnel engine stopped unexpectedly.'));}});
  });
  if(epoch!==generation)throw Error('Connection cancelled');
  log('info','Windows TUN adapter ready · system traffic routed through Fox VPN');
}
async function stopEngine() {
  const child=engine;engine=null;
  if(!child)return;
  await new Promise(resolve=>{const timeout=setTimeout(()=>{child.kill();resolve();},5000);child.once('exit',()=>{clearTimeout(timeout);resolve();});child.kill();});
}
async function disconnect() {
  generation++;pendingTunnel?.stop();pendingTunnel=null;
  clearTimeout(refreshTimer);refreshTimer=null;
  connection='disconnecting';emit();
  await stopEngine();tunnel?.stop();tunnel=null;connection='disconnected';startedAt=null;exit=null;
  log('info','Disconnected · Windows routes restored');
}
async function fail(error) {
  if(connection==='disconnecting'||connection==='disconnected')return;
  lastError=error.message;log('error',error.message);await disconnect();
}
function renew(pass) {
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{
    if(connection!=='connected')return;
    try{const fresh=await guardian.pass();if(connection!=='connected')return;tunnel.token=fresh.token;quota={limit:fresh.quotaLimit,remaining:fresh.quotaRemaining,reset:fresh.quotaReset};renew(fresh);log('info','Proxy pass renewed');}
    catch(e){await fail(Error('Proxy pass renewal failed. Reconnect after checking your account.'));}
  },Math.max(30000,Math.min(2147483647,pass.expiresAt-Date.now()-120000)));
}
async function connect() {
  if(connection!=='disconnected')return;
  const epoch=++generation;
  const check=()=>{if(epoch!==generation)throw Error('Connection cancelled');};
  connection='connecting';lastError=null;exit=null;emit();
  try {
    if(!store.auth)throw Error('Sign in to your Firefox account first.');
    if(!store.settings.proxyOnly&&!await admin())throw Error('Run Fox VPN as administrator for system VPN, or enable proxy-only mode in Settings.');
    if(!servers.length)await refreshServers();
    check();
    const id=store.settings.serverId;
    const list=id==='REC'?[...servers]:servers.filter(s=>s.id===id);
    if(!list.length)throw Error('This server is no longer available. Choose another location.');
    // Spread automatic selection across available edges; verify each attempted exit.
    if(id==='REC')list.sort(()=>Math.random()-.5);
    const pass=await guardian.pass();quota={limit:pass.quotaLimit,remaining:pass.quotaRemaining,reset:pass.quotaReset};
    check();
    let selected;
    for(const candidate of list.slice(0,5)) {
      const attempt=new Tunnel(structuredClone(store.settings),log,fail);
      pendingTunnel=attempt;
      try{await attempt.start(candidate,pass);check();if(store.settings.exitCheck||id==='REC')exit=await attempt.exit(id==='REC'?null:candidate.code);check();tunnel=attempt;pendingTunnel=null;selected=candidate;break;}
      catch(e){attempt.stop();pendingTunnel=null;check();lastError=e.message;log('warn',`Could not connect to ${candidate.city}, ${candidate.country}. Trying another endpoint.`);}
    }
    if(!selected)throw Error(lastError || 'No server could be reached.');
    if(!store.settings.proxyOnly)await launchEngine(selected,epoch);
    check();
    connection='connected';startedAt=Date.now();lastError=null;renew(pass);
    log('info',store.settings.proxyOnly?'Proxy-only mode active · configure your application to use the local SOCKS5 proxy':'Connected · Windows system VPN active');
  }catch(e){if(epoch===generation){lastError=e.message;log('error',e.message);await disconnect();}}
}
function handle(channel, fn) {
  ipcMain.handle('fox:'+channel,async(event,...args)=>{
    if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame)throw Error('Invalid sender');
    try{return {ok:true,data:await fn(...args)};}catch(e){return {ok:false,error:e.message || 'Operation failed'};}
  });
}
function createWindow() {
  window=new BrowserWindow({width:1180,height:800,minWidth:960,minHeight:700,backgroundColor:'#101117',title:'Fox VPN',icon,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.loadFile(path.join(__dirname,'ui/index.html'));
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
}
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{window?.show();window?.focus();});
  app.whenReady().then(()=>{
    store=new Store(app.getPath('userData'),safeStorage);
    const control=new Control();guardian=new Guardian(control,new Auth(control,store));
    createWindow();tray=new Tray(icon);tray.setToolTip('Fox VPN');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Fox VPN',click:()=>window.show()},{label:'Disconnect',click:()=>disconnect()},{type:'separator'},{label:'Quit Fox VPN',click:()=>app.quit()}]));tray.on('double-click',()=>window.show());
    handle('state',()=>state());
    handle('login',async({email,password})=>{if(busy)throw Error('An operation is already running.');busy=true;emit();try{return await guardian.auth.login(email,password);}finally{busy=false;emit();}});
    handle('verify',async code=>{if(busy)throw Error('An operation is already running.');busy=true;emit();try{return await guardian.auth.verify(code);}finally{busy=false;emit();}});
    handle('logout',async()=>{if(busy)throw Error('Wait for the current operation to finish.');await disconnect();store.setAuth(null);guardian.auth.pending=null;quota=null;emit();});
    handle('servers',refreshServers);
    handle('ping',async id=>{
      if(id!==undefined){
        const server=servers.find(s=>s.id===id);if(!server)throw Error('Unknown location.');
        if(pinging||pingingIds.has(id))throw Error('A latency check is already running for this location.');
        pingingIds.add(id);delete latencies[id];emit();
        try{const result=await measure(server);latencies[id]=result;return result;}
        finally{pingingIds.delete(id);emit();}
      }
      if(pinging||pingingIds.size)throw Error('Wait for the current location latency checks.');
      pinging=true;latencies={};emit();
      try{if(!servers.length)await refreshServers();await measureAll([...servers],(id,result)=>{latencies[id]=result;emit();});return latencies;}
      finally{pinging=false;emit();}
    });
    handle('account',()=>guardian.account());
    handle('activate',async()=>{const data=await guardian.request('activate','POST');return data.data;});
    handle('settings',async settings=>{if(connection!=='disconnected')throw Error('Disconnect before changing connection settings.');if(settings.clearUpstreamPassword&&settings.upstream)settings.upstream.password='';else if(settings.upstream?.password==='')settings.upstream.password=store.settings.upstream.password;delete settings.clearUpstreamPassword;store.setSettings(settings);emit();});
    handle('select',id=>{if(connection!=='disconnected')throw Error('Disconnect before choosing another server.');if(id!=='REC'&&!servers.some(s=>s.id===id))throw Error('Unknown server.');store.setSettings({...store.settings,serverId:id});emit();});
    handle('theme',theme=>{store.setSettings({...store.settings,theme});emit();});
    handle('connect',async()=>{if(busy)throw Error('Wait for the current operation.');busy=true;emit();try{await connect();}finally{busy=false;emit();}});
    handle('disconnect',async()=>{if(busy)throw Error('Wait for the current operation.');await disconnect();});
    handle('cancel',async()=>{if(connection==='connecting')await disconnect();});
    handle('exit',async()=>{if(connection!=='connected')throw Error('Connect before verifying your exit.');exit=await tunnel.exit(store.settings.serverId==='REC'?null:tunnel.candidate.code);emit();return exit;});
    handle('clearLogs',()=>{logs=[];emit();});
    handle('exportLogs',async()=>{const result=await dialog.showSaveDialog(window,{defaultPath:'FoxVPN-diagnostics.txt',filters:[{name:'Text files',extensions:['txt']}]});if(!result.canceled)fs.writeFileSync(result.filePath,logs.map(l=>`${l.time} [${l.level}] ${l.message}`).join('\n'));});
    handle('openLink',id=>{const urls={source:'https://github.com/erfan-tahvilian/FoxVPN',account:'https://accounts.firefox.com/',subscription:'https://vpn.mozilla.org/'};if(!urls[id])throw Error('Unknown link');return shell.openExternal(urls[id]);});
    nativeTheme.on('updated',emit);setInterval(emit,1000).unref();
    if(store.loadError)log('warn',store.loadError);
    refreshServers().catch(()=>log('warn','Server list is currently unreachable. Use Refresh in Locations to try again.'));
  });
  app.on('before-quit',event=>{if(quitting)return;event.preventDefault();quitting=true;disconnect().finally(()=>{tray?.destroy();app.quit();});});
  app.on('window-all-closed',()=>{});
}
