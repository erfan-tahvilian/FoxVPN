// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in live network check. Run with Electron, without real account credentials.
const {app,net,session}=require('electron');
const {randomUUID}=require('node:crypto');
const {Control}=require('../src/lib/control.cjs');
app.whenReady().then(async()=>{
  // A nonpersistent session keeps this diagnostic separate from the app's vault.
  const network=session.fromPartition('fox-service-check-'+randomUUID(),{cache:false});
  const control=new Control({transport:(...args)=>network.fetch(...args)});
  try {
    await control.json('https://api.accounts.firefox.com/v1/account/login',{method:'POST',body:JSON.stringify({email:'foxvpn-test-'+randomUUID()+'@example.invalid',authPW:'00'.repeat(32)})});
    throw Error('Unexpected sign-in success for the reserved diagnostic address');
  } catch(error) {
    if(error.status===400&&error.errno===102) {
      console.log('PASS: service verification completed and the account API returned Unknown account for a reserved diagnostic address.');
      app.exit(0);
    } else {
      // Never print response bodies, request headers, passwords or cookies.
      console.error('FAIL: account service check:',error.message);
      app.exit(1);
    }
  }
}).catch(()=>app.exit(1));
