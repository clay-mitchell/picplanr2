import dns from 'node:dns/promises';
import net from 'node:net';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_PAGES = 6;
const MAX_TOTAL_TEXT = 42000;
const MAX_PAGE_BYTES = 450000;
const FETCH_TIMEOUT_MS = 10000;

function normaliseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Please enter a website address.');
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only public website addresses can be analysed.');
  }
  url.username = '';
  url.password = '';
  url.hash = '';
  return url;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168);
  }
  const x = String(ip).toLowerCase();
  return x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80:');
}

async function assertPublicHost(url) {
  const hostname = url.hostname.toLowerCase();
  if (!hostname || ['localhost', '0.0.0.0'].includes(hostname)) {
    throw new Error('This website address cannot be analysed.');
  }
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) {
    throw new Error('This website address cannot be analysed.');
  }
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, number) => String.fromCharCode(Number(number)));
}

function stripHtml(html) {
  return decodeEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]);
  }
  return '';
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]) : '';
}

function extractTagText(html, tag) {
  const values = [];
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match;
  while ((match = pattern.exec(html)) && values.length < 30) {
    const text = stripHtml(match[1]);
    if (text) values.push(text);
  }
  return values;
}

function extractButtons(html) {
  const values = [];
  const pattern = /<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  let match;
  while ((match = pattern.exec(html)) && values.length < 40) {
    const text = stripHtml(match[1]);
    if (text && text.length <= 80) values.push(text);
  }
  return [...new Set(values)];
}

function extractSocialLinks(html, base) {
  const social = { instagram: '', linkedin: '', tiktok: '', facebook: '', youtube: '' };
  const pattern = /<a\b[^>]*href=["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      const href = new URL(match[1], base).href;
      if (!social.instagram && /instagram\.com/i.test(href)) social.instagram = href;
      if (!social.linkedin && /linkedin\.com/i.test(href)) social.linkedin = href;
      if (!social.tiktok && /tiktok\.com/i.test(href)) social.tiktok = href;
      if (!social.facebook && /facebook\.com/i.test(href)) social.facebook = href;
      if (!social.youtube && /youtube\.com|youtu\.be/i.test(href)) social.youtube = href;
    } catch {}
  }
  return social;
}

function technicalSignals(html) {
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  const missingAlt = images.filter(tag => !/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;
  return {
    has_mobile_viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    has_meta_description: Boolean(extractMeta(html, 'description')),
    h1_count: extractTagText(html, 'h1').length,
    image_count: images.length,
    images_missing_alt_text: missingAlt,
    has_contact_form: /<form\b/i.test(html),
    has_phone_link: /href=["']tel:/i.test(html),
    has_email_link: /href=["']mailto:/i.test(html),
    has_structured_data: /application\/ld\+json/i.test(html),
    has_testimonial_language: /testimonial|review|what our clients say|customer stories/i.test(stripHtml(html)),
    has_clear_action_language: /book|enquire|contact|buy|shop|request|schedule|reserve|get started|learn more/i.test(stripHtml(html))
  };
}

function pagePriority(pathAndLabel) {
  const value = pathAndLabel.toLowerCase();
  if (/about|our-story|who-we-are/.test(value)) return 9;
  if (/service|product|what-we-do|solutions|venue|wedding|corporate/.test(value)) return 8;
  if (/pricing|package|plan/.test(value)) return 7;
  if (/case-study|portfolio|work|gallery/.test(value)) return 6;
  if (/contact|location|visit/.test(value)) return 5;
  if (/faq|frequently/.test(value)) return 4;
  return 0;
}

function discoverLinks(html, base) {
  const found = [];
  const pattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], base);
      if (url.origin !== base.origin || !['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      const label = stripHtml(match[2]);
      const score = pagePriority(`${url.pathname} ${label}`);
      if (score > 0) found.push({ url: url.href, score });
    } catch {}
  }
  return [...new Map(found.sort((a, b) => b.score - a.score).map(item => [item.url, item])).values()]
    .slice(0, MAX_PAGES - 1);
}

async function fetchPage(inputUrl, redirects = 0) {
  if (redirects > 5) throw new Error('The website redirected too many times.');
  const url = new URL(inputUrl);
  await assertPublicHost(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'user-agent': 'PicPlanr Brand Analyser/2.0',
        accept: 'text/html,application/xhtml+xml'
      }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The website returned an invalid redirect.');
      return fetchPage(new URL(location, url), redirects + 1);
    }
    if (!response.ok) throw new Error(`Website returned ${response.status}.`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) {
      throw new Error('The website did not return a readable web page.');
    }
    const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
    return { url: new URL(response.url || url.href), html };
  } finally {
    clearTimeout(timer);
  }
}

