import crypto from 'node:crypto';
export default async function handler(req,res){
  if(!(process.env.LINKEDIN_CLIENT_ID&&process.env.LINKEDIN_REDIRECT_URI)){
    return res.status(200).json({configured:false,message:'LinkedIn connection needs a LinkedIn developer application and approved redirect address.'});
  }
  const state=crypto.randomUUID();
  const scope=encodeURIComponent(process.env.LINKEDIN_SCOPES||'openid profile email w_member_social');
  const url=`https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(process.env.LINKEDIN_CLIENT_ID)}&redirect_uri=${encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI)}&state=${encodeURIComponent(state)}&scope=${scope}`;
  return res.status(200).json({configured:true,url});
}
