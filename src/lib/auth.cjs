const crypto = require('node:crypto');
const PREFIX = 'identity.mozilla.com/picl/v1/';
const CLIENT = '5882386c6d801776';
const SCOPE = 'profile https://identity.mozilla.com/apps/vpn';
function hkdf(input, info, length) { return Buffer.from(crypto.hkdfSync('sha256', input, Buffer.alloc(32), info, length)); }
function authPW(email, password) {
  return hkdf(crypto.pbkdf2Sync(password, `${PREFIX}quickStretch:${email}`, 1000, 32, 'sha256'), `${PREFIX}authPW`, 32).toString('hex');
}
function hawk(method, url, session, body, now = Math.floor(Date.now()/1000), nonce = crypto.randomBytes(6).toString('base64url')) {
  const expanded = hkdf(Buffer.from(session, 'hex'), `${PREFIX}sessionToken`, 64);
  const u = new URL(url);
  const hash = crypto.createHash('sha256').update(`hawk.1.payload\napplication/json\n${body}\n`).digest('base64');
  const normalized = `hawk.1.header\n${now}\n${nonce}\n${method}\n${u.pathname}${u.search}\n${u.hostname}\n${u.port || 443}\n${hash}\n\n`;
  const mac = crypto.createHmac('sha256', expanded.subarray(32)).update(normalized).digest('base64');
  return `Hawk id="${expanded.subarray(0,32).toString('hex')}", ts="${now}", nonce="${nonce}", mac="${mac}", hash="${hash}"`;
}
class Auth {
  constructor(http, store) { this.http = http; this.store = store; this.pending = null; }
  async request(path, data, session) {
    const url = `https://api.accounts.firefox.com/v1${path}`;
    return (await this.http.json(url, {method:'POST', body:JSON.stringify(data), authorization:session ? hawk('POST', url, session, JSON.stringify(data)) : undefined})).data;
  }
  async login(email, password) {
    if (!email || !password) throw Error('Enter your Firefox account email and password.');
    let result;
    try { result = await this.request('/account/login', {email, authPW:authPW(email,password), verificationMethod:'email-2fa'}); }
    catch (e) { if (e.errno !== 107) throw e; result = await this.request('/account/login', {email, authPW:authPW(email,password)}); }
    this.pending = {session:result.sessionToken, email};
    if (!result.verified) return {needsCode:true};
    return this.complete();
  }
  async verify(code) {
    if (!this.pending) throw Error('Start sign-in again.');
    await this.request('/session/verify_code', {code}, this.pending.session);
    return this.complete();
  }
  async complete() {
    const token = await this.request('/oauth/token', {client_id:CLIENT, grant_type:'fxa-credentials', scope:SCOPE, access_type:'offline'}, this.pending.session);
    if (!token.access_token) throw Error('Firefox Accounts did not return an access token.');
    this.store.setAuth({...token, email:this.pending.email, expiresAt:Date.now()+(token.expires_in || 86400)*1000});
    this.pending = null; return {needsCode:false};
  }
  async token(force = false) {
    const auth = this.store.auth;
    if (!auth) throw Error('Sign in to your Firefox account first.');
    if (!force && Date.now()+60000 < auth.expiresAt) return auth.access_token;
    if (!auth.refresh_token) { this.store.setAuth(null); throw Error('Your session expired. Please sign in again.'); }
    let renewed;
    try { renewed = await this.request('/oauth/token', {client_id:CLIENT, grant_type:'refresh_token', refresh_token:auth.refresh_token, scope:SCOPE}); }
    catch(e) { if ([400,401,403].includes(e.status)) this.store.setAuth(null); throw e; }
    if (!renewed.access_token) throw Error('Token refresh returned no access token.');
    this.store.setAuth({...auth, ...renewed, expiresAt:Date.now()+(renewed.expires_in || 86400)*1000});
    return renewed.access_token;
  }
}
module.exports = {Auth, hkdf, authPW, hawk};
