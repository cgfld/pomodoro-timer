import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { JSDOM,VirtualConsole } from 'jsdom';
import vm from 'node:vm';
const origin='https://tomodo.app';
const live=process.argv.includes('--live');
const env=parseEnv(await readFile(new URL('../.dev.vars',import.meta.url),'utf8'));
const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const windows=[];
let userId;
const wait=async(predicate,label)=>{
  for(let i=0;i<150;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}
  throw new Error(`Timed out: ${label}`);
};
async function page(url=origin) {
  const asset=async name=>live?(await fetch(`${origin}/${name}`,{cache:'no-store'})).text():readFile(new URL(`../dist/${name}`,import.meta.url),'utf8');
  const dom=new JSDOM(await asset('index.html'),{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
  windows.push(dom);const w=dom.window;
  w.Response=Response;w.Request=Request;w.Headers=Headers;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
  w.setInterval=()=>0;w.requestAnimationFrame=()=>0;w.alert=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.fetch=(input,options={})=>{
    const target=new URL(typeof input==='string'?input:input.url,w.location.href);
    const headers=new Headers(options.headers);
    if(target.origin===origin&&options.method&&options.method!=='GET')headers.set('Origin',origin);
    return fetch(target,{...options,headers});
  };
  const context=dom.getInternalVMContext();
  for(const name of ['access.js','daily-stats.js','sync-store.js','account-client.js','account-ui.js','app.js'])vm.runInContext(await asset(name),context,{filename:name});
  await wait(()=>w.TomodoBackend?.getState().ready,'account initialization');
  if(w.TomodoBackend.getState().error)throw new Error('Account initialization reported an error.');
  return w;
}
async function savePassword(w,password) {
  if (w.document.getElementById('accountPasswordSection').hidden) w.document.getElementById('togglePasswordBtn').click();
  w.document.getElementById('newAccountPassword').value=password;
  w.document.getElementById('confirmNewAccountPassword').value=password;
  w.document.getElementById('passwordMessage').textContent='';
  w.document.getElementById('setPasswordForm').requestSubmit();
  await wait(()=>w.document.getElementById('passwordMessage').textContent.startsWith('Password saved.'),'password save');
  if(w.document.getElementById('newAccountPassword').value)throw new Error('Password field was not cleared.');
}
try {
  const email=`tomodo-password-check-${crypto.randomUUID()}@example.com`;
  const originalPassword=`Test-original-${crypto.randomUUID()}`;
  const changedPassword=`Test-changed-${crypto.randomUUID()}`;
  const recoveredPassword=`Test-recovered-${crypto.randomUUID()}`;
  const created=await admin.auth.admin.createUser({email,password:originalPassword,email_confirm:true,user_metadata:{tomodo_diagnostic:true}});
  if(created.error)throw new Error('Could not create the disposable password test account.');
  userId=created.data.user.id;
  const w=await page();
  await w.TomodoBackend.signInWithPassword(email,originalPassword);
  await wait(()=>w.document.getElementById('accountSignInForm').hidden,'password sign-in UI');
  if(w.TomodoBackend.getState().user?.id!==userId)throw new Error('Password login resolved to the wrong account.');
  console.log('Password sign-in and live account API: passed.');
  await savePassword(w,changedPassword);
  await w.TomodoBackend.signOut();
  await w.TomodoBackend.signInWithPassword(email,changedPassword);
  console.log('Existing account password change and re-login: passed.');
  const generated=await admin.auth.admin.generateLink({type:'recovery',email,options:{redirectTo:`${origin}/`}});
  if(generated.error)throw new Error('Could not generate the disposable recovery link.');
  const response=await fetch(generated.data.properties.action_link,{redirect:'manual'});
  const location=response.headers.get('location');
  if(!location||new URL(location).origin!==origin)throw new Error('Recovery redirect is not configured for tomodo.app.');
  const recovery=await page(location);
  await wait(()=>recovery.TomodoBackend.getState().user?.id===userId,'recovery session');
  if(!recovery.TomodoBackend.getState().recovery||!recovery.document.getElementById('settingsDialog').open)throw new Error('The reset link did not open password settings.');
  await savePassword(recovery,recoveredPassword);
  if(recovery.TomodoBackend.getState().recovery)throw new Error('Recovery did not finish after saving the password.');
  await recovery.TomodoBackend.signOut();
  await recovery.TomodoBackend.signInWithPassword(email,recoveredPassword);
  console.log('Recovery callback, password reset form, and re-login: passed.');
  console.log('No emails were sent; test passwords existed only in memory.');
} catch(error) {
  // Do not expose URLs, access tokens, or credentials in test output.
  console.error(error.message);process.exitCode=1;
} finally {
  for(const dom of windows)dom.window.close();
  if(userId){const {error}=await admin.auth.admin.deleteUser(userId);if(error){console.error('Temporary test account cleanup failed.');process.exitCode=1;}else console.log('Temporary test account removed.');}
}
