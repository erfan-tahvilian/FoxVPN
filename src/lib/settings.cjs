// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const net = require('node:net');
const DEFAULTS={theme:'system',locationSort:'ping-asc',splitMode:'exclude',proxyOnly:false,bind:'127.0.0.1',socksPort:1080,doh:'automatic',customDns:'',edge:'',exitCheck:true,excludedApps:[],upstream:{enabled:false,type:'socks5',host:'',port:1080,username:'',password:''},serverId:'REC'};
function host(value) {return typeof value==='string' && value.length<=253 && (net.isIP(value)>0 || /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value));}
function port(value) {return Number.isInteger(value)&&value>0&&value<=65535;}
function validate(input, platform=process.platform) {
  const s={...DEFAULTS,...input,upstream:{...DEFAULTS.upstream,...input.upstream}};
  if(!['dark','light','system'].includes(s.theme))throw Error('Choose a valid theme.');
  if(!['ping-asc','ping-desc','name-asc','name-desc'].includes(s.locationSort))throw Error('Choose a valid location order.');
  if(!['exclude','include'].includes(s.splitMode))throw Error('Choose a valid VPN routing mode.');
  if(!['127.0.0.1','0.0.0.0'].includes(s.bind))throw Error('Invalid SOCKS bind address.');
  if(!port(s.socksPort))throw Error('SOCKS port must be between 1 and 65535.');
  if(!['automatic','cloudflare','google','quad9','off'].includes(s.doh))throw Error('Invalid DNS provider.');
  if(s.customDns && !net.isIP(s.customDns))throw Error('Custom DNS must be an IP address.');
  if(s.edge && !host(s.edge))throw Error('Custom edge must be a hostname or IP address.');
  if(!['socks5','http'].includes(s.upstream.type)||!port(s.upstream.port))throw Error('Invalid upstream proxy type or port.');
  if(s.upstream.enabled&&!host(s.upstream.host))throw Error('Enter a valid upstream proxy hostname.');
  if(!Array.isArray(s.excludedApps)||s.excludedApps.length>100||s.excludedApps.some(p=>typeof p!=='string'||!(platform==='darwin'?/^[-\p{L}\p{N}_ .()+]+$/u:/^[-\p{L}\p{N}_ .()+]+\.exe$/iu).test(p)))throw Error('One or more selected apps have an unsupported process name.');
  for(const key of ['proxyOnly','exitCheck'])if(typeof s[key]!=='boolean')throw Error('Invalid setting.');
  if(typeof s.upstream.enabled!=='boolean'||typeof s.upstream.username!=='string'||typeof s.upstream.password!=='string')throw Error('Invalid upstream credentials.');
  if(typeof s.serverId!=='string'||s.serverId.length>512)throw Error('Invalid server selection.');
  return s;
}
function engineConfig(s, edgeIP, proxyIP, networkDns, platform=process.platform) {
  const providers={automatic:'1.1.1.1',cloudflare:'1.1.1.1',google:'8.8.8.8',quad9:'9.9.9.9'};
  const dns=s.customDns ? {type:'tcp',server:s.customDns} : s.doh==='off' ? (networkDns?{type:'tcp',server:networkDns,detour:'direct'}:{type:'local'}) : s.doh==='automatic' ? {type:'udp',server:'1.1.1.1'} : {type:'https',server:providers[s.doh],path:'/dns-query'};
  if(dns.type!=='local'&&!dns.detour)dns.detour='fox';
  const excluded=[edgeIP,proxyIP].filter(Boolean).map(ip=>ip+(net.isIP(ip)===6?'/128':'/32'));
  const own=platform==='darwin'?['Fox VPN','Fox VPN Helper','Electron','sing-box']:['Fox VPN.exe','electron.exe','sing-box.exe'];
  const selected=[...new Set(s.excludedApps.map(name=>platform==='darwin'?name.replace(/\.app$/i,''):name))];
  const only=s.splitMode==='include';
  return {
    log:{level:'info',timestamp:true},
    dns:{servers:[{tag:'private',...dns}],final:'private',strategy:'prefer_ipv4'},
    inbounds:[{type:'tun',tag:'tun',...(platform==='darwin'?{}:{interface_name:'FoxVPN'}),address:['172.29.0.1/30','fdfe:dcba:9876::1/126'],mtu:1500,auto_route:true,strict_route:true,stack:'mixed',...(excluded.length?{route_exclude_address:excluded}:{})}],
    outbounds:[{type:'socks',tag:'fox',server:'127.0.0.1',server_port:s.socksPort,version:'5'},{type:'direct',tag:'direct'}],
    route:{auto_detect_interface:true,final:only?'direct':'fox',rules:[
      {action:'sniff'}, {protocol:'dns',action:'hijack-dns'},
      {process_name:[...own,...(only?[]:selected)],action:'route',outbound:'direct'},
      {ip_is_private:true,action:'route',outbound:'direct'},
      ...(only?(selected.length?[{process_name:selected,network:'udp',action:'reject'},{process_name:selected,action:'route',outbound:'fox'}]:[]):[{network:'udp',action:'reject'}])
    ]}
  };
}
module.exports={DEFAULTS,validate,engineConfig,host,port};
