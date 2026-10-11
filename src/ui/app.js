const $=id=>document.getElementById(id);
let currentState=null, page='home', initialized=false, needsCode=false, lastLogs='',lastServers='',lastUp=0,lastDown=0,lastTick=Date.now(),toastTimer;
const labels={home:'Overview',locations:'Locations',account:'My account',settings:'Settings',logs:'Activity log'};
function toast(message) { $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500); }
async function call(channel,...args) {
  const result=await window.fox.call(channel,...args);
  if(!result.ok)throw Error(result.error);
  return result.data;
}
function action(fn) {return async event=>{try{await fn(event);}catch(e){toast(e.message);}};}
function navigate(next) {page=next;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===page));document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));$('page-label').textContent=labels[page];if(page==='locations')renderServers();if(page==='logs')renderLogs();}
function bytes(n) {n=Number(n)||0;const units=['B','KB','MB','GB','TB'];let i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n.toFixed(i&&n<10?1:0)} ${units[i]}`;}
function time(n) {const s=Math.max(0,Math.floor(n/1000));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');}
function applyTheme(s) {document.body.classList.toggle('light',s.settings.theme==='light'||s.settings.theme==='system'&&!s.systemDark);}
function fillSettings(s) {
  for(const key of ['theme','bind','socksPort','doh','customDns','edge'])$(key).value=s[key];
  for(const key of ['proxyOnly','exitCheck'])$(key).checked=s[key];
  $('excludedApps').value=s.excludedApps.join('\n');
  $('upstreamEnabled').checked=s.upstream.enabled;
  for(const key of ['type','host','port','username'])$('upstream'+key[0].toUpperCase()+key.slice(1)).value=s.upstream[key];
  $('upstreamPassword').value='';
}
function render(s) {
  currentState=s;applyTheme(s);
  if(!initialized){fillSettings(s.settings);initialized=true;}
  const connected=s.connection==='connected', transitional=['connecting','disconnecting'].includes(s.connection);
  $('status-label').className='status '+s.connection;
  $('status-label').replaceChildren(Object.assign(document.createElement('i'),{}),document.createTextNode(s.connection[0].toUpperCase()+s.connection.slice(1)));
  $('connect').className='power-button '+s.connection;$('connect').disabled=s.connection==='disconnecting'||s.busy&&s.connection!=='connecting';
  $('connect').setAttribute('aria-label',connected?'Disconnect VPN':s.connection==='connecting'?'Cancel connection':'Connect VPN');
  $('connection-title').textContent=connected?'You’re connected.':s.connection==='connecting'?'Finding your private path…':s.connection==='disconnecting'?'Closing your connection…':'Ready when you are.';
  $('connection-description').textContent=connected?(s.settings.proxyOnly?'Your local SOCKS5 proxy is ready.':'Your Windows traffic is using the tunnel.'):s.connection==='connecting'?'Click again to cancel.':'One click to a more private connection.';
  $('mode-label').textContent=s.settings.proxyOnly?'PROXY ONLY':'SYSTEM VPN';
  $('connection-footnote').textContent=s.settings.proxyOnly?`SOCKS5 · ${s.settings.bind}:${s.settings.socksPort}`:`Encrypted tunnel · ${s.settings.doh==='off'&&!s.settings.customDns?'System DNS':'Private DNS'}`;
  const selected=s.servers.find(server=>server.id===s.settings.serverId);
  $('selected-symbol').replaceChildren(selected?flag(selected.code,selected.country):icon('globe'));
  $('selected-location').textContent=selected?`${selected.city}, ${selected.country}`:'Recommended location';
  $('selected-detail').textContent=selected?`${selected.code} · HTTP/2 endpoint`:'Automatically choose an available server';
  $('exit-ip').textContent=s.exit?.ip||(connected?'Not verified':'Not connected');
  $('exit-country').textContent=s.exit?.country||'—';
  $('verify-exit').disabled=!connected;
  $('downloaded').textContent=bytes(s.down);$('uploaded').textContent=bytes(s.up);
  const now=Date.now(), elapsed=(now-lastTick)/1000;
  if(elapsed>.5){$('download-speed').textContent=bytes(Math.max(0,s.down-lastDown)/elapsed)+'/s';$('upload-speed').textContent=bytes(Math.max(0,s.up-lastUp)/elapsed)+'/s';lastUp=s.up;lastDown=s.down;lastTick=now;}
  $('session-time').textContent=time(s.startedAt?now-s.startedAt:0);
  $('location-count').textContent=new Set(s.servers.map(c=>c.code)).size || '—';
  $('account-name').textContent=s.signedIn?s.email.split('@')[0]:'Sign in';
  $('signin-panel').hidden=s.signedIn;$('signedin-panel').hidden=!s.signedIn;$('signedin-email').textContent=s.email;
  $('login-form').hidden=needsCode;$('code-form').hidden=!needsCode;
  $('login-button').disabled=s.busy;
  $('home-info').textContent=s.lastError||(s.signedIn?(s.quota?.remaining?`${bytes(s.quota.remaining)} remaining in your current service allowance.`:'Your Firefox account is ready. Choose a location and connect.'):'Sign in with your Firefox account to get started.');
  $('settings-notice').textContent=s.connection==='disconnected'?'Credentials are encrypted on this device.':'Disconnect before saving network preferences.';
  const serverKey=JSON.stringify(s.servers)+s.settings.serverId;if(serverKey!==lastServers){lastServers=serverKey;renderServers();}
  const logKey=JSON.stringify(s.logs);if(logKey!==lastLogs){lastLogs=logKey;renderLogs();}
}
function icon(name) {const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#glyph-'+name);svg.append(use);return svg;}
function flag(code,country) {
  if(!/^[a-z]{2}$/i.test(code))return icon('globe');
  const img=document.createElement('img');img.className='country-flag';img.src=`../../assets/flags/${code.toLowerCase()}.svg`;img.alt=`${country} flag`;
  img.addEventListener('error',()=>img.replaceWith(icon('globe')),{once:true});return img;
}
function renderServers() {
  if(!currentState)return;
  const query=$('server-search').value.toLowerCase(),seen=new Set();
  const servers=currentState.servers.filter(s=>{const key=s.code+'/'+s.cityCode;if(seen.has(key))return false;seen.add(key);return `${s.country} ${s.city} ${s.code}`.toLowerCase().includes(query);}).sort((a,b)=>a.country.localeCompare(b.country)||a.city.localeCompare(b.city));
  $('server-list').replaceChildren();
  for(const server of servers) {
    const button=document.createElement('button');button.className='server-row'+(currentState.settings.serverId.startsWith(server.code+'/'+server.cityCode+'/')?' selected':'');
    const code=document.createElement('span');code.className='country-code';code.append(flag(server.code,server.country));
    const text=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=server.country;small.textContent=server.city;text.append(strong,small);
    button.append(code,text,icon('arrow'));button.addEventListener('click',action(async()=>{await call('select',server.id);navigate('home');toast(`Selected ${server.city}, ${server.country}`);}));$('server-list').append(button);
  }
  $('server-empty').hidden=servers.length>0;$('server-empty').textContent=query?'No matching locations.':'No locations loaded. Refresh to fetch the live server list.';
}
function renderLogs() {
  if(!currentState)return;
  const filter=$('log-filter').value,logs=currentState.logs.filter(l=>filter==='all'||l.level===filter).slice().reverse();
  $('log-list').replaceChildren();
  if(!logs.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='No events to show. Your connection activity will appear here.';$('log-list').append(empty);return;}
  for(const log of logs){const row=document.createElement('div');row.className='log-row';const time=document.createElement('span');time.className='log-time';time.textContent=new Date(log.time).toLocaleTimeString('en-GB');const level=document.createElement('span');level.className='log-level '+log.level;level.textContent=log.level;const message=document.createElement('span');message.textContent=log.message;row.append(time,level,message);$('log-list').append(row);}
}
document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.page)));
for(const id of ['account-shortcut','home-account'])$(id).addEventListener('click',()=>navigate('account'));
$('choose-location').addEventListener('click',()=>navigate('locations'));
$('connect').addEventListener('click',action(async()=>{if(!currentState.signedIn){navigate('account');return;}await call(currentState.connection==='connected'?'disconnect':currentState.connection==='connecting'?'cancel':'connect');}));
$('theme-toggle').addEventListener('click',action(async()=>{const theme=document.body.classList.contains('light')?'dark':'light';await call('theme',theme);$('theme').value=theme;}));
$('source').addEventListener('click',action(()=>call('openLink','source')));
$('create-account').addEventListener('click',action(()=>call('openLink','account')));
$('refresh-servers').addEventListener('click',action(async()=>{$('refresh-servers').disabled=true;try{await call('servers');toast('Locations updated.');}finally{$('refresh-servers').disabled=false;}}));
$('server-search').addEventListener('input',renderServers);
$('recommended').addEventListener('click',action(async()=>{await call('select','REC');navigate('home');}));
$('verify-exit').addEventListener('click',action(async()=>{const result=await call('exit');toast(`Exit verified · ${result.ip} · ${result.country}`);}));
$('login-form').addEventListener('submit',action(async e=>{e.preventDefault();const email=$('email').value.trim(),password=$('password').value;$('password').value='';const result=await call('login',{email,password});needsCode=result.needsCode;render(await call('state'));if(needsCode){$('code').focus();toast('Enter the verification code sent to your Firefox account email.');}else{toast('Signed in successfully.');navigate('home');}}));
$('code-form').addEventListener('submit',action(async e=>{e.preventDefault();await call('verify',$('code').value.trim());$('code').value='';needsCode=false;render(await call('state'));toast('Your account is ready.');navigate('home');}));
$('restart-login').addEventListener('click',()=>{needsCode=false;render(currentState);});
$('logout').addEventListener('click',action(async()=>{await call('logout');needsCode=false;$('account-stats').textContent='Refresh to view your current account entitlement.';toast('Signed out.');}));
function accountInfo(data) {
  const parts=[`Entitlement: ${data.subscribed?'Active':'Not active'}`,`Account ID: ${data.uid||'Not reported'}`,`Monthly allowance: ${data.maxBytes==null?'Not reported':bytes(data.maxBytes)}`,`Data remaining: ${!data.limited_bandwidth?'Unlimited':data.quotaRemaining==null?'Not reported':bytes(data.quotaRemaining)}`];
  $('account-stats').replaceChildren(...parts.map(text=>{const p=document.createElement('div');p.textContent=text;return p;}));
}
$('refresh-account').addEventListener('click',action(async()=>accountInfo(await call('account'))));
$('activate-account').addEventListener('click',action(async()=>{accountInfo(await call('activate'));toast('Entitlement activation requested.');}));
$('settings-form').addEventListener('submit',action(async e=>{
  e.preventDefault();const settings={...currentState.settings};
  for(const key of ['theme','bind','doh','customDns','edge'])settings[key]=$(key).value.trim();
  settings.socksPort=Number($('socksPort').value);for(const key of ['proxyOnly','exitCheck'])settings[key]=$(key).checked;
  settings.excludedApps=$('excludedApps').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  settings.upstream={enabled:$('upstreamEnabled').checked,type:$('upstreamType').value,host:$('upstreamHost').value.trim(),port:Number($('upstreamPort').value),username:$('upstreamUsername').value,password:$('upstreamPassword').value};
  settings.clearUpstreamPassword=$('clearUpstreamPassword').checked;
  await call('settings',settings);$('upstreamPassword').value='';$('clearUpstreamPassword').checked=false;toast('Preferences saved.');
}));
$('log-filter').addEventListener('change',renderLogs);
$('clear-logs').addEventListener('click',action(()=>call('clearLogs')));
$('export-logs').addEventListener('click',action(()=>call('exportLogs')));
$('manage-subscription').addEventListener('click',action(()=>call('openLink','subscription')));
window.fox.onState(render);
call('state').then(render).catch(e=>toast(e.message));
