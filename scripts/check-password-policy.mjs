import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
const env=parseEnv(await readFile(new URL('../.dev.vars',import.meta.url),'utf8'));
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,options);
const client=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,options);
let id;
try {
  const email=`tomodo-policy-check-${crypto.randomUUID()}@example.com`;
  const password=`Temporary-${crypto.randomUUID()}`;
  const result=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{tomodo_diagnostic:true}});
  if(result.error)throw new Error('Could not create the disposable policy test account.');
  id=result.data.user.id;
  const signed=await client.auth.signInWithPassword({email,password});
  if(signed.error)throw new Error('Could not sign into the disposable policy test account.');
  const changed=await client.auth.updateUser({password:'x'});
  console.log(JSON.stringify({oneCharacterAccepted:!changed.error,providerMessage:changed.error?.message||null,providerCode:changed.error?.code||null}));
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {if(id){const {error}=await admin.auth.admin.deleteUser(id);if(error){console.error('Temporary test account cleanup failed.');process.exitCode=1;}else console.log('Temporary test account removed.');}}
