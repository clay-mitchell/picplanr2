import crypto from 'node:crypto';
import {parseCookies,cookie,safeReturnPath} from '../../_lib/http.js';
import {exchangeCode,getProfile} from '../../_lib/instagram.js';
import {encryptSecret} from '../../_lib/crypto.js';
import {saveInstagramConnection} from '../../_lib/supabase.js';

export default async function handler(req,res){
  const cookies=parseCookies(req);
  const returnTo=safeReturnPath(cookies.pp_ig_return||'/?instagram=connected');
  try{
    if(req.query?.error)throw new Error(req.query.error_description||req.query.error);
    if(!req.query?.code)throw new Error('Instagram did not return an authorisation code.');
    if(!req.query?.state||req.query.state!==cookies.pp_ig_state)throw new Error('Instagram connection security check failed. Please try again.');
    const token=await exchangeCode(String(req.query.code));
    const profile=await getProfile(token.accessToken);
    const id=crypto.randomUUID();
    const expiresAt=new Date(Date.now()+(Number(token.expiresIn)||3600)*1000).toISOString();
    await saveInstagramConnection({
      id,
      provider:'instagram',
      provider_account_id:String(profile.user_id||profile.id||token.userId||''),
      provider_account_name:profile.username||'Instagram account',
      encrypted_access_token:encryptSecret(token.accessToken),
      token_expires_at:expiresAt,
      status:'connected',
      metadata:{account_type:profile.account_type||null,media_count:profile.media_count??null}
    });
    res.setHeader('Set-Cookie',[
      cookie('pp_ig_connection',id,{maxAge:60*60*24*30}),
      cookie('pp_ig_state','',{maxAge:0}),
      cookie('pp_ig_return','',{maxAge:0})
    ]);
    return res.redirect(302,`${returnTo}${returnTo.includes('?')?'&':'?'}instagram_status=connected`);
  }catch(e){
    console.error(e);
    return res.redirect(302,`/?instagram_status=error&message=${encodeURIComponent(e.message)}`);
  }
}
