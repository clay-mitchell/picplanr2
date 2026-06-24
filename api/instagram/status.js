import {parseCookies} from '../_lib/http.js';
import {getInstagramConnection} from '../_lib/supabase.js';

export default async function handler(req,res){
  try{
    const id=parseCookies(req).pp_ig_connection;
    if(!id)return res.status(200).json({connected:false});
    const row=await getInstagramConnection(id);
    if(!row)return res.status(200).json({connected:false});
    return res.status(200).json({connected:true,username:row.provider_account_name,expiresAt:row.token_expires_at});
  }catch(e){return res.status(200).json({connected:false,error:e.message})}
}
