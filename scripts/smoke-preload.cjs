const {contextBridge}=require('electron');
const {DEFAULTS}=require('../src/lib/settings.cjs');
const fs=require('node:fs'),path=require('node:path');
let state={version:'1.0.0',settings:structuredClone(DEFAULTS),signedIn:false,email:'',servers:[],logs:[],connection:'disconnected',startedAt:null,exit:null,quota:null,lastError:null,up:0,down:0,systemDark:true,busy:false},listener;
const live=path.join(__dirname,'../test-results/live-servers.json');
state.servers=fs.existsSync(live)?JSON.parse(fs.readFileSync(live,'utf8')):[{id:'US/fixture/localhost:443',code:'US',country:'United States',city:'Fixture',cityCode:'fixture',host:'localhost',port:443}];
contextBridge.exposeInMainWorld('fox',{
  call:async(channel,...args)=>{
    if(channel==='theme'){state.settings.theme=args[0];listener?.(state);}
    if(channel==='settings'){state.settings=args[0];listener?.(state);}
    if(channel==='select'){state.settings.serverId=args[0];listener?.(state);}
    return {ok:true,data:state};
  },onState:callback=>{listener=callback;return ()=>{};}
});
