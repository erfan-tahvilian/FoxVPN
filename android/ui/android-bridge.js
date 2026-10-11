(() => {
  let sequence=0;const pending=new Map(),listeners=new Set();
  window.fox={
    call(channel,...args){return new Promise((resolve,reject)=>{const id=String(++sequence);pending.set(id,{resolve,reject});window.FoxAndroid.request(id,channel,JSON.stringify(args));});},
    onState(callback){listeners.add(callback);return()=>listeners.delete(callback);},
    resolve(id,response){const task=pending.get(id);if(!task)return;pending.delete(id);task.resolve(response);},
    receive(state){for(const callback of listeners)callback(state);}
  };
  window.addEventListener('DOMContentLoaded',()=>{
    const field=document.getElementById('excludedApps');
    field.placeholder='com.android.chrome\ncom.valvesoftware.android.steam.community';
    const label=field.closest('label');label.childNodes[0].textContent='Excluded Android packages';
    label.querySelector('small').textContent='Choose apps or enter one package name per line. Save preferences to apply.';
    const choose=document.createElement('button');choose.type='button';choose.className='secondary';choose.textContent='Choose apps';choose.addEventListener('click',()=>window.fox.call('chooseApps'));field.after(choose);
    const tile=document.createElement('button');tile.type='button';tile.className='secondary';tile.textContent='Add Quick Settings tile';tile.addEventListener('click',()=>window.fox.call('addTile'));
    document.querySelector('.settings-card').append(tile);
    document.querySelector('.account-story>p').textContent='A private connection, wherever you are.';
    document.getElementById('connect').setAttribute('aria-label','Connect VPN');
  });
})();
