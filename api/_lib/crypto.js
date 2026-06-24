import crypto from 'node:crypto';

function key(){
  const raw=process.env.TOKEN_ENCRYPTION_KEY;
  if(!raw)throw new Error('TOKEN_ENCRYPTION_KEY is missing.');
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(value){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return [iv,tag,encrypted].map(x=>x.toString('base64url')).join('.');
}

export function decryptSecret(value){
  const [ivB64,tagB64,dataB64]=String(value||'').split('.');
  if(!ivB64||!tagB64||!dataB64)throw new Error('Stored Instagram token is invalid.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(ivB64,'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64,'base64url')),decipher.final()]).toString('utf8');
}
