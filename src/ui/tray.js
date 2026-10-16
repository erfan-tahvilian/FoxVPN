// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
function render(state){
  document.body.classList.toggle('light',state.light);document.body.classList.toggle('connected',state.connection==='connected');
  document.getElementById('logo').src=`../../assets/${state.light?'logo':'logo-light'}.png`;
  document.getElementById('status').textContent=state.connection[0].toUpperCase()+state.connection.slice(1);
  document.getElementById('location').textContent=state.location||'Your connection. Your control.';
  document.getElementById('version').textContent='v'+state.version;
  document.getElementById('toggle-label').textContent=state.connection==='connected'?'Disconnect':state.connection==='connecting'?'Cancel connection':state.connection==='disconnecting'?'Disconnecting…':'Connect';
  document.getElementById('toggle').disabled=state.connection==='disconnecting'||state.busy&&state.connection!=='connecting'||!state.signedIn;
}
window.trayUI.onState(render);window.trayUI.call('state').then(render);
for(const action of ['toggle','open','quit'])document.getElementById(action).addEventListener('click',()=>window.trayUI.call(action).catch(error=>{const label=document.getElementById('error');label.textContent=error.message;label.hidden=false;}));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')window.trayUI.call('dismiss');
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const items=[...document.querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);items[(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
});
