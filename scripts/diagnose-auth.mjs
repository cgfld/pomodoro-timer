import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { JSDOM, VirtualConsole } from 'jsdom';
import vm from 'node:vm';
const origin='https://tomodo.app';
const env=parseEnv(await readFile(new URL('../.dev.vars',import.meta.url),'utf8'));
const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let testUserId;
let dom;
try {
  const email=`tomodo-auth-check-${crypto.randomUUID()}@example.com`;
  const created=await admin.auth.admin.createUser({email,email_confirm:true,user_metadata:{tomodo_diagnostic:true}});
  if(created.error) throw new Error(`Temporary test user creation failed (${created.error.status || 'unknown'}).`);
  testUserId=created.data.user.id;
  const generated=await admin.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo:`${origin}/`}});
  if(generated.error) throw new Error(`Test callback generation failed (${generated.error.status || 'unknown'}).`);
  // Generates and consumes one link for the disposable user; no email is sent.
  const verification=await fetch(generated.data.properties.action_link,{redirect:'manual'});
  const location=verification.headers.get('location');
  if(!location) throw new Error(`Verification did not return a redirect (HTTP ${verification.status}).`);
  const destination=new URL(location);
  const hash=new URLSearchParams(destination.hash.slice(1));
  console.log(JSON.stringify({step:'callback',status:verification.status,origin:destination.origin,path:destination.pathname,hasSessionToken:hash.has('access_token'),errorCode:hash.get('error_code')}));
  if(destination.origin!==origin) throw new Error('Supabase is redirecting sign-in to a different Site URL. Configure https://tomodo.app/ as an allowed redirect.');
  if(!hash.get('access_token')) throw new Error(`Test callback did not include a session (${hash.get('error_code') || 'no token'}).`);
  const headers={Authorization:`Bearer ${hash.get('access_token')}`};
  for(const path of ['/api/account','/api/preferences']) {
    const response=await fetch(`${origin}${path}`,{headers});
    const data=await response.json();
    console.log(JSON.stringify({step:path,status:response.status,error:response.ok?null:data.error}));
    if(!response.ok) throw new Error(`The live ${path} endpoint rejected the authenticated session.`);
  }
  const html=await (await fetch(origin)).text();
  const virtualConsole=new VirtualConsole(); // Never print URL/token-bearing browser diagnostics.
  dom=new JSDOM(html,{url:location,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  const w=dom.window;
  w.Response=Response;w.Request=Request;w.Headers=Headers;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
  w.setInterval=()=>0;
  w.fetch=(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,w.location.href);
    const requestHeaders=new Headers(options.headers);
    if(url.origin===origin&&options.method&&options.method!=='GET')requestHeaders.set('Origin',origin);
    return fetch(url, {...options,headers:requestHeaders});
  };
  const context=dom.getInternalVMContext();
  const script=await (await fetch(`${origin}/account-client.js`)).text();
  vm.runInContext(script,context);
  await w.TomodoBackend.init();
  const state=w.TomodoBackend.getState();
  console.log(JSON.stringify({step:'browser-sdk',signedIn:state.user?.id===testUserId,error:state.error}));
  if(state.user?.id!==testUserId) throw new Error('The deployed browser client did not establish the test session.');
  console.log('Live callback, authenticated API routes, and deployed browser session passed. No email was sent.');
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
} finally {
  dom?.window.close();
  if(testUserId) {
    const {error}=await admin.auth.admin.deleteUser(testUserId);
    if(error){console.error('Temporary test user cleanup failed.');process.exitCode=1;}
    else console.log('Temporary test user removed.');
  }
}
