import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'The demo owner has not connected the OpenAI API key yet.' });
  }

  try {
    const { imageDataUrl, fileName, accountContext } = req.body || {};
    if (!imageDataUrl) return res.status(400).json({ error: 'Missing image data.' });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const brandName = accountContext?.brandName || 'the account';
    const platform = accountContext?.platform || 'Instagram';

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'image_fact_extraction',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              fact_summary: { type: 'string' },
              overall_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              primary_subject: { type: 'string' },
              setting: { type: 'string' },
              mood: { type: 'string' },
              visible_facts: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    detail: { type: 'string' },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
                  },
                  required: ['detail', 'confidence']
                }
              },
              safe_caption_angles: { type: 'array', items: { type: 'string' } },
              grouping_tags: { type: 'array', items: { type: 'string' } },
              post_usefulness: { type: 'string', enum: ['single', 'group', 'story'] },
              do_not_claim: { type: 'array', items: { type: 'string' } }
            },
            required: ['fact_summary', 'overall_confidence', 'primary_subject', 'setting', 'mood', 'visible_facts', 'safe_caption_angles', 'grouping_tags', 'post_usefulness', 'do_not_claim']
          }
        }
      },
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                `You are the image analysis layer for PicPlanr.\n` +
                `Your job is only to extract supported visual facts. Accuracy matters more than creativity.\n` +
                `Never guess hidden details, policies, event types, pets, relationships, names, locations, or business claims unless they are clearly visible.\n` +
                `If something is uncertain, keep it broad.\n` +
                `Only include high or medium confidence facts in visible_facts.\n` +
                `In do_not_claim, list unsupported or risky claims the caption writer should avoid.`
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Analyse this image for ${brandName} on ${platform}.\n` +
                `Return only supported visual facts.\n` +
                `File name: ${fileName || 'image'}.\n` +
                `Account type: ${accountContext?.accountType || 'Unknown'}.`
            },
            {
              type: 'image_url',
              image_url: { url: imageDataUrl }
            }
          ]
        }
      ]
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      return res.status(401).json({ error: 'The OpenAI API key is invalid or not authorised.' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'The OpenAI account has reached a rate or billing limit.' });
    }
    return res.status(500).json({ error: 'Image analysis failed. Please try again.' });
  }
}
