// SPDX-License-Identifier: GPL-3.0-or-later
const clean=value=>Math.max(0,Number.isFinite(Number(value))?Number(value):0);
class TrafficLedger {
  constructor(saved,save,now=Date.now){this.now=now;this.save=save;this.totalUp=clean(saved?.totalUp);this.totalDown=clean(saved?.totalDown);this.since=saved?.since||now();this.session={up:clean(saved?.session?.up),down:clean(saved?.session?.down),duration:clean(saved?.session?.duration)};this.startedAt=null;this.lastUp=0;this.lastDown=0;this.lastSave=now();this.dirty=!saved;this.suspended=false;}
  begin(resume=false){this.suspended=false;this.dirty=true;if(!resume){this.session={up:0,down:0,duration:0};this.startedAt=this.now();}else if(this.startedAt==null)this.startedAt=this.now()-this.session.duration;this.lastUp=0;this.lastDown=0;}
  observe(up,down){if(this.startedAt==null||this.suspended)return;up=clean(up);down=clean(down);const du=Math.max(0,up-this.lastUp),dd=Math.max(0,down-this.lastDown);this.totalUp+=du;this.totalDown+=dd;this.session.up+=du;this.session.down+=dd;this.lastUp=up;this.lastDown=down;this.session.duration=Math.max(0,this.now()-this.startedAt);this.dirty=true;}
  snapshot(){return {totalUp:this.totalUp,totalDown:this.totalDown,since:this.since,session:{...this.session}};}
  checkpoint(force=false){if(this.dirty&&(force||this.now()-this.lastSave>=5000)){this.save(this.snapshot());this.lastSave=this.now();this.dirty=false;}}
  finish(){this.dirty=true;this.suspended=false;if(this.startedAt!=null)this.session.duration=Math.max(0,this.now()-this.startedAt);this.startedAt=null;this.lastUp=0;this.lastDown=0;this.checkpoint(true);}
}
module.exports={TrafficLedger};
