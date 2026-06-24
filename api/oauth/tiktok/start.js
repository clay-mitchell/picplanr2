
import crypto from 'crypto';

export default async function handler(req,res){
  if(!(process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_REDIRECT_URI)){
    return res.status(200).json({
      configured:false,
      message:'TikTok connection needs a TikTok developer application, Login Kit and an approved redirect address.'
    });
  }
  const state=crypto.randomBytes(24).toString('hex');
  const scopes=encodeURIComponent(process.env.TIKTOK_SCOPES||'user.info.basic,video.publish,video.upload');
  const url=`https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(process.env.TIKTOK_CLIENT_KEY)}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(process.env.TIKTOK_REDIRECT_URI)}&state=${state}`;
  return res.status(200).json({configured:true,url});
}
