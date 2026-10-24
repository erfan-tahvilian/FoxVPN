// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
(() => {
  const get=id=>document.getElementById(id),form=get('settings-form'),sort=get('server-sort'),field=get('excludedApps');
  for(const mode of ['ping-asc','ping-desc','name-asc','name-desc'])sort.append(sort.querySelector(`option[value="${mode}"]`));
  sort.value='ping-asc';
  const label=document.createElement('label');label.htmlFor='split-mode';label.textContent='VPN routing';
  const mode=document.createElement('select');mode.id='split-mode';
  for(const [value,text] of [['exclude','All apps except selected'],['include','Only selected apps']]){const option=document.createElement('option');option.value=value;option.textContent=text;mode.append(option);}
  label.append(mode);field.closest('label').before(label);field.closest('label').hidden=false;field.closest('label').firstChild.textContent='App identifiers';field.placeholder=navigator.platform.includes('Mac')?'Safari\nGoogle Chrome':'chrome.exe\nfirefox.exe';field.closest('label').querySelector('small').textContent='One process name per line. Kept in sync with Choose apps.';
  const description=field.closest('.settings-card').querySelector('p'),summary=document.createElement('p'),choose=document.createElement('button');
  summary.className='muted';summary.id='excluded-summary';choose.id='choose-apps';choose.type='button';choose.className='secondary';choose.textContent='Choose apps';field.closest('label').before(summary,choose);
  form.querySelector('button[type="submit"]').remove();
  document.querySelector('#settings .page-heading p').textContent='Network changes apply to your next connection.';
  let initialized=false,saving=Promise.resolve(),sequence=0;
  function refreshSummary(){
    const count=new Set(field.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)).size,only=mode.value==='include';
    summary.textContent=count?`${count} ${count===1?'app':'apps'} ${only?'using the VPN':'excluded'}`:only?'Select at least one app to use the VPN.':'All apps use the VPN';
    description.textContent=only?'Only selected apps use the VPN. Other apps use your regular connection.':'Selected apps use your regular connection. Other apps use the VPN.';
  }
  function save(target){
    refreshSummary();if(!form.reportValidity())return;
    const settings={...readSettings(),splitMode:mode.value},number=++sequence,themeOnly=target.id==='theme';
    saving=saving.then(async()=>{
      try{
        await call(themeOnly?'theme':'settings',themeOnly?settings.theme:settings);
        if(number===sequence){if(get('upstreamPassword').value===settings.upstream.password)get('upstreamPassword').value='';get('clearUpstreamPassword').checked=false;}
      }catch(error){toast(error.message);}
    });
  }
  form.addEventListener('submit',event=>event.preventDefault());
  let inputTimer;
  form.addEventListener('change',event=>{clearTimeout(inputTimer);if(event.target.matches('input,select,textarea'))save(event.target);});
  form.addEventListener('input',event=>{clearTimeout(inputTimer);if(event.target.matches('input:not([type="checkbox"]),textarea'))inputTimer=setTimeout(()=>{if(form.checkValidity())save(event.target);},500);});
  window.flushSettings=()=>{if(inputTimer){clearTimeout(inputTimer);inputTimer=null;save(field);}return saving;};
  sort.addEventListener('change',()=>call('locationSort',sort.value).catch(error=>toast(error.message)));
  window.desktopUI={state(state){
    if(!initialized){mode.value=state.settings.splitMode||'exclude';sort.value=state.settings.locationSort||'ping-asc';initialized=true;renderServers();}
    const connected=state.connection!=='disconnected';
    for(const control of form.querySelectorAll('input,select,textarea,#choose-apps'))control.disabled=connected&&control.id!=='theme';
    get('settings-notice').textContent=connected?'Disconnect to edit network settings.':'';
    refreshSummary();syncSelects();
  }};
  const dialog=document.createElement('dialog');dialog.id='app-picker';dialog.setAttribute('aria-labelledby','app-picker-title');
  const heading=document.createElement('h2');heading.id='app-picker-title';heading.textContent='Choose apps';
  const search=document.createElement('input');search.type='search';search.placeholder='Search apps';search.setAttribute('aria-label','Search apps');
  const list=document.createElement('div');list.className='app-picker-list';
  const done=document.createElement('button');done.type='button';done.className='primary';done.textContent='Done';done.addEventListener('click',()=>dialog.close());
  dialog.append(heading,search,list,done);document.body.append(dialog);
  let apps=[],selected=new Set();
  const key=value=>currentState.platform==='win32'?value.toLowerCase():value.replace(/\.app$/i,'');
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);const image=entry.target;call('appIcon',image.dataset.id).then(src=>{if(src)image.src=src;}).catch(()=>{});}},{root:list,rootMargin:'100px'});
  function renderApps(){
    observer.disconnect();list.replaceChildren();const query=search.value.toLowerCase();
    for(const app of apps.filter(app=>`${app.name} ${app.id}`.toLowerCase().includes(query))){
      const row=document.createElement('label');row.className='app-picker-row';
      const image=document.createElement('img');image.alt='';image.dataset.id=app.id;image.src='../../assets/app-placeholder.svg';
      const name=document.createElement('span');name.textContent=app.name;
      const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(key(app.id));check.setAttribute('aria-label',app.name);
      check.addEventListener('change',()=>{if(check.checked)selected.add(key(app.id));else selected.delete(key(app.id));field.value=[...selected].map(id=>apps.find(item=>key(item.id)===id)?.id||id).join('\n');save(field);});
      row.append(image,name,check);list.append(row);observer.observe(image);
    }
    if(!list.children.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='No matching apps.';list.append(empty);}
  }
  search.addEventListener('input',renderApps);
  choose.addEventListener('click',async()=>{
    await window.flushSettings();field.value=readSettings().excludedApps.join('\n');dialog.showModal();search.value='';list.textContent='Loading apps…';search.focus();
    try{
      selected=new Set(field.value.split(/\r?\n/).filter(Boolean).map(key));apps=await call('apps');
      for(const id of field.value.split(/\r?\n/).filter(Boolean))if(!apps.some(app=>key(app.id)===key(id)))apps.push({id,name:id.replace(/\.(exe|app)$/i,'')});
      apps.sort((a,b)=>Number(selected.has(key(b.id)))-Number(selected.has(key(a.id)))||a.name.localeCompare(b.name));renderApps();
    }catch(error){list.textContent='Apps could not be loaded. Close this window and try again.';toast(error.message);}
  });
  dialog.addEventListener('close',()=>observer.disconnect());
})();
