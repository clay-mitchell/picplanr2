import {parseCookies,cookie} from '../_lib/http.js';
import {deleteInstagramConnection} from '../_lib/supabase.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  try{
    const id=parseCookies(req).pp_ig_connection;
    if(id)await deleteInstagramConnection(id);
    res.setHeader('Set-Cookie',cookie('pp_ig_connection','',{maxAge:0}));
    return res.status(200).json({ok:true});
  }catch(e){return res.status(500).json({error:e.message})}
}
