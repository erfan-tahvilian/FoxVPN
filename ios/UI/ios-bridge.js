// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  let sequence=0,saving=Promise.resolve();const pending=new Map(),listeners=new Set();
  function update(state){
    const connected=state.connection!=='disconnected';
    for(const control of document.querySelectorAll('#settings-form input,#settings-form select,#settings-form textarea'))control.disabled=connected&&control.id!=='theme';
    const sort=document.getElementById('server-sort');sort.value=state.settings.locationSort||'ping-asc';
    if(typeof syncSelects==='function')syncSelects();
    document.getElementById('settings-notice').textContent=connected?'Disconnect to edit network settings.':'';
  }
  window.desktopUI={state:update};
  window.fox={
    call(action,...args){return new Promise((resolve,reject)=>{const id=String(++sequence),timer=setTimeout(()=>{pending.delete(id);reject(Error('The native request timed out.'));},90000);pending.set(id,{resolve,reject,timer});window.webkit.messageHandlers.fox.postMessage({id,action,args});});},
    onState(callback){listeners.add(callback);return()=>listeners.delete(callback);},
    resolve(id,response){const task=pending.get(id);if(!task)return;clearTimeout(task.timer);pending.delete(id);task.resolve(response);},
    receive(state){for(const callback of listeners)callback(state);}
  };
  const sort=document.getElementById('server-sort');
  for(const mode of ['ping-asc','ping-desc','name-asc','name-desc'])sort.append(sort.querySelector(`option[value="${mode}"]`));
  sort.addEventListener('change',()=>call('locationSort',sort.value).catch(error=>toast(error.message)));
  window.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('excludedApps').closest('.settings-card').hidden=true;
    document.getElementById('proxyOnly').closest('.setting-row').hidden=true;
    document.getElementById('bind').closest('.field-grid').hidden=true;
    document.getElementById('bind').closest('.settings-card').querySelector('p.muted').hidden=true;
    const form=document.getElementById('settings-form');form.querySelector('button[type="submit"]').remove();
    document.querySelector('#settings .page-heading p').textContent='Network changes apply to your next connection.';
    form.addEventListener('submit',event=>event.preventDefault());
    form.addEventListener('change',event=>{
      if(!event.target.matches('input,select,textarea')||!form.reportValidity())return;
      const settings=readSettings();settings.proxyOnly=false;settings.bind='127.0.0.1';settings.excludedApps=[];settings.splitMode='exclude';
      const action=event.target.id==='theme'?'theme':'settings',value=action==='theme'?settings.theme:settings;
      saving=saving.then(async()=>{try{await call(action,value);document.getElementById('upstreamPassword').value='';document.getElementById('clearUpstreamPassword').checked=false;}catch(error){toast(error.message);}});
    });
    const about=document.createElement('div');about.className='settings-card';
    const heading=document.createElement('h3');heading.textContent='About Fox VPN';const text=document.createElement('p');text.textContent='Version 1.0.0';
    const source=document.getElementById('source');source.className='secondary';about.append(heading,text,source);form.insertBefore(about,document.querySelector('.settings-footer'));
    document.getElementById('connect').setAttribute('aria-label','Connect VPN');
    call('servers').catch(()=>{});
  });
})();
