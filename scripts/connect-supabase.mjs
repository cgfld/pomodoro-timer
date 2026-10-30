import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// Values stay in the ignored local file, process memory, and Wrangler's stdin.
// Never print credentials or write a temporary file containing them.
const names = ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY'];
async function connect() {
  const env = parseEnv(await readFile(new URL('../.dev.vars',import.meta.url),'utf8'));
  const missing = names.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Fill these values in .dev.vars first: ${missing.join(', ')}`);
  const url = new URL(env.SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname)) throw new Error('Use the HTTPS Supabase project URL, without a path or query.');
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY.trim();
  const secretKey = env.SUPABASE_SECRET_KEY.trim();
  const jwtRole = key => {
    try { return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role; }
    catch { return null; }
  };
  if (!(publicKey.startsWith('sb_publishable_') || jwtRole(publicKey) === 'anon')) throw new Error('SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon key.');
  if (!(secretKey.startsWith('sb_secret_') || jwtRole(secretKey) === 'service_role') || secretKey === publicKey) throw new Error('SUPABASE_SECRET_KEY must be the server secret or legacy service_role key.');

  const auth = await fetch(`${url.origin}/auth/v1/settings`,{ headers:{ apikey:publicKey } });
  if (!auth.ok) throw new Error(`Supabase rejected the project URL or publishable key (HTTP ${auth.status}).`);
  const settings = await auth.json();
  if (!settings.external?.email) throw new Error('Enable email authentication in Supabase before connecting Tomodo.');
  const db = createClient(url.origin,secretKey,{ auth:{persistSession:false,autoRefreshToken:false} });
  for (const [table,column] of Object.entries({ account_preferences:'user_id',activity_sources:'user_id',billing_customers:'user_id',billing_events:'event_id' })) {
    const { error } = await db.from(table).select(column).limit(0);
    if (error) throw new Error(`Database check failed for ${table} (${error.code || 'connection error'}). Run supabase/migrations/202610290001_accounts.sql in Supabase SQL Editor and check the server key.`);
  }
  console.log('Supabase keys, email authentication, and database tables verified.');
  if (process.argv.includes('--check')) return;

  const payload = Object.fromEntries(names.map(name => [name,name === 'SUPABASE_URL' ? url.origin : env[name].trim()]));
  await new Promise((resolve,reject) => {
    const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
    const child = spawn(process.execPath,[cli,'secret','bulk','--config','wrangler.jsonc'],{ stdio:['pipe','inherit','inherit'] });
    child.on('error',reject);
    child.on('exit',code => code === 0 ? resolve() : reject(new Error('Cloudflare secret upload did not finish successfully.')));
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(payload));
  });
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch('https://tomodo.app/api/config',{cache:'no-store'});
    if (response.ok) {
      const config = await response.json();
      if (config.accountsEnabled && config.supabaseUrl === url.origin && config.supabasePublishableKey === publicKey) {
        console.log('Verified: sign-in is enabled on https://tomodo.app. No Stripe settings were changed.');
        return;
      }
    }
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error('Cloudflare accepted the configuration, but live account activation has not been verified yet.');
}
connect().catch(error => { console.error(error.message); process.exitCode = 1; });
