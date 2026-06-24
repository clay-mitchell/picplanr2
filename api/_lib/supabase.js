const required=()=>{
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Supabase server settings are missing.');
  return {url,key};
};

async function request(path,{method='GET',body,headers={}}={}){
  const {url,key}=required();
  const r=await fetch(`${url}/rest/v1/${path}`,{
    method,
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...headers},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const text=await r.text();
  const data=text?JSON.parse(text):null;
  if(!r.ok)throw new Error(data?.message||data?.error||`Supabase request failed (${r.status}).`);
  return data;
}

export async function saveInstagramConnection(row){
  return request('social_connections',{method:'POST',body:row,headers:{Prefer:'return=representation'}}).then(x=>x?.[0]);
}

export async function getInstagramConnection(id){
  const rows=await request(`social_connections?id=eq.${encodeURIComponent(id)}&provider=eq.instagram&limit=1`);
  return rows?.[0]||null;
}

export async function deleteInstagramConnection(id){
  return request(`social_connections?id=eq.${encodeURIComponent(id)}&provider=eq.instagram`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
}

export async function saveBrandProfile(row){
  const existing=await request(`brand_profiles?session_id=eq.${encodeURIComponent(row.session_id)}&limit=1`);
  if(existing?.[0]?.id){
    const updated=await request(`brand_profiles?id=eq.${encodeURIComponent(existing[0].id)}`,{
      method:'PATCH',
      body:{
        account_type:row.account_type,
        website:row.website,
        business_name:row.business_name,
        profile_data:row.profile_data,
        updated_at:row.updated_at
      },
      headers:{Prefer:'return=representation'}
    });
    return updated?.[0]||null;
  }
  return request('brand_profiles',{method:'POST',body:row,headers:{Prefer:'return=representation'}}).then(x=>x?.[0]);
}
