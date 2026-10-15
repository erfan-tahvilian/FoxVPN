// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
(() => {
  let sequence=0;const pending=new Map(),listeners=new Set();
  window.fox={
    call(channel,...args){return new Promise((resolve,reject)=>{const id=String(++sequence);pending.set(id,{resolve,reject});window.FoxAndroid.request(id,channel,JSON.stringify(args));});},
    onState(callback){listeners.add(callback);return()=>listeners.delete(callback);},
    resolve(id,response){const task=pending.get(id);if(!task)return;pending.delete(id);task.resolve(response);},
    receive(state){for(const callback of listeners)callback(state);updateSettingsState(state);}
  };
  const sort=document.getElementById('server-sort');
  for(const mode of ['ping-asc','ping-desc','name-asc','name-desc'])sort.append(sort.querySelector(`option[value="${mode}"]`));
  sort.value=window.FoxAndroid.getLocationSort();
  sort.addEventListener('change',async()=>{
    const result=await window.fox.call('locationSort',sort.value);
    if(!result.ok)toast(result.error||'Could not save location sorting.');
  });
  const splitField=document.getElementById('excludedApps');
  const splitLabel=document.createElement('label');splitLabel.htmlFor='split-mode';splitLabel.textContent='VPN routing';
  const splitMode=document.createElement('select');splitMode.id='split-mode';
  for(const [value,text] of [['exclude','All apps except selected'],['include','Only selected apps']]){const option=document.createElement('option');option.value=value;option.textContent=text;splitMode.append(option);}
  splitLabel.append(splitMode);splitField.closest('label').before(splitLabel);
  let saving=Promise.resolve(),saveSequence=0,splitInitialized=false;
  function updateSettingsState(state){
    const form=document.getElementById('settings-form');
    const connected=state.connection!=='disconnected';
    if(!splitInitialized){splitMode.value=state.settings.splitMode==='include'?'include':'exclude';splitInitialized=true;}
    for(const control of form.querySelectorAll('input,select,textarea,#choose-apps'))control.disabled=connected&&control.id!=='theme';
    if(typeof syncSelects==='function')syncSelects();
    const notice=document.getElementById('settings-notice');
    notice.textContent=connected?'Disconnect to edit network settings.':'';
    const selected=document.getElementById('excluded-summary');
    if(selected){const count=state.settings.excludedApps.length,only=splitMode.value==='include';selected.textContent=count?`${count} ${count===1?'app':'apps'} ${only?'using the VPN':'excluded'}`:only?'Select at least one app to use the VPN.':'All apps use the VPN';}
    splitField.closest('.settings-card').querySelector('p').textContent=splitMode.value==='include'?'Only selected apps use the VPN. Other apps use your regular connection.':'Selected apps use your regular connection. Other apps use the VPN.';
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const field=document.getElementById('excludedApps');
    field.closest('label').hidden=true;
    const summary=document.createElement('p');summary.id='excluded-summary';summary.className='muted';
    const choose=document.createElement('button');choose.id='choose-apps';choose.type='button';choose.className='secondary';choose.textContent='Choose apps';choose.addEventListener('click',()=>window.fox.call('chooseApps'));field.closest('label').after(summary,choose);
    const form=document.getElementById('settings-form');
    form.querySelector('button[type="submit"]').remove();
    document.querySelector('#settings .page-heading p').textContent='Network changes apply to your next connection.';
    form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
    form.addEventListener('change',event=>{
      if(!event.target.matches('input,select,textarea'))return;
      const settings={...readSettings(),splitMode:splitMode.value},sequence=++saveSequence;
      if(!form.reportValidity())return;
      const notice=document.getElementById('settings-notice');notice.textContent='Saving…';
      saving=saving.then(async()=>{
        try{
          await call(event.target.id==='theme'?'theme':'settings',event.target.id==='theme'?settings.theme:settings);
          if(sequence===saveSequence){
            if(document.getElementById('upstreamPassword').value===settings.upstream.password)document.getElementById('upstreamPassword').value='';
            document.getElementById('clearUpstreamPassword').checked=false;
            notice.textContent='Changes saved.';
          }
        }catch(error){notice.textContent='Could not save changes.';toast(error.message);}
      });
    });
    const about=document.createElement('div');about.className='settings-card';
    const heading=document.createElement('h3');heading.textContent='About Fox VPN';
    const version=document.createElement('p');version.textContent='Version 1.0.0';
    const source=document.getElementById('source');source.className='secondary';
    about.append(heading,version,source);document.getElementById('settings-form').insertBefore(about,document.querySelector('.settings-footer'));
    document.querySelector('.account-story>p').textContent='A private connection, wherever you are.';
    document.getElementById('connect').setAttribute('aria-label','Connect VPN');
    if(currentState)updateSettingsState(currentState);
  });
})();
