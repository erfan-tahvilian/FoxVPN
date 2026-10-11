const {contextBridge,ipcRenderer}=require('electron');
const channels=['state','login','verify','logout','servers','account','activate','settings','theme','select','connect','cancel','disconnect','exit','clearLogs','exportLogs','openLink'];
contextBridge.exposeInMainWorld('fox',{
  call:(channel,...args)=>{if(!channels.includes(channel))throw Error('Unsupported action');return ipcRenderer.invoke('fox:'+channel,...args);},
  onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('fox:state',listener);return ()=>ipcRenderer.removeListener('fox:state',listener);}
});
