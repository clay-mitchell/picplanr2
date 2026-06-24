# PicPlanr Version 34 Complete Repository

This package combines the current PicPlanr application with the deep website-analysis upgrade.

## Version 34 addition

- Reads multiple useful public website pages
- Detects brand tone, markets, audiences and positioning
- Highlights website strengths and weaknesses
- Reviews trust signals, enquiry journey and calls to action
- Creates content pillars, quick wins and initial content ideas
- Shows the pages PicPlanr actually explored

# PicPlanr Version 32

This build adds a real public Instagram connection and live Account Strength analysis foundation.

## Included

- Instagram Login start and callback routes
- Security state check to prevent forged login callbacks
- Encrypted Instagram access-token storage
- Supabase connection records
- Live profile and recent-media retrieval
- Available media insights retrieval
- Account Strength analysis using recent Instagram data
- Disconnect option
- Existing PicPlanr content ideas, captions, Stories and calendar retained

## Required Vercel environment variables

- `OPENAI_API_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI=https://www.picplanrapp.com/api/oauth/instagram/callback`
- `TOKEN_ENCRYPTION_KEY` (use a long random value of at least 32 characters)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `INSTAGRAM_SCOPES`
- `INSTAGRAM_AUTH_URL`
- `INSTAGRAM_TOKEN_URL`
- `INSTAGRAM_GRAPH_BASE_URL`
- `OPENAI_VISION_MODEL`

## Meta setup

Add this exact redirect URI to the Instagram Login settings:

`https://www.picplanrapp.com/api/oauth/instagram/callback`

Request the Instagram permissions needed for basic account data, insights and content publishing. Keep the app in testing while using assigned test accounts. Public customer access depends on Meta approval and the app being moved to Live.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor before deploying. The service-role key must only be stored in Vercel and must never be placed in browser code.

## Important launch note

This version provides public Instagram connection and analysis. A full paid launch still needs PicPlanr customer registration, subscription checks, privacy policy, account deletion process, terms, rate limiting and Meta App Review approval.
