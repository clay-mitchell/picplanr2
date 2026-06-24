import OpenAI from 'openai';
import {parseCookies} from '../_lib/http.js';
import {getInstagramConnection} from '../_lib/supabase.js';
import {decryptSecret} from '../_lib/crypto.js';
import {getProfile,getRecentMedia,getMediaInsights,normaliseInsights} from '../_lib/instagram.js';

const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const avg=a=>a.length?a.reduce((s,n)=>s+(Number(n)||0),0)/a.length:0;

function metrics(media){
  const dated=media.map(x=>new Date(x.timestamp)).filter(x=>!Number.isNaN(x.getTime())).sort((a,b)=>b-a);
  const spanDays=dated.length>1?Math.max(1,(dated[0]-dated[dated.length-1])/86400000):null;
  const postsPerWeek=spanDays?media.length/(spanDays/7):null;
  const types=media.reduce((a,x)=>(a[x.media_type]=(a[x.media_type]||0)+1,a),{});
  const engagements=media.map(x=>(Number(x.like_count)||0)+(Number(x.comments_count)||0)+(Number(x.insights?.saved)||0)+(Number(x.insights?.shares)||0));
  const reaches=media.map(x=>Number(x.insights?.reach)).filter(Number.isFinite);
  return {post_count:media.length,posts_per_week:postsPerWeek?Number(postsPerWeek.toFixed(2)):null,media_types:types,average_visible_engagement:Number(avg(engagements).toFixed(1)),average_reach:reaches.length?Number(avg(reaches).toFixed(1)):null};
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is missing.'});
  try{
    const id=parseCookies(req).pp_ig_connection;
    if(!id)return res.status(401).json({error:'Connect Instagram first.'});
    const row=await getInstagramConnection(id);
    if(!row)return res.status(401).json({error:'Instagram connection was not found.'});
    const token=decryptSecret(row.encrypted_access_token);
    const profile=await getProfile(token);
    const rawMedia=await getRecentMedia(token,30);
    const media=await Promise.all(rawMedia.map(async x=>({...x,insights:normaliseInsights(await getMediaInsights(token,x.id))})));
    const summary=metrics(media);
    const safeMedia=media.map(x=>({id:x.id,caption:x.caption||'',media_type:x.media_type,timestamp:x.timestamp,like_count:x.like_count??null,comments_count:x.comments_count??null,insights:x.insights,permalink:x.permalink||null}));
    const imageUrls=media.filter(x=>x.media_type==='IMAGE'||x.media_type==='CAROUSEL_ALBUM').map(x=>x.media_url).filter(Boolean).slice(0,9);
    const prompt=`You are PicPlanr's evidence-led Instagram Account Strength analyst. Analyse only the live Instagram data supplied. Never invent followers, demographics, reach, saves, shares or outcomes. Profile: ${JSON.stringify(profile)}. Calculated activity metrics: ${JSON.stringify(summary)}. Recent media: ${JSON.stringify(safeMedia)}. Score the account from 0 to 100 across exactly seven categories: Profile clarity, Visual consistency, Content balance, Trust and proof, Video readiness, Posting consistency, Conversion readiness. Use available metrics and captions. Where a category cannot be verified, say what is missing and score cautiously. Return strict JSON with overall_score integer, score_label, hook_message, score_basis, confidence, next_action, breakdown array of exactly 7 objects with category, score integer and reason, strengths array of 3 strings, improvements array of 3 strings, actions array of 3 strings, account_summary string, and evidence_summary object containing posts_reviewed, date_range, posts_per_week, media_mix and available_insights. Use British English. Do not use em dashes or en dashes.`;
    const content=[{type:'input_text',text:prompt},...imageUrls.map(url=>({type:'input_image',image_url:url,detail:'low'}))];
    const out=await client.responses.create({model:process.env.OPENAI_VISION_MODEL||'gpt-4.1',input:[{role:'user',content}],text:{format:{type:'json_object'}}});
    return res.status(200).json({profile,metrics:summary,audit:JSON.parse(out.output_text)});
  }catch(e){console.error(e);return res.status(500).json({error:e.message||'Instagram analysis failed.'})}
}
