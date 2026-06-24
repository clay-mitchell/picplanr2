import {parseCookies} from '../_lib/http.js';
import {getInstagramConnection} from '../_lib/supabase.js';
import {decryptSecret} from '../_lib/crypto.js';
import {getProfile,getRecentMedia,getMediaInsights,normaliseInsights} from '../_lib/instagram.js';

export default async function handler(req,res){
  try{
    const id=parseCookies(req).pp_ig_connection;
    if(!id)return res.status(401).json({error:'Instagram is not connected.'});
    const row=await getInstagramConnection(id);
    if(!row)return res.status(401).json({error:'Instagram connection was not found.'});
    const token=decryptSecret(row.encrypted_access_token);
    const profile=await getProfile(token);
    const media=await getRecentMedia(token,Number(req.query?.limit||30));
    const withInsights=await Promise.all(media.slice(0,30).map(async item=>({...item,insights:normaliseInsights(await getMediaInsights(token,item.id))})));
    return res.status(200).json({profile,media:withInsights,connectedAt:row.created_at});
  }catch(e){return res.status(500).json({error:e.message})}
}
