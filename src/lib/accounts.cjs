// SPDX-License-Identifier: GPL-3.0-or-later
function knownEmpty(q){return q?.unlimited!==true&&q?.remaining!=null&&String(q.remaining).trim()!==''&&Number.isFinite(Number(q.remaining))&&Number(q.remaining)<=0;}
function quotaFromPass(pass){return {limit:pass.quotaLimit,remaining:pass.quotaRemaining,reset:pass.quotaReset};}
class AccountCoordinator {
  constructor(store,provider){this.store=store;this.provider=provider;}
  async refresh(id){const profile=this.store.accounts.find(a=>a.id===id);if(!profile?.auth)throw Error('Sign in to this account again.');const data=await this.provider(id).account();const quota={limit:data.quotaLimit||data.maxBytes,remaining:data.quotaRemaining,reset:data.quotaReset,unlimited:data.limited_bandwidth===false};if(this.store.accounts.some(a=>a.id===id))this.store.updateAccount(id,{quota,status:knownEmpty(quota)?'exhausted':'ready',checkedAt:Date.now()});return data;}
  async prepare({exclude=[]}={}){const active=this.store.activeAccountId;const candidates=[this.store.accounts.find(a=>a.id===active),...this.store.accounts.filter(a=>a.id!==active)].filter(Boolean).filter(a=>a.auth&&!exclude.includes(a.id));let last;
    for(const profile of candidates){if(!this.store.accountPreferences.autoSwitch&&profile.id!==active)break;
      try{const pass=await this.provider(profile.id).pass();const quota={...quotaFromPass(pass),unlimited:profile.quota?.unlimited===true&&!(Number(pass.quotaLimit)>0)};this.store.updateAccount(profile.id,{quota,status:knownEmpty(quota)?'exhausted':'ready',checkedAt:Date.now()});if(knownEmpty(quota)){last=Error('This account has no data remaining.');continue;}if(this.store.activeAccountId!==profile.id)this.store.selectAccount(profile.id);return {id:profile.id,pass};}
      catch(error){last=error;const exhausted=knownEmpty(error.quota);if(exhausted)this.store.updateAccount(profile.id,{quota:error.quota,status:'exhausted',checkedAt:Date.now()});if(!this.store.accountPreferences.autoSwitch||(!exhausted&&profile.id===active&&this.store.accounts.find(a=>a.id===active)?.auth))throw error;}
    }throw last||Error('No signed-in account has an available data allowance.');
  }
  async confirmExhausted(id,error){if(knownEmpty(error?.quota)){this.store.updateAccount(id,{quota:error.quota,status:'exhausted',checkedAt:Date.now()});return true;}try{await this.refresh(id);return knownEmpty(this.store.accounts.find(a=>a.id===id)?.quota);}catch{return false;}}
}
module.exports={AccountCoordinator,knownEmpty,quotaFromPass};
