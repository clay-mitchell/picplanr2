
export async function initialiseTikTokVideoPost({accessToken,videoUrl,caption,privacyLevel='SELF_ONLY'}){
  if(!accessToken)throw new Error('TikTok access token is missing.');
  if(!videoUrl)throw new Error('TikTok video URL is missing.');

  // TikTok requires creator information to be queried and appropriate posting choices shown
  // before direct posting. This adapter is intentionally not activated until the app is
  // reviewed and the user-facing posting settings are complete.
  const creatorResponse=await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/',{
    method:'POST',
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json; charset=UTF-8'}
  });
  if(!creatorResponse.ok)throw new Error(await creatorResponse.text());

  const initResponse=await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/',{
    method:'POST',
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json; charset=UTF-8'},
    body:JSON.stringify({
      post_info:{
        title:caption,
        privacy_level:privacyLevel,
        disable_duet:false,
        disable_comment:false,
        disable_stitch:false,
        video_cover_timestamp_ms:1000
      },
      source_info:{source:'PULL_FROM_URL',video_url:videoUrl}
    })
  });
  if(!initResponse.ok)throw new Error(await initResponse.text());
  return initResponse.json();
}