async function collectWebsite(startUrl) {
  const first = await fetchPage(startUrl);
  const links = discoverLinks(first.html, first.url);
  const pages = [first];
  for (const item of links) {
    try {
      pages.push(await fetchPage(item.url));
    } catch (error) {
      console.warn('Skipped website page:', item.url, error.message);
    }
  }
  const seen = new Set();
  return pages.filter(page => {
    if (seen.has(page.url.href)) return false;
    seen.add(page.url.href);
    return true;
  }).map(page => ({
    url: page.url.href,
    title: extractTitle(page.html),
    description: extractMeta(page.html, 'description') || extractMeta(page.html, 'og:description'),
    headings: [...extractTagText(page.html, 'h1'), ...extractTagText(page.html, 'h2')].slice(0, 20),
    actions: extractButtons(page.html).slice(0, 20),
    social_links: extractSocialLinks(page.html, page.url),
    technical: technicalSignals(page.html),
    text: stripHtml(page.html).slice(0, 11000)
  }));
}

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    business_name: { type: 'string' },
    analysis_headline: { type: 'string' },
    brand_summary: { type: 'string' },
    industry: { type: 'string' },
    location: { type: 'string' },
    market_position: { type: 'string' },
    products_services: { type: 'array', items: { type: 'string' } },
    audience_segments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          need: { type: 'string' },
          message: { type: 'string' }
        },
        required: ['name', 'need', 'message']
      }
    },
    brand_personality: { type: 'array', items: { type: 'string' } },
    tone_of_voice: { type: 'string' },
    tone_examples: { type: 'array', items: { type: 'string' } },
    key_selling_points: { type: 'array', items: { type: 'string' } },
    strengths: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, evidence: { type: 'string' } },
        required: ['title', 'evidence']
      }
    },
    weaknesses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, impact: { type: 'string' }, fix: { type: 'string' } },
        required: ['title', 'impact', 'fix']
      }
    },
    conversion_review: {
      type: 'object',
      additionalProperties: false,
      properties: {
        current_journey: { type: 'string' },
        trust_signals: { type: 'array', items: { type: 'string' } },
        missing_trust_signals: { type: 'array', items: { type: 'string' } },
        call_to_action_review: { type: 'string' }
      },
      required: ['current_journey', 'trust_signals', 'missing_trust_signals', 'call_to_action_review']
    },
    search_visibility: {
      type: 'object',
      additionalProperties: false,
      properties: {
        working_well: { type: 'array', items: { type: 'string' } },
        opportunities: { type: 'array', items: { type: 'string' } }
      },
      required: ['working_well', 'opportunities']
    },
    content_pillars: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, purpose: { type: 'string' }, example: { type: 'string' } },
        required: ['title', 'purpose', 'example']
      }
    },
    quick_wins: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { action: { type: 'string' }, reason: { type: 'string' }, effort: { type: 'string' } },
        required: ['action', 'reason', 'effort']
      }
    },
    first_content_ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, angle: { type: 'string' }, format: { type: 'string' } },
        required: ['title', 'angle', 'format']
      }
    },
    recommended_platforms: { type: 'array', items: { type: 'string' } },
    social_links: {
      type: 'object',
      additionalProperties: false,
      properties: {
        instagram: { type: 'string' }, linkedin: { type: 'string' }, tiktok: { type: 'string' },
        facebook: { type: 'string' }, youtube: { type: 'string' }
      },
      required: ['instagram', 'linkedin', 'tiktok', 'facebook', 'youtube']
    },
    confidence_note: { type: 'string' }
  },
  required: [
    'business_name', 'analysis_headline', 'brand_summary', 'industry', 'location', 'market_position',
    'products_services', 'audience_segments', 'brand_personality', 'tone_of_voice', 'tone_examples',
    'key_selling_points', 'strengths', 'weaknesses', 'conversion_review', 'search_visibility',
    'content_pillars', 'quick_wins', 'first_content_ideas', 'recommended_platforms', 'social_links',
    'confidence_note'
  ]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is missing.' });

  try {
    const website = normaliseUrl(req.body?.website);
    const pages = await collectWebsite(website);
    const usefulText = pages.map(page => page.text).join(' ').replace(/\s/g, '');
    if (usefulText.length < 400) {
      throw new Error('We could not read enough useful information from this website. Try another page or enter the details manually.');
    }

    const supplied = req.body?.providedContext || {};
    const pageEvidence = pages.map(page => ({
      url: page.url,
      title: page.title,
      description: page.description,
      headings: page.headings,
      actions: page.actions,
      technical: page.technical,
      text: page.text
    }));
    const combined = JSON.stringify(pageEvidence).slice(0, MAX_TOTAL_TEXT);
    const discoveredSocial = pages.reduce((result, page) => {
      for (const [key, value] of Object.entries(page.social_links || {})) {
        if (!result[key] && value) result[key] = value;
      }
      return result;
    }, { instagram: '', linkedin: '', tiktok: '', facebook: '', youtube: '' });

    const prompt = `You are PicPlanr's evidence-led website and brand strategist. Create a useful, engaging analysis that makes the customer feel their business has genuinely been understood.

Use British English. Analyse only the public website evidence and details explicitly supplied by the customer. Never invent services, locations, audiences, awards, results, prices, clients, guarantees or social profiles. If evidence is missing, say it is not clear.

Website: ${website.href}
Customer-supplied context: ${JSON.stringify(supplied)}
Social links discovered in website HTML: ${JSON.stringify(discoveredSocial)}
Website evidence from ${pages.length} page(s): ${combined}

Requirements:
- Identify likely markets only when supported by services, language, location or page structure.
- Explain tone using actual patterns in the website copy, not generic adjectives alone.
- Strengths must cite observable website evidence.
- Weaknesses must distinguish missing evidence from definite faults.
- Search visibility advice must be limited to on-page signals visible in the supplied HTML. Do not claim rankings, traffic, speed or technical crawl data.
- Conversion advice should review clarity, trust, calls to action and likely customer journey.
- Return 3 to 5 audience segments, 3 to 5 strengths, 3 to 5 weaknesses, exactly 5 content pillars, exactly 3 quick wins and exactly 3 first content ideas.
- quick_wins effort must be one of: Quick, Moderate, Larger task.
- Keep every item practical and concise.
- Do not use em dashes or en dashes.
- Return strict JSON matching the supplied schema.`;

    const result = await client.responses.create({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'picplanr_website_analysis', strict: true, schema: responseSchema } }
    });

    const analysis = JSON.parse(result.output_text);
    analysis.website = website.href;
    analysis.source_pages = pages.map(page => ({ url: page.url, title: page.title }));
    analysis.pages_read = pages.length;
    analysis.discovered_social_links = discoveredSocial;

    const profile = {
      summary: analysis.brand_summary,
      voice_traits: analysis.brand_personality,
      content_direction: analysis.content_pillars.map(item => item.title).join(', '),
      writing_rules: analysis.tone_of_voice,
      confidence_note: analysis.confidence_note,
      brand_profile: analysis
    };

    return res.status(200).json({ analysis, brand_profile: analysis, profile });
  } catch (error) {
    console.error(error);
    const message = error?.name === 'AbortError'
      ? 'The website took too long to respond. Please try again.'
      : (error?.message || 'Website analysis failed.');
    return res.status(400).json({ error: message });
  }
}
