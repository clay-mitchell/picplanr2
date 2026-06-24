import {parseCookies} from '../_lib/http.js';
import {getInstagramConnection} from '../_lib/supabase.js';

export default async function handler(req,res){
  const databaseReady=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
  const instagramConfigured=Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET&&process.env.META_REDIRECT_URI&&process.env.TOKEN_ENCRYPTION_KEY);
  let instagramConnected=false;
  try{
    const id=parseCookies(req).pp_ig_connection;
    instagramConnected=Boolean(id&&databaseReady&&await getInstagramConnection(id));
  }catch{}
  const testMode=process.env.PUBLISHING_TEST_MODE!=='false';
  res.status(200).json({
    configured:databaseReady&&instagramConfigured,
    testMode,
    databaseReady,
    storageReady:Boolean(process.env.BLOB_READ_WRITE_TOKEN||process.env.SUPABASE_STORAGE_BUCKET),
    instagramConfigured,
    linkedinConfigured:Boolean(process.env.LINKEDIN_CLIENT_ID&&process.env.LINKEDIN_CLIENT_SECRET&&process.env.LINKEDIN_REDIRECT_URI),
    tiktokConfigured:Boolean(process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_CLIENT_SECRET&&process.env.TIKTOK_REDIRECT_URI),
    schedulerReady:Boolean(process.env.CRON_SECRET),
    instagramConnected,
    linkedinConnected:false,
    tiktokConnected:false
  });
}
