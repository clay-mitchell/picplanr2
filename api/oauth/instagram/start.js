import {cookie,randomToken,safeReturnPath} from '../../_lib/http.js';
import {instagramAuthorisationUrl} from '../../_lib/instagram.js';

export default async function handler(req,res){
  try{
    if(!(process.env.META_APP_ID&&process.env.META_APP_SECRET&&process.env.META_REDIRECT_URI)){
      return res.status(503).json({configured:false,message:'Instagram Login is not fully configured in Vercel.'});
    }
    if(!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.TOKEN_ENCRYPTION_KEY)){
      return res.status(503).json({configured:false,message:'Secure connection storage is not fully configured.'});
    }
    const state=randomToken();
    const returnTo=safeReturnPath(req.query?.returnTo||'/?instagram=connected');
    res.setHeader('Set-Cookie',[
      cookie('pp_ig_state',state,{maxAge:600}),
      cookie('pp_ig_return',returnTo,{maxAge:600})
    ]);
    return res.status(200).json({configured:true,url:instagramAuthorisationUrl({state})});
  }catch(e){return res.status(500).json({configured:false,message:e.message})}
}
