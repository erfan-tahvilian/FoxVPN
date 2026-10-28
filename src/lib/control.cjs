// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Erfan Tahvilian
const crypto = require('node:crypto');
const {parseChallengeInit} = require('./service-challenge.cjs');
const UA = 'MozillaVPN/2.35.0 (sys:linux; iap:true)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function solvePow(base, hash) {
  for (const a of ALPHABET) for (const b of ALPHABET) {
    if (crypto.createHash('sha256').update(base+a+b).digest('hex') === hash) return a+b;
  }
  throw Error('Unable to complete the server proof-of-work challenge.');
}
class Control {
  constructor() { this.cookies = new Map(); }
  async fetch(url, options = {}) {
    const u = new URL(url);
    const cookies = [...this.cookies.values()].filter(c => u.hostname === c.domain || u.hostname.endsWith('.'+c.domain)).map(c => c.pair).join('; ');
    // Fastly binds verification to the user agent as well as the exit IP.
    const agent = ['api.accounts.firefox.com','accounts.firefox.com'].includes(u.hostname) ? BROWSER_UA : UA;
    const response = await fetch(url, {...options, redirect:'error', signal:AbortSignal.timeout(30000), headers:{'User-Agent':agent, Accept:'application/json', ...(cookies ? {Cookie:cookies} : {}), ...options.headers}});
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';')[0];
      const domain = (raw.match(/;\s*domain=([^;]+)/i)?.[1] || u.hostname).replace(/^\./,'');
      if (u.hostname === domain || u.hostname.endsWith('.'+domain)) this.cookies.set(domain+':'+pair.split('=')[0], {domain,pair});
    }
    return response;
  }
  async json(url, {method = 'GET', body, authorization} = {}) {
    const options = {method,body,headers:{'Content-Type':'application/json', ...(authorization ? {Authorization:authorization}: {})}};
    let response = await this.fetch(url, options);
    for(let attempt=0; response.status === 406 && attempt<3; attempt++) { await response.arrayBuffer(); await this.challenge(); response = await this.fetch(url, options); }
    const raw = await response.text();
    let data; try { data = JSON.parse(raw || '{}'); } catch { throw Error(`The service returned an invalid response (HTTP ${response.status}).`); }
    if (!response.ok) { const e = Error(data.message || `Service request failed (HTTP ${response.status}).`); e.status = response.status; e.errno = data.errno; e.quota={limit:response.headers.get('x-quota-limit'),remaining:response.headers.get('x-quota-remaining'),reset:response.headers.get('x-quota-reset')}; throw e; }
    return {data, headers:response.headers};
  }
  async challenge() {
    if (this.verifying) return this.verifying;
    this.verifying = (async()=>{
      // A previous clearance can hide the challenge page even when the API
      // rejects that clearance. Keep the main session while verifying afresh.
      const solver = new Control();
      await solver.solveChallenge();
      for (const [key,cookie] of solver.cookies) this.cookies.set(key,cookie);
    })();
    try { return await this.verifying; } finally { this.verifying=null; }
  }
  async solveChallenge() {
    for(const base of ['https://api.accounts.firefox.com', 'https://accounts.firefox.com']) {
      const headers = {'User-Agent':BROWSER_UA, Accept:'text/html'};
      const page = await (await this.fetch(base+'/', {headers})).text();
      const prefix = page.match(/\/_fs-ch-[A-Za-z0-9]+/)?.[0];
      if (!prefix || !page.includes('Client Challenge')) continue;
      const root = base+prefix;
      const scriptResponse = await this.fetch(root+'/script.js?reload=true', {headers});
      if (!scriptResponse.ok) { await scriptResponse.arrayBuffer(); throw Error(`Service verification could not load (HTTP ${scriptResponse.status}). Try again.`); }
      const script = await scriptResponse.text();
      let {challenges,token} = parseChallengeInit(script,prefix);
      for(let round=0; round<3; round++) {
        const answers = [];
        for(const c of challenges) {
          if(c.ty==='pow') answers.push({ty:'pow', base:c.data.base, answer:solvePow(c.data.base,c.data.hash), hmac:c.data.hmac, expires:c.data.expires});
          else if(c.ty==='pat') {
            const r = await this.fetch(`${root}/pat?token=${encodeURIComponent(token)}`, {method:'POST', headers:{...headers,Origin:base,'Content-Type':'application/json'}});
            answers.push({ty:'pat', auth:[400,401].includes(r.status) ? '' : (await r.json()).auth});
          } else if(c.ty==='clientmetrics') answers.push({ty:'clientmetrics', webdriver:false, bot_detection_result:{bot_detected:false,bot_kind:null},browser_metrics:{client_data:'{}',error_trace:null},detector_results:{},v:2});
          else throw Error('The service requires an interactive challenge. Try signing in again later.');
        }
        const r = await this.fetch(root+'/fst-post-back', {method:'POST', headers:{...headers,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token,data:answers})});
        if(!r.ok) throw Error('Service verification failed.');
        const data = await r.json();
        if(data.status==='success') return;
        challenges=data.ch; token=data.tok;
        if(!Array.isArray(challenges) || !token) throw Error('Service verification did not complete.');
      }
    }
    throw Error('Could not complete service verification. Try again later.');
  }
}
function candidates(records) {
  const output = [];
  for(const record of records) {
    const country = record.country || record;
    if (!country.code || country.name === 'CatchAll Anycast') continue;
    for(const city of country.cities || []) for(const server of city.servers || []) {
      if(server.quarantined) continue;
      const connect = (server.protocols || []).find(p=>p.name==='connect');
      if(server.protocols?.length && !connect) continue;
      const host=connect?.host || server.hostname, port=connect?.port || server.port || 443;
      if(host) output.push({id:`${country.code}/${city.code}/${host}:${port}`, country:country.name, code:country.code, city:String(city.name||'').trim().toLowerCase()===String(country.name||'').trim().toLowerCase()?'':String(city.name||'').trim(), cityCode:city.code,host,port});
    }
  }
  return output;
}
class Guardian {
  constructor(control, auth) { this.http = control; this.auth = auth; }
  async request(path, method = 'GET', retry = true) {
    try { return await this.http.json('https://vpn.mozilla.org/api/v1/fpn/'+path, {method, authorization:'Bearer '+await this.auth.token()}); }
    catch(e) { if (e.status === 401 && retry) { await this.auth.token(true); return this.request(path,method,false); } throw e; }
  }
  async pass() {
    let r;
    try { r = await this.request('token'); } catch(e) { if(e.status!==403) throw e; await this.request('activate','POST'); r = await this.request('token'); }
    if(!r.data.token) throw Error('Guardian returned no proxy pass.');
    const expiry = (()=>{try{return JSON.parse(Buffer.from(r.data.token.split('.')[1],'base64url')).exp;}catch{return undefined;}})();
    return {token:r.data.token, expiresAt:(r.data.expires_at || expiry || Math.floor(Date.now()/1000)+3600)*1000,quotaLimit:r.headers.get('x-quota-limit'),quotaRemaining:r.headers.get('x-quota-remaining'),quotaReset:r.headers.get('x-quota-reset')};
  }
  async servers() { return candidates((await this.http.json('https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/vpn-serverlist/records')).data.data || []); }
  async account() {
    const data=(await this.request('status')).data;
    if(data.limited_bandwidth)try{const pass=await this.pass();data.quotaRemaining=pass.quotaRemaining;data.quotaLimit=pass.quotaLimit;data.quotaReset=pass.quotaReset;}catch{/* Entitlement can still be shown while quota is unavailable. */}
    return data;
  }
}
module.exports = {Control, Guardian, candidates, solvePow};
