
async function saveToSupabase(posts){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r=await fetch(`${url}/rest/v1/scheduled_posts`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'apikey':key,
      'Authorization':`Bearer ${key}`,
      'Prefer':'return=representation'
    },
    body:JSON.stringify(posts.map(p=>({
      local_id:p.local_id,
      platform:p.platform,
      title:p.title,
      caption:p.caption,
      scheduled_for:p.scheduled_for,
      media_url:p.media_url,
      status:'scheduled',
      post_format:p.post_format,
      media_type:p.media_type||'image'
    })))
  });
  if(!r.ok)throw new Error(await r.text());
  return r.json();
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  const posts=req.body?.posts;
  if(!Array.isArray(posts)||!posts.length)return res.status(400).json({error:'No scheduled posts supplied.'});
  const configured=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
  if(!configured){
    return res.status(200).json({saved:posts.length,testMode:true,message:`${posts.length} posts accepted in safe test mode. Add Supabase credentials to store them permanently.`});
  }
  try{
    const saved=await saveToSupabase(posts);
    return res.status(200).json({saved:saved.length,testMode:false,message:`${saved.length} posts saved to the automatic publishing queue.`});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'Could not save the publishing queue.'});
  }
}
