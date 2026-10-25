// SPDX-License-Identifier: GPL-3.0-or-later
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {bindTrayActions}=require('../src/tray.cjs');
test('desktop tray separates primary clicks from context-menu activation',()=>{
 for(const platform of ['win32','darwin','linux']){
  const tray=new EventEmitter();let opened=0,menus=0,hidden=0;
  bindTrayActions(tray,{async show(){menus++;},hide(){hidden++;}},()=>opened++,()=>{},platform);
  tray.emit('right-click',{});assert.equal(menus,1);assert.equal(opened,0);
  tray.emit('click',{button:2});assert.equal(opened,0);
  tray.emit('click',{button:0});assert.equal(opened,1);assert.equal(hidden,1);assert.equal(menus,1);
  if(platform==='darwin'){tray.emit('click',{ctrlKey:true});assert.equal(menus,2);assert.equal(opened,1);}
 }
});
