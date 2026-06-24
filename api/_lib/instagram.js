const graphBase=()=>process.env.INSTAGRAM_GRAPH_BASE_URL||'https://graph.instagram.com';

async function jsonFetch(url,options={}){
  const r=await fetch(url,options);
  const text=await r.text();
  let data={};
  try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!r.ok||data.error)throw new Error(data.error?.message||data.error_description||`Instagram request failed (${r.status}).`);
  return data;
}

export function instagramAuthorisationUrl({state}){
  const clientId=process.env.META_APP_ID;
  const redirectUri=process.env.META_REDIRECT_URI;
  if(!clientId||!redirectUri)throw new Error('META_APP_ID or META_REDIRECT_URI is missing.');
  const scopes=process.env.INSTAGRAM_SCOPES||'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish';
  const p=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:scopes,state});
  return `${process.env.INSTAGRAM_AUTH_URL||'https://www.instagram.com/oauth/authorize'}?${p}`;
}

export async function exchangeCode(code){
  const body=new URLSearchParams({client_id:process.env.META_APP_ID,client_secret:process.env.META_APP_SECRET,grant_type:'authorization_code',redirect_uri:process.env.META_REDIRECT_URI,code});
  const short=await jsonFetch(process.env.INSTAGRAM_TOKEN_URL||'https://api.instagram.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!short.access_token)throw new Error('Instagram did not return an access token.');
  let token=short.access_token;
  let expiresIn=short.expires_in||3600;
  try{
    const p=new URLSearchParams({grant_type:'ig_exchange_token',client_secret:process.env.META_APP_SECRET,access_token:short.access_token});
    const long=await jsonFetch(`${graphBase()}/access_token?${p}`);
    token=long.access_token||token;
    expiresIn=long.expires_in||expiresIn;
  }catch(e){console.warn('Long-lived token exchange was not completed:',e.message)}
  return {accessToken:token,userId:String(short.user_id||''),expiresIn};
}

export async function getProfile(accessToken){
  const fields=process.env.INSTAGRAM_PROFILE_FIELDS||'user_id,username,account_type,media_count';
  const p=new URLSearchParams({fields,access_token:accessToken});
  return jsonFetch(`${graphBase()}/me?${p}`);
}

export async function getRecentMedia(accessToken,limit=30){
  const fields=process.env.INSTAGRAM_MEDIA_FIELDS||'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,like_count,comments_count';
  const p=new URLSearchParams({fields,limit:String(Math.min(Math.max(limit,1),50)),access_token:accessToken});
  const data=await jsonFetch(`${graphBase()}/me/media?${p}`);
  return Array.isArray(data.data)?data.data:[];
}

export async function getMediaInsights(accessToken,mediaId){
  const metrics=process.env.INSTAGRAM_INSIGHT_METRICS||'reach,likes,comments,saved,shares,views';
  const p=new URLSearchParams({metric:metrics,access_token:accessToken});
  try{return await jsonFetch(`${graphBase()}/${encodeURIComponent(mediaId)}/insights?${p}`)}catch{return {data:[]}}
}

export function normaliseInsights(raw){
  return Object.fromEntries((raw?.data||[]).map(x=>[x.name,x.values?.[0]?.value??x.total_value?.value??null]));
}
