import OpenAI from "openai";
const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const schema={type:"object",additionalProperties:false,properties:{caption_title:{type:"string"},caption:{type:"string"},visible_details:{type:"array",items:{type:"string"}},recommended_format:{type:"string"},platform:{type:"string"},hashtags:{type:"array",items:{type:"string"}},clarification_question:{type:"string"},confidence:{type:"string",enum:["high","medium","low"]}},required:["caption_title","caption","visible_details","recommended_format","platform","hashtags","clarification_question","confidence"]};
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed."});
 try{
  const {brandName,businessDescription,tone,platform,images,regenerate}=req.body||{};
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:"The demo owner has not connected the OpenAI API key yet."});
  if(!brandName||!Array.isArray(images)||!images.length)return res.status(400).json({error:"Add a brand name and at least one image."});
  if(images.length>10)return res.status(400).json({error:"Please analyse no more than 10 images at once."});
  const results=[];
  for(let i=0;i<images.length;i++){
   const image=images[i];
   if(!image?.dataUrl?.startsWith("data:image/")){results.push({index:i,error:"Invalid image."});continue}
   const prompt=`You are PicPlanr, a careful social media caption writer. Analyse exactly one uploaded image and create exactly one finished caption that is specific to that image.

Confirmed context:
Brand: ${brandName}
Business description: ${businessDescription||"Not provided"}
Preferred tone: ${tone||"Natural, polished and human"}
Platform: ${platform||"Instagram"}
This is ${regenerate?"a regeneration request, so use a fresh but still accurate angle":"the first caption request"}.

Rules:
- Ground the caption in concrete visible details from this exact image.
- Mention two or more clearly visible details when natural.
- Do not provide alternative ideas, strategy notes, or generic suggestions.
- Do not invent names, identities, locations, event types, products, ingredients, emotions, relationships, prices, results, or offers.
- Do not identify people.
- Avoid vague filler such as "unforgettable moments", "elevate your brand", "something special", and "memories that last".
- If an essential fact is missing, leave caption empty and ask one concise clarification question.
- Write naturally for the selected platform and tone.
- Use no more than five restrained hashtags.
- Return structured JSON only.`;
   const response=await client.responses.create({model:process.env.OPENAI_VISION_MODEL||"gpt-4.1-mini",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image.dataUrl,detail:"high"}]}],text:{format:{type:"json_schema",name:"picplanr_caption",strict:true,schema}}});
   let parsed;try{parsed=JSON.parse(response.output_text)}catch{throw new Error("The AI returned an unreadable response.")}
   results.push({index:i,filename:image.name||`Image ${i+1}`,...parsed});
  }
  return res.status(200).json({results});
 }catch(error){console.error(error);let message=error?.message||"Image analysis failed.";if(error?.status===401)message="The OpenAI API key is invalid or not authorised.";if(error?.status===429)message="The OpenAI account has reached a rate or billing limit.";return res.status(error?.status&&error.status<600?error.status:500).json({error:message});}
}
