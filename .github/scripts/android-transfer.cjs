// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),crypto=require('node:crypto');
const mode=process.argv[2],folder=process.argv[3];
if(mode==='generate'){
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(folder+'/private.pem',privateKey,{mode:0o600});fs.writeFileSync(folder+'/public.pem',publicKey);
}else if(mode==='encrypt'){
 if(!process.env.FOX_ANDROID_SIGNING_PASS||!/^\d+$/.test(process.env.FOX_SIGN_RUN||''))throw Error('Missing signing parameters');
 const payload=JSON.stringify({run:process.env.FOX_SIGN_RUN,keystore:fs.readFileSync('.tools/android-release.jks').toString('base64'),password:process.env.FOX_ANDROID_SIGNING_PASS});
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const data=Buffer.concat([cipher.update(payload),cipher.final()]);
 fs.writeFileSync(folder+'/envelope.json',JSON.stringify({key:crypto.publicEncrypt({key:fs.readFileSync(folder+'/public.pem'),oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}));
}else if(mode==='decrypt'){
 const e=JSON.parse(fs.readFileSync(folder+'/envelope.json'));
 const key=crypto.privateDecrypt({key:fs.readFileSync(folder+'/private.pem'),oaepHash:'sha256'},Buffer.from(e.key,'base64'));
 const cipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'));cipher.setAuthTag(Buffer.from(e.tag,'base64'));
 const payload=JSON.parse(Buffer.concat([cipher.update(Buffer.from(e.data,'base64')),cipher.final()]).toString());
 if(payload.run!==process.env.GITHUB_RUN_ID)throw Error('Signing run mismatch');
 fs.writeFileSync(folder+'/release.jks',Buffer.from(payload.keystore,'base64'),{mode:0o600});fs.writeFileSync(folder+'/password',payload.password,{mode:0o600});
}else throw Error('Unsupported operation');
