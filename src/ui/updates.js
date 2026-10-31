// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  const dialog=document.createElement('dialog');dialog.className='update-dialog';dialog.id='update-dialog';dialog.setAttribute('aria-labelledby','update-title');
  const badge=document.createElement('div');badge.className='eyebrow';badge.textContent='FOX VPN UPDATE';
  const title=document.createElement('h2');title.id='update-title';title.textContent='A new version is ready';
  const message=document.createElement('p');message.className='muted';
  const version=document.createElement('p');version.className='update-version';
  const details=document.createElement('p');details.className='muted update-package';
  const actions=document.createElement('div');actions.className='button-row';
  const later=document.createElement('button');later.type='button';later.className='secondary';later.textContent='Later';later.addEventListener('click',()=>dialog.close());
  const download=document.createElement('a');download.className='primary update-download';download.textContent='Download update';
  download.addEventListener('click',async event=>{event.preventDefault();if(download.getAttribute('aria-disabled')==='true')return;download.setAttribute('aria-disabled','true');try{await call('downloadUpdate');dialog.close();}catch(error){toast(error.message);}finally{download.removeAttribute('aria-disabled');}});
  actions.append(later,download);dialog.append(badge,title,message,version,details,actions);document.body.append(dialog);
  let checking=false,offered=null,pending=null,highlightsLoading=true;
  function presentPending(){
    if(!pending||highlightsLoading||currentState?.busy||needsCode||document.querySelector('dialog[open]'))return;
    const {update,manual}=pending;pending=null;
    if(!manual&&offered===update.latestVersion)return;
    offered=update.latestVersion;message.textContent='Get the latest improvements for your device.';version.textContent=`${update.currentVersion} → ${update.latestVersion}`;
    details.textContent=`${bytes(update.size)} download`;download.href=update.url;dialog.showModal();
  }
  async function check(manual,fresh=false){
    if(checking)return;checking=true;
    const control=document.getElementById('check-updates');if(control){control.disabled=true;control.textContent='Checking…';}
    try{
      const update=await call('checkUpdates',manual||fresh);
      if(update.available&&(manual||offered!==update.latestVersion)){
        pending={update,manual};presentPending();
      }else if(manual)toast('You are using the latest version.');
    }catch(error){if(manual)toast(error.message);}finally{checking=false;if(control){control.disabled=false;control.textContent='Check for updates';}}
  }
  const setup=()=>{
    let about=document.querySelector('[data-app-about]');
    if(!about){about=document.createElement('div');about.className='settings-card';const heading=document.createElement('h3');heading.textContent='About Fox VPN';const installed=document.createElement('p');installed.dataset.appVersion='';installed.dataset.versionPrefix='Version ';about.append(heading,installed);document.querySelector('.settings-footer').before(about);}
    const button=document.createElement('button');button.id='check-updates';button.type='button';button.className='secondary';button.textContent='Check for updates';button.addEventListener('click',()=>check(true));
    const source=about.querySelector('#source');if(source)source.before(button);else about.append(button);
    // Start conditional network revalidation immediately, even with a disk cache.
    check(false,true);
    showReleaseNotes().finally(()=>{highlightsLoading=false;presentPending();});
    document.addEventListener('close',presentPending,true);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check(false,true);});
    window.addEventListener('online',()=>{if(document.visibilityState==='visible')check(false,true);});
    const syncVersion=state=>{if(state?.version)for(const label of document.querySelectorAll('[data-app-version]'))label.textContent=(label.dataset.versionPrefix||'v')+state.version;};
    syncVersion(currentState);
    window.fox.onState(state=>{syncVersion(state);presentPending();});
  };
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',setup);else setup();
  async function showReleaseNotes(){
    try{
      const notes=await call('releaseNotes');if(notes.seen||!notes.items?.length)return;
      const welcome=document.createElement('dialog');welcome.id='release-highlights';welcome.className='update-dialog';welcome.setAttribute('aria-labelledby','highlights-title');
      const title=document.createElement('h2');title.id='highlights-title';title.textContent=`What’s new in Fox VPN ${notes.version}`;
      welcome.append(title);
      for(const item of notes.items){const article=document.createElement('article'),heading=document.createElement('h3'),description=document.createElement('p');heading.textContent=item.title;description.textContent=item.description;description.className='muted';article.append(heading,description);welcome.append(article);}
      const done=document.createElement('button');done.className='primary';done.textContent='Continue';done.addEventListener('click',()=>welcome.close());welcome.append(done);
      welcome.addEventListener('close',()=>{call('ackReleaseNotes').catch(()=>{});welcome.remove();},{once:true});document.body.append(welcome);welcome.showModal();
    }catch{/* Release highlights must never prevent starting the app. */}
  }
})();
