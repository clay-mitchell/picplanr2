import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'The demo owner has not connected the OpenAI API key yet.' });
  }

  try {
    const { analyses, accountContext } = req.body || {};
    if (!Array.isArray(analyses) || !analyses.length) {
      return res.status(400).json({ error: 'No analyses supplied.' });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const reducedAnalyses = analyses.map(a => ({
      index: a.index,
      fileName: a.fileName,
      fact_summary: a.fact_summary,
      overall_confidence: a.overall_confidence,
      primary_subject: a.primary_subject,
      setting: a.setting,
      mood: a.mood,
      visible_facts: (a.visible_facts || []).filter(f => f.confidence !== 'low'),
      safe_caption_angles: a.safe_caption_angles || [],
      grouping_tags: a.grouping_tags || [],
      post_usefulness: a.post_usefulness,
      do_not_claim: a.do_not_claim || []
    }));

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'grouped_posts',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    title: { type: 'string' },
                    post_type: { type: 'string', enum: ['single', 'carousel', 'story_set'] },
                    image_indexes: { type: 'array', items: { type: 'number' } },
                    reason: { type: 'string' },
                    safe_angle: { type: 'string' },
                    safe_summary: { type: 'string' },
                    recommended_time: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        day: { type: 'string' },
                        time: { type: 'string' },
                        reason: { type: 'string' }
                      },
                      required: ['day', 'time', 'reason']
                    },
                    captions: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        natural: { type: 'string' },
                        engagement: { type: 'string' },
                        goal_led: { type: 'string' }
                      },
                      required: ['natural', 'engagement', 'goal_led']
                    }
                  },
                  required: ['title', 'post_type', 'image_indexes', 'reason', 'safe_angle', 'safe_summary', 'recommended_time', 'captions']
                }
              }
            },
            required: ['groups']
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
                `You are PicPlanr's caption planner.\n` +
                `You receive image analyses that already contain supported facts.\n` +
                `You must only use those supported facts. Never introduce a detail that is not clearly supported.\n` +
                `Do not mention anything listed under do_not_claim.\n` +
                `If the facts are narrow, keep the caption broad and useful.\n` +
                `Captions should sound human, not robotic or overly descriptive.\n` +
                `Instagram should sound more conversational. LinkedIn should sound more polished and professional.\n` +
                `Create three genuinely different caption options: natural, engagement, goal_led.\n` +
                `For businesses, you may rely on the business context that is explicitly supplied. For individuals, write in a more personal tone.\n` +
                `If multiple images belong together, group them into one carousel or story set. Otherwise use single posts.`
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Account context:\n${JSON.stringify(accountContext, null, 2)}\n\n` +
                `Image analyses:\n${JSON.stringify(reducedAnalyses, null, 2)}\n\n` +
                `Use only safe facts. Recommended timing should be sensible for the account type and platform, but keep the explanation short and practical.`
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
    return res.status(500).json({ error: 'Post grouping failed. Please try again.' });
  }
}
