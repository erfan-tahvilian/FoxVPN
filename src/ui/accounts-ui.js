// SPDX-License-Identifier: GPL-3.0-or-later
let addingAccount=false,accountListKey='',removeAccountId=null;
function hasAccountManager(s=currentState){return Array.isArray(s?.accounts)&&['win32','darwin','linux','android'].includes(s.platform);}
function openAccountSignIn(email=''){addingAccount=true;needsCode=false;navigate('account');$('email').value=email;$('password').value='';render(currentState);$('email').focus();}
function renderAccountManager(s){
  const enabled=hasAccountManager(s);$('accounts-panel').hidden=!enabled||!s.accounts.length;$('cancel-add-account').hidden=!enabled||!addingAccount||!s.accounts.length;
  $('total-traffic-card').hidden=!s.totalTraffic;$('traffic-metrics').classList.toggle('has-total',!!s.totalTraffic);
  if(s.totalTraffic){$('total-transferred').textContent=bytes(s.totalTraffic.totalUp+s.totalTraffic.totalDown);$('total-traffic-detail').textContent=`↓ ${bytes(s.totalTraffic.totalDown)} · ↑ ${bytes(s.totalTraffic.totalUp)}`;$('total-traffic-card').title='Traffic on this device since '+new Date(s.totalTraffic.since).toLocaleDateString('en-US');if(s.connection!=='connected'){$('download-speed').textContent='Last session';$('upload-speed').textContent='Last session';}}
  if(!enabled)return;
  $('signin-panel').hidden=!addingAccount&&s.accounts.length>0;$('signedin-panel').hidden=true;
  document.querySelector('#account .page-heading h1').textContent='Your Firefox accounts.';
  document.querySelector('#account .page-heading>p').textContent='One place for your accounts, connection preference and automatic switching.';
  $('add-account').disabled=s.busy;$('cancel-add-account').disabled=s.busy;$('account-auto-switch').checked=s.accountPreferences?.autoSwitch!==false;$('account-auto-switch').disabled=s.busy;
  const summaries=s.accounts.filter(a=>a.status!=='sign-in-required').map(a=>allowanceSummary(a.quota)),known=summaries.filter(a=>a.kind==='limited'),unlimited=summaries.some(a=>a.kind==='unlimited');
  $('allowance-pool').hidden=s.accounts.length<2;
  $('allowance-pool').textContent=unlimited?'An unlimited allowance is available across your saved accounts.':known.length?`${bytes(known.reduce((sum,a)=>sum+a.remaining,0))} remaining across ${known.length} of ${s.accounts.length} saved accounts`:'Additional account allowances have not been checked yet.';
  const key=JSON.stringify([s.accounts,s.busy,s.connection]);if(key===accountListKey)return;accountListKey=key;
  $('accounts-list').replaceChildren();
  for(const account of s.accounts){
    const card=document.createElement('article');card.className='saved-account'+(account.active?' is-active':'');card.setAttribute('role','listitem');
    const avatar=document.createElement('span');avatar.className='account-avatar';avatar.textContent=Array.from(account.email)[0]?.toUpperCase()||'?';
    const copy=document.createElement('div');copy.className='saved-account-copy';const email=document.createElement('strong');email.textContent=account.email||'Firefox account';const detail=document.createElement('p');const q=allowanceSummary(account.quota);
    detail.textContent=account.status==='sign-in-required'?'Sign in again to use this account':account.status==='exhausted'?'No data remaining':q.kind==='limited'?`${bytes(q.remaining)} remaining`:q.kind==='unlimited'?'Unlimited allowance':'Allowance not yet available';copy.append(email,detail);
    if(account.active){const badge=document.createElement('span');badge.className='account-active-badge';badge.textContent='ACTIVE';copy.append(badge);}
    const actions=document.createElement('div');actions.className='saved-account-actions';const choose=document.createElement('button');choose.className=account.active?'secondary':'primary';choose.type='button';choose.textContent=account.status==='sign-in-required'?'Sign in again':account.active?'Active account':s.connection==='connected'?'Switch and reconnect':'Use account';choose.disabled=s.busy||account.active&&account.status!=='sign-in-required';choose.addEventListener('click',action(async()=>{if(account.status==='sign-in-required')openAccountSignIn(account.email);else await call('selectAccount',account.id);}));
    const remove=document.createElement('button');remove.className='subtle danger';remove.type='button';remove.textContent='Remove';remove.disabled=s.busy||account.active&&s.connection!=='disconnected';remove.title=remove.disabled&&account.active?'Disconnect before removing the active account':'Remove account from this device';remove.addEventListener('click',()=>{removeAccountId=account.id;$('remove-account-email').textContent=account.email;$('remove-account-dialog').showModal();});actions.append(choose,remove);card.append(avatar,copy,actions);$('accounts-list').append(card);
  }
}
function setupAccountManager(){
  $('add-account').addEventListener('click',()=>openAccountSignIn());
  $('cancel-add-account').addEventListener('click',action(async()=>{await call('cancelAccountLogin');addingAccount=false;needsCode=false;$('password').value='';$('code').value='';render(currentState);}));
  $('account-auto-switch').addEventListener('change',action(async()=>{await call('accountPreferences',$('account-auto-switch').checked);render(await call('state'));}));
  $('keep-account').addEventListener('click',()=>$('remove-account-dialog').close());
  $('confirm-remove-account').addEventListener('click',action(async()=>{const id=removeAccountId;$('remove-account-dialog').close();if(id)await call('removeAccount',id);}));
}
