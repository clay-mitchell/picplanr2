
async function getDuePosts(){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const now=encodeURIComponent(new Date().toISOString());
  const r=await fetch(`${url}/rest/v1/scheduled_posts?status=eq.scheduled&scheduled_for=lte.${now}&select=*`,{
    headers:{apikey:key,Authorization:`Bearer ${key}`}
  });
  if(!r.ok)throw new Error(await r.text());
  return r.json();
}
async function mark(id,status,error=null){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${url}/rest/v1/scheduled_posts?id=eq.${id}`,{
    method:'PATCH',
    headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},
    body:JSON.stringify({status,last_error:error,published_at:status==='published'?new Date().toISOString():null})
  });
}
export default async function handler(req,res){
  if(process.env.CRON_SECRET&&req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`){
    return res.status(401).json({error:'Unauthorised.'});
  }
  if(!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)){
    return res.status(200).json({processed:0,message:'Publishing database is not configured.'});
  }
  const testMode=process.env.PUBLISHING_TEST_MODE!=='false';
  try{
    const due=await getDuePosts();
    for(const post of due){
      if(testMode){
        await mark(post.id,'published');
        continue;
      }
      // Real provider adapters are activated only after platform app approval and token storage are configured.
      await mark(post.id,'needs_attention','Social account connection or provider publishing adapter is not active.');
    }
    return res.status(200).json({processed:due.length,testMode});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'Scheduled publishing check failed.'});
  }
}
