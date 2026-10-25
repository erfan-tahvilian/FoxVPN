// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const {BrowserWindow,ipcMain,screen}=require('electron');
const path=require('node:path');
function bindTrayActions(tray,popup,open,onError,platform=process.platform){
  const menu=()=>popup.show().catch(onError);
  const show=()=>{popup.hide();open();};
  tray.on('right-click',menu);
  tray.on('click',event=>{if(platform==='darwin'&&event?.ctrlKey){menu();return;}if(event?.button!==undefined&&event.button!==0)return;show();});
  tray.on('double-click',show);
}
class TrayPopup {
  constructor({state,command,bounds}) {
    this.state=state;this.command=command;this.bounds=bounds;
    ipcMain.handle('fox:tray',async(event,action)=>{
      if(!this.window||event.sender!==this.window.webContents||event.senderFrame!==this.window.webContents.mainFrame)throw Error('Invalid tray sender');
      if(action==='state')return this.state();
      if(!['open','toggle','quit','dismiss'].includes(action))throw Error('Unsupported tray action');
      this.hide();if(action!=='dismiss')await this.command(action);
    });
  }
  async show() {
    // Capture the click anchor before renderer startup or pointer movement.
    const anchor=this.bounds();
    const request=this.epoch=(this.epoch||0)+1;
    if(this.window&&!this.window.isDestroyed()&&this.window.isVisible())this.window.hide();
    if(!this.window||this.window.isDestroyed()){
      this.window=new BrowserWindow({width:306,height:244,show:false,frame:false,transparent:true,resizable:false,movable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,roundedCorners:true,webPreferences:{preload:path.join(__dirname,'tray-preload.cjs'),sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
      this.window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      this.window.webContents.on('will-navigate',event=>event.preventDefault());
      this.window.on('blur',()=>this.hide());
      this.ready=this.window.loadFile(path.join(__dirname,'ui/tray.html'));
    }
    await this.ready;
    if(request!==this.epoch||!this.window||this.window.isDestroyed())return;
    const height=await this.window.webContents.executeJavaScript(`render(${JSON.stringify(this.state())});Math.ceil(document.querySelector('main').getBoundingClientRect().bottom+5)`);
    if(request!==this.epoch||!this.window||this.window.isDestroyed())return;
    const point={x:Math.round(anchor.x+anchor.width/2),y:Math.round(anchor.y+anchor.height/2)};
    const work=screen.getDisplayNearestPoint(point).workArea;
    const x=Math.max(work.x,Math.min(work.x+work.width-306,point.x-153));
    const proposed=point.y>work.y+work.height/2?anchor.y-height-4:anchor.y+anchor.height+4;
    const y=Math.max(work.y,Math.min(work.y+work.height-height,proposed));
    this.window.setBounds({x:Math.round(x),y:Math.round(y),width:306,height},false);this.window.show();this.window.focus();
  }
  update(){if(this.window&&!this.window.isDestroyed())this.window.webContents.send('fox:tray-state',this.state());}
  hide(){this.epoch=(this.epoch||0)+1;if(this.window&&!this.window.isDestroyed())this.window.hide();}
  destroy(){this.epoch=(this.epoch||0)+1;ipcMain.removeHandler('fox:tray');if(this.window&&!this.window.isDestroyed())this.window.destroy();this.window=null;}
}
module.exports={TrayPopup,bindTrayActions};
