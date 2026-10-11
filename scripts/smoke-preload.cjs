const {contextBridge}=require('electron');
const {DEFAULTS}=require('../src/lib/settings.cjs');
const fs=require('node:fs'),path=require('node:path');
let state={version:'1.0.1',latencies:{},pinging:false,activeServer:null,settings:structuredClone(DEFAULTS),signedIn:false,email:'',servers:[],logs:[],connection:'disconnected',startedAt:null,exit:null,quota:null,lastError:null,up:0,down:0,systemDark:true,busy:false},listener;
const live=path.join(__dirname,'../test-results/live-servers.json');
state.servers=fs.existsSync(live)?JSON.parse(fs.readFileSync(live,'utf8')):[{id:'US/fixture/localhost:443',code:'US',country:'United States',city:'Fixture',cityCode:'fixture',host:'localhost',port:443}];
state.servers.push({id:'XX/auto/fixture:443',code:'XX',country:'Recomended Location',city:'Recomended City',cityCode:'auto',host:'fixture',port:443});
contextBridge.exposeInMainWorld('fox',{
  call:async(channel,...args)=>{
    if(channel==='theme'){state.settings.theme=args[0];listener?.(state);}
    if(channel==='settings'){state.settings=args[0];listener?.(state);}
    if(channel==='ping'){state.latencies=Object.fromEntries(state.servers.map(s=>[s.id,{ms:42,measuredAt:Date.now()}]));listener?.(state);}
    if(channel==='connect'){state.connection='connected';state.activeServer=state.servers[0];state.exit={ip:'203.0.113.1',country:'CA'};listener?.(state);}
    if(channel==='select'){state.settings.serverId=args[0];listener?.(state);}
    return {ok:true,data:state};
  },onState:callback=>{listener=callback;return ()=>{};}
});
