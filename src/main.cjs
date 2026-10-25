// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {app,BrowserWindow,ipcMain,safeStorage,nativeTheme,dialog,Tray,Menu,shell,screen}=require('electron');
const {nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const dns=require('node:dns').promises;
const net=require('node:net');
const {spawn,execFile}=require('node:child_process');
const {Store}=require('./lib/store.cjs');
const {TrafficLedger}=require('./lib/traffic.cjs');
const {AccountCoordinator,knownEmpty,quotaFromPass}=require('./lib/accounts.cjs');
const {Control,Guardian}=require('./lib/control.cjs');
const {Auth}=require('./lib/auth.cjs');
const {Tunnel}=require('./lib/tunnel.cjs');
const {AdaptiveTunnel}=require('./lib/h3-tunnel.cjs');
function makeTunnel(settings,log,onFatal){return new AdaptiveTunnel(settings,log,onFatal,path.join(engineDir(),process.platform==='win32'?'fox-h3.exe':'fox-h3'));}
const {measure,measureAll}=require('./lib/latency.cjs');
const {engineConfig}=require('./lib/settings.cjs');
const {MacEngine,networkDns:macNetworkDns}=require('./lib/mac-engine.cjs');
const {LinuxEngine,networkDns:linuxNetworkDns}=require('./lib/linux-engine.cjs');
const {ApplicationCatalog}=require('./lib/applications.cjs');
const {TrayPopup}=require('./tray.cjs');
const applications=new ApplicationCatalog(app);
const mac=process.platform==='darwin',linux=process.platform==='linux';
const osName=mac?'macOS':linux?'Linux':'Windows';
const multiAccount=true;
let accountCoordinator,traffic,loginGuardian,loginAccountId,switchingAccount=false,trafficSaveWarning=false;const accountGuardians=new Map();
function accountGuardian(id){if(!accountGuardians.has(id)){const http=new Control();accountGuardians.set(id,new Guardian(http,new Auth(http,store.accountStore(id))));}return accountGuardians.get(id);}
function syncGuardian(){if(multiAccount&&store.activeAccountId)guardian=accountGuardian(store.activeAccountId);}
function observeTraffic(){if(multiAccount&&traffic&&tunnel)traffic.observe(tunnel.up,tunnel.down);}
async function refreshAccount(id){const data=await accountCoordinator.refresh(id);if(store.activeAccountId===id)quota=store.activeAccount?.quota||null;emit();return data;}
function beginLogin(){loginAccountId=null;const http=new Control(),sink={auth:null,setAuth(auth){if(!auth)return;loginAccountId=store.addAccount(auth,connection==='disconnected');this.auth=auth;}};loginGuardian=new Guardian(http,new Auth(http,sink));return loginGuardian.auth;}
function completeLogin(result){if(loginAccountId){syncGuardian();if(connection==='disconnected')quota=store.activeAccount?.quota||null;const id=loginAccountId;loginGuardian=null;loginAccountId=null;if(store.activeAccountId!==id)void refreshAccount(id).catch(()=>{});}return result;}
let macEngine;
let window,tray,trayPopup,store,guardian,tunnel,pendingTunnel,engine,refreshTimer,busy=false,quitting=false,generation=0;
let latencies={},pinging=false;const pingingIds=new Set();
let servers=[],logs=[],connection='disconnected',startedAt=null,exit=null,quota=null,lastError=null;
const icon=path.join(__dirname,mac||linux?'../assets/logo-light.png':'../assets/icon.ico');
function log(level,message) {
  // Do not write service responses, tokens, credentials or destination traffic to logs.
  const entry={time:new Date().toISOString(),level,message:String(message).slice(0,1000)};
  logs.push(entry);if(logs.length>1000)logs.shift();emit();
}
function state() {observeTraffic();return {...(multiAccount?{accounts:store.publicAccounts(),activeAccountId:store.activeAccountId,accountPreferences:store.accountPreferences,totalTraffic:traffic?.snapshot(),sessionDuration:traffic?.session.duration||0}:{}),version:app.getVersion(),platform:process.platform,settings:store.publicSettings(),signedIn:!!store.auth,email:store.auth?.email || '',servers,latencies,pinging,pingingIds:[...pingingIds],activeServer:connection==='connected'?tunnel?.candidate:null,logs,connection,startedAt,exit,quota,protocol:connection==='connected'?(tunnel?.protocol||'h2'):null,lastError,up:multiAccount?traffic?.session.up||0:tunnel?.up||0,down:multiAccount?traffic?.session.down||0:tunnel?.down||0,systemDark:nativeTheme.shouldUseDarkColors,busy};}
function emit() {if(quitting)return;if(store&&nativeTheme.themeSource!==store.settings.theme)nativeTheme.themeSource=store.settings.theme;if(window&&!window.isDestroyed())window.webContents.send('fox:state',state());trayPopup?.update();}
function trayState(){
  const server=tunnel?.candidate;
  const country=exit?.country?new Intl.DisplayNames(['en'],{type:'region'}).of(exit.country):server?.country;
  const city=server&&(!exit?.country||exit.country===server.code)?server.city:'';
  return {version:app.getVersion(),connection,signedIn:!!store.auth,busy,light:!nativeTheme.shouldUseDarkColors,location:[country,city].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ')};
}
async function trayCommand(action){
  if(action==='open'){showWindow();return;}
  if(action==='quit'){app.quit();return;}
  if(connection==='connecting'){await disconnect();return;}
  if(busy||connection==='disconnecting')return;
  if(connection==='connected'){await disconnect();return;}
  busy=true;emit();try{await connect();}finally{busy=false;emit();}
}

function showWindow() {
  if(quitting)return;
  if(!window||window.isDestroyed())createWindow();
  if(window.isMinimized())window.restore();
  window.show();window.focus();
}
function engineDir() {return app.isPackaged?path.join(process.resourcesPath,'engine'):path.join(__dirname,mac?'../engine/darwin':linux?'../engine/linux':'../engine',process.arch);}
async function admin() {
  return new Promise(resolve=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command','([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'],{windowsHide:true},(e,out)=>resolve(!e&&out.trim()==='True')));
}
async function refreshServers() {const next=await guardian.servers();store.setServers(next);servers=store.servers;log('info',`Updated server list · ${servers.length} available endpoints`);return servers;}
async function launchEngine(candidate, epoch) {
  const executable=path.join(engineDir(),mac||linux?'sing-box':'sing-box.exe');
  if(!fs.existsSync(executable)||(!mac&&!linux&&!fs.existsSync(path.join(engineDir(),'wintun.dll'))))throw Error('The tunnel engine is missing. Reinstall Fox VPN.');
  if(!mac&&!linux&&!await admin())throw Error('System VPN mode requires Administrator access. Close Fox VPN and run it as administrator, or enable proxy-only mode.');
  const edgeHost=store.settings.edge||candidate.host;
  const edgeIP=tunnel?.edgeIP||(await dns.lookup(edgeHost)).address;
  const proxyIP=store.settings.upstream.enabled?(await dns.lookup(store.settings.upstream.host)).address:null;
  let networkDns;
  if(store.settings.doh==='off'&&!store.settings.customDns){
    networkDns=mac?await macNetworkDns():linux?await linuxNetworkDns():await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -or $_.IPv6DefaultGateway } | ForEach-Object { $_.DNSServer.ServerAddresses } | Select-Object -First 1"],{windowsHide:true,timeout:10000},(e,out)=>{const ip=out.trim();if(e||!net.isIP(ip))reject(Error('Cannot identify the network DNS resolver. Choose a DoH provider or custom DNS.'));else resolve(ip);}));
  }
  if(epoch!==generation)throw Error('Connection cancelled');
  const config=engineConfig({...store.settings,excludedApps:await applications.expand(store.settings.excludedApps)},edgeIP,proxyIP,networkDns);
  if(mac||linux){
    const Controller=linux?LinuxEngine:MacEngine;
    const controller=new Controller(app.getPath('userData'),executable,()=>{if(macEngine===controller&&connection==='connected')fail(Error(`The ${osName} tunnel engine stopped unexpectedly.`));});
    macEngine=controller;await controller.start(config);
    if(epoch!==generation){await controller.stop();throw Error('Connection cancelled');}
    log('info',`${osName} tunnel adapter ready · system traffic routed through Fox VPN`);return;
  }
  const configPath=path.join(app.getPath('userData'),'tunnel.json');
  fs.writeFileSync(configPath,JSON.stringify(config,null,2));
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
  const controller=macEngine;macEngine=null;if(controller)await controller.stop();
  const child=engine;engine=null;
  if(!child)return;
  await new Promise(resolve=>{const timeout=setTimeout(()=>{child.kill();resolve();},5000);child.once('exit',()=>{clearTimeout(timeout);resolve();});child.kill();});
}
async function disconnect({keepSession=false}={}) {
  generation++;pendingTunnel?.stop();pendingTunnel=null;
  clearTimeout(refreshTimer);refreshTimer=null;
  connection='disconnecting';emit();
  observeTraffic();await stopEngine();observeTraffic();tunnel?.stop();tunnel=null;if(multiAccount&&traffic){if(keepSession)traffic.suspended=true;else traffic.finish();}connection='disconnected';startedAt=null;exit=null;
  log('info',`Disconnected · ${osName} routes restored`);
}
async function fail(error) {
  if(switchingAccount)return;
  if(connection==='disconnecting'||connection==='disconnected')return;
  if(multiAccount&&connection==='connected'&&store.accountPreferences.autoSwitch&&!switchingAccount&&[401,403,429].includes(error.status)){
    switchingAccount=true;const id=store.activeAccountId,epoch=generation;busy=true;emit();
    try{if(await accountCoordinator.confirmExhausted(id,error)&&generation===epoch&&connection==='connected'){
      log('info','Account data allowance exhausted. Switching to another saved account.');await disconnect({keepSession:true});
      const recoveryEpoch=generation;const prepared=await accountCoordinator.prepare({exclude:[id]});if(generation!==recoveryEpoch)return;syncGuardian();await connect({resumeTraffic:true,prepared});return;
    }}catch(e){lastError=e.message;log('error',e.message);await disconnect();return;}
    finally{switchingAccount=false;busy=false;emit();}
  }
  lastError=error.message;log('error',error.message);await disconnect();
}
function renew(pass) {
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{
    if(connection!=='connected')return;
    try{const epoch=generation,source=guardian;const fresh=await source.pass();if(connection!=='connected'||epoch!==generation)return;if(multiAccount){store.updateAccount(store.activeAccountId,{quota:quotaFromPass(fresh),status:knownEmpty(quotaFromPass(fresh))?'exhausted':'ready',checkedAt:Date.now()});if(knownEmpty(quotaFromPass(fresh))){await fail(Object.assign(Error('Account allowance exhausted.'),{status:429,quota:quotaFromPass(fresh)}));return;}}tunnel.token=fresh.token;quota={limit:fresh.quotaLimit,remaining:fresh.quotaRemaining,reset:fresh.quotaReset};renew(fresh);log('info','Proxy pass renewed');}
    catch(e){await fail(Object.assign(Error('Proxy pass renewal failed. Reconnect after checking your account.'),{status:e.status,quota:e.quota}));}
  },Math.max(30000,Math.min(2147483647,pass.expiresAt-Date.now()-120000)));
}
async function connect({resumeTraffic=false,prepared=null}={}) {
  if(connection!=='disconnected')return;
  const epoch=++generation;
  const check=()=>{if(epoch!==generation)throw Error('Connection cancelled');};
  connection='connecting';lastError=null;exit=null;emit();
  try {
    if(!store.auth)throw Error('Sign in to your Firefox account first.');
    if(!store.settings.proxyOnly&&store.settings.splitMode==='include'&&!store.settings.excludedApps.length)throw Error('Select at least one app in Split tunneling before connecting.');
    if(!mac&&!linux&&!store.settings.proxyOnly&&!await admin())throw Error('Run Fox VPN as administrator for system VPN, or enable proxy-only mode in Settings.');
    if(!servers.length)await refreshServers();
    check();
    const id=store.settings.serverId;
    const list=require('./lib/h3-tunnel.cjs').connectionCandidates(servers,id);
    if(!list.length)throw Error('This server is no longer available. Choose another location.');
    // The official REC edge provides anycast selection on Windows.
    const pass=multiAccount?(prepared||await accountCoordinator.prepare()).pass:await guardian.pass();syncGuardian();quota={limit:pass.quotaLimit,remaining:pass.quotaRemaining,reset:pass.quotaReset};
    check();
    let selected;
    for(const candidate of list.slice(0,5)) {
      const attempt=makeTunnel(structuredClone(store.settings),log,fail);
      pendingTunnel=attempt;
      try{await attempt.start(candidate,pass);check();exit=await attempt.exit(id==='REC'?null:candidate.code);check();tunnel=attempt;pendingTunnel=null;selected=candidate;break;}
      catch(e){attempt.stop();pendingTunnel=null;check();lastError=e.message;log('warn',`Could not connect to ${[candidate.country,candidate.city].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ')}. ${e.message}`);}
    }
    if(!selected)throw Error(lastError || 'No server could be reached.');
    if(!store.settings.proxyOnly)await launchEngine(selected,epoch);
    check();
    if(multiAccount)traffic.begin(resumeTraffic);connection='connected';startedAt=multiAccount?traffic.startedAt:Date.now();lastError=null;renew(pass);void refreshAddresses(tunnel,epoch);
    log('info',store.settings.proxyOnly?'Proxy-only mode active · configure your application to use the local SOCKS5 proxy':`Connected · ${osName} system VPN active`);
  }catch(e){if(epoch===generation){lastError=e.message;log('error',e.message);await disconnect();}}
}
async function refreshAddresses(active,epoch) {
  if(tunnel!==active||connection!=='connected')return;
  const base=exit?.ip?{...exit}:null;exit={...exit,pending:true};emit();
  let result=base;
  try{result=await active.addresses(base||await active.exit(null));}catch{/* No optional probe can invalidate an established tunnel. */}
  if(tunnel===active&&generation===epoch&&connection==='connected'){exit={...result,pending:false};emit();}
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
  window.on('closed',()=>{window=null;});
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
}
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{showWindow();});
  app.whenReady().then(()=>{
    if(mac)Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Fox VPN',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},{label:'File',submenu:[{label:'Close Window',accelerator:'Command+W',click:()=>{if(window&&!window.isDestroyed())window.close();}}]},{role:'editMenu'},{role:'windowMenu'}]));
    store=new Store(app.getPath('userData'),safeStorage);servers=store.servers;if(multiAccount){traffic=new TrafficLedger(store.traffic,value=>store.setTraffic(value));accountCoordinator=new AccountCoordinator(store,accountGuardian);quota=store.activeAccount?.quota||null;}
    const control=new Control();guardian=new Guardian(control,new Auth(control,store));
    syncGuardian();createWindow();tray=new Tray(mac||linux?nativeImage.createFromPath(icon).resize({width:22,height:22}):icon);tray.setToolTip('Fox VPN');
    trayPopup=new TrayPopup({state:trayState,command:trayCommand,bounds:()=>{const bounds=tray.getBounds();if(mac)return bounds;const point=screen.getCursorScreenPoint();return point.x>=bounds.x-8&&point.x<=bounds.x+bounds.width+8&&point.y>=bounds.y-8&&point.y<=bounds.y+bounds.height+8?bounds:{...point,width:0,height:0};}});
    const showTray=()=>trayPopup.show().catch(error=>log('warn',error.message));
    tray.on('right-click',showTray);tray.on('click',showTray);tray.on('double-click',()=>{trayPopup.hide();showWindow();});emit();
    handle('state',()=>state());
    handle('login',async({email,password})=>{if(busy)throw Error('An operation is already running.');busy=true;emit();try{return multiAccount?completeLogin(await beginLogin().login(email,password)):await guardian.auth.login(email,password);}finally{busy=false;emit();}});
    handle('verify',async code=>{if(busy)throw Error('An operation is already running.');busy=true;emit();try{if(multiAccount&&!loginGuardian)throw Error('Start account sign-in again.');return multiAccount?completeLogin(await loginGuardian.auth.verify(code)):await guardian.auth.verify(code);}finally{busy=false;emit();}});
    handle('logout',async()=>{if(busy)throw Error('Wait for the current operation to finish.');await disconnect();if(multiAccount){if(store.activeAccountId)store.removeAccount(store.activeAccountId);syncGuardian();}else{store.setAuth(null);guardian.auth.pending=null;}quota=multiAccount?store.activeAccount?.quota||null:null;emit();});
    handle('servers',refreshServers);
    handle('ping',async id=>{
      if(!store.auth)throw Error('Sign in before checking real delay.');
      const pass=await guardian.pass();
      const probe=server=>measure(server,structuredClone(store.settings),pass,5000,makeTunnel);
      if(id!==undefined){
        const server=servers.find(s=>s.id===id);if(!server)throw Error('Unknown location.');
        if(pinging||pingingIds.has(id))throw Error('A latency check is already running for this location.');
        pingingIds.add(id);delete latencies[id];emit();
        try{const result=await probe(server);latencies[id]=result;return result;}
        finally{pingingIds.delete(id);emit();}
      }
      if(pinging||pingingIds.size)throw Error('Wait for the current location latency checks.');
      pinging=true;latencies={};emit();
      try{if(!servers.length)await refreshServers();await measureAll([...servers],(id,result)=>{latencies[id]=result;emit();},3,probe);return latencies;}
      finally{pinging=false;emit();}
    });
    handle('account',()=>multiAccount?refreshAccount(store.activeAccountId):guardian.account());
    if(multiAccount){
      handle('cancelAccountLogin',()=>{if(loginGuardian)loginGuardian.auth.pending=null;loginGuardian=null;loginAccountId=null;});
      handle('accountPreferences',auto=>{store.setAccountPreferences(auto);emit();});
      handle('selectAccount',async id=>{if(busy)throw Error('Wait for the current operation.');const chosen=store.accounts.find(a=>a.id===id);if(!chosen?.auth)throw Error('Sign in to this account again.');busy=true;emit();try{const reconnect=connection==='connected';if(connection!=='disconnected')await disconnect();store.selectAccount(id);syncGuardian();quota=store.activeAccount?.quota||null;if(reconnect)await connect();}finally{busy=false;emit();}});
      handle('removeAccount',async id=>{if(busy)throw Error('Wait for the current operation.');if(id===store.activeAccountId&&connection!=='disconnected')throw Error('Disconnect before removing the active account.');store.removeAccount(id);accountGuardians.delete(id);syncGuardian();quota=store.activeAccount?.quota||null;emit();});
    }
    handle('activate',async()=>{const data=await guardian.request('activate','POST');return data.data;});
    handle('settings',async settings=>{if(connection!=='disconnected')throw Error('Disconnect before changing connection settings.');if(settings.clearUpstreamPassword&&settings.upstream)settings.upstream.password='';else if(settings.upstream?.password==='')settings.upstream.password=store.settings.upstream.password;delete settings.clearUpstreamPassword;store.setSettings({...settings,locationSort:store.settings.locationSort});emit();});
    handle('locationSort',locationSort=>{store.setSettings({...store.settings,locationSort});emit();});
    handle('apps',()=>applications.list());
    handle('appIcon',id=>applications.icon(id));
    handle('select',id=>{if(connection!=='disconnected')throw Error('Disconnect before choosing another server.');if(id!=='REC'&&!servers.some(s=>s.id===id))throw Error('Unknown server.');store.setSettings({...store.settings,serverId:id});emit();});
    handle('theme',theme=>{store.setSettings({...store.settings,theme});emit();});
    handle('connect',async()=>{if(busy)throw Error('Wait for the current operation.');busy=true;emit();try{await connect();}finally{busy=false;emit();}});
    handle('disconnect',async()=>{if(busy&&!switchingAccount)throw Error('Wait for the current operation.');await disconnect();});
    handle('cancel',async()=>{if(connection==='connecting')await disconnect();});
    handle('exit',async()=>{if(connection!=='connected')throw Error('Connect before verifying your connection.');const active=tunnel,epoch=generation;const result=await active.exit(store.settings.serverId==='REC'?null:active.candidate.code);if(tunnel!==active||epoch!==generation)throw Error('Connection changed while checking.');exit=result;emit();void refreshAddresses(active,epoch);return result;});
    handle('clearLogs',()=>{logs=[];emit();});
    handle('exportLogs',async()=>{const result=await dialog.showSaveDialog(window,{defaultPath:'FoxVPN-diagnostics.txt',filters:[{name:'Text files',extensions:['txt']}]});if(!result.canceled)fs.writeFileSync(result.filePath,logs.map(l=>`${l.time} [${l.level}] ${l.message}`).join('\n'));});
    handle('openLink',id=>{const urls={source:'https://github.com/erfan-tahvilian/FoxVPN',license:'https://github.com/erfan-tahvilian/FoxVPN/blob/main/LICENSE',account:'https://accounts.firefox.com/',accountSettings:'https://accounts.firefox.com/settings'};if(!urls[id])throw Error('Unknown link');return shell.openExternal(urls[id]);});
    nativeTheme.on('updated',emit);setInterval(()=>{if(multiAccount&&traffic){observeTraffic();try{traffic.checkpoint();trafficSaveWarning=false;}catch{if(!trafficSaveWarning){logs.push({time:new Date().toISOString(),level:'warn',message:'Traffic statistics could not be saved.'});trafficSaveWarning=true;}}}emit();},1000).unref();
    if(store.loadError)log('warn',store.loadError);
    refreshServers().catch(()=>log('warn','Locations could not be refreshed. Saved locations remain available; try Refresh again later.'));
  });
  app.on('before-quit',event=>{
    event.preventDefault();if(quitting)return;quitting=true;
    let finished=false;
    const finish=()=>{if(finished)return;finished=true;clearTimeout(deadline);try{trayPopup?.destroy();}catch{}trayPopup=null;try{if(tray&&!tray.isDestroyed())tray.destroy();}catch{}tray=null;app.exit(0);};
    // A second quit cycle can be cancelled by a window; exit once cleanup has
    // finished instead. Bound cleanup so a hung child cannot retain the app.
    const deadline=setTimeout(finish,10000);
    Promise.resolve().then(disconnect).catch(()=>{}).finally(finish);
  });
  app.on('activate',()=>{showWindow();});
  app.on('window-all-closed',()=>{});
}
