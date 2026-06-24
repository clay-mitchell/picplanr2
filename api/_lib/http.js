import crypto from 'node:crypto';

export function parseCookies(req){
  const header=req.headers?.cookie||'';
  return Object.fromEntries(header.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{
    const i=v.indexOf('=');
    return [decodeURIComponent(i<0?v:v.slice(0,i)),decodeURIComponent(i<0?'':v.slice(i+1))];
  }));
}

export function cookie(name,value,{maxAge=3600,httpOnly=true,sameSite='Lax',secure=true,path='/'}={}){
  const parts=[`${encodeURIComponent(name)}=${encodeURIComponent(value)}`,`Path=${path}`,`Max-Age=${maxAge}`,`SameSite=${sameSite}`];
  if(httpOnly)parts.push('HttpOnly');
  if(secure)parts.push('Secure');
  return parts.join('; ');
}

export function randomToken(bytes=24){return crypto.randomBytes(bytes).toString('hex')}

export function safeReturnPath(value){
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return '/?instagram=connected';
  return value;
}
