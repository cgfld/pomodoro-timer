import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { validatePassword,authErrorMessage } from '../src/auth-policy.mjs';
const original=await readFile(new URL('../src/account-client.js',import.meta.url),'utf8');
const source=original.replace(/import[^\n]+\n/g,'');
function setup({hash='',session=null,initError=null,passwordError=null}={}) {
  let current=session;
  const calls=[];
  const auth={
    initialize:async()=>({error:initError}),getSession:async()=>({data:{session:current},error:null}),onAuthStateChange:()=>{},
    signInWithPassword:async values=>{calls.push(['password',values]);if(!passwordError)current={access_token:'test-token',user:{id:'user-a'}};return {error:passwordError};},
    signUp:async values=>{calls.push(['signup',values]);return {data:{session:null},error:null};},
    resetPasswordForEmail:async(...values)=>{calls.push(['reset',...values]);return {error:null};},
    updateUser:async values=>{calls.push(['update',values]);return {error:null};},
    signInWithOtp:async values=>{calls.push(['link',values]);return {error:null};},
    signOut:async()=>{current=null;return {error:null};}
  };
  const window={location:{origin:'https://tomodo.app',hash},dispatchEvent(){},addEventListener(){}};
  const context=vm.createContext({window,createClient:()=>({auth}),validatePassword,authErrorMessage,URLSearchParams,CustomEvent:class {},setTimeout:()=>0,setInterval:()=>0,fetch:async path=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>path==='/api/config'?{accountsEnabled:true,billingEnabled:false,supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public'}:path==='/api/account'?{user:{id:'user-a',email:'a@example.com'},access:{plus:false}}:{theme:'tomato',default_theme:null,goal_seconds:null}})});
  vm.runInContext(source,context);
  return {backend:window.TomodoBackend,calls};
}
test('password sign-in uses Supabase and refreshes the verified account',async()=>{
  const {backend,calls}=setup();await backend.init();
  await backend.signInWithPassword('a@example.com','test password phrase');
  assert.equal(calls[0][0],'password');assert.equal(calls[0][1].email,'a@example.com');
  assert.equal(backend.getState().user.id,'user-a');
});
test('signup enforces password length and uses the canonical email confirmation destination',async()=>{
  const {backend,calls}=setup();await backend.init();
  await assert.rejects(()=>backend.signUp('a@example.com','short'),/at least 12/);
  assert.equal(calls.length,0);
  const result=await backend.signUp('a@example.com','a long test passphrase');
  assert.equal(result.signedIn,false);
  assert.equal(calls[0][1].options.emailRedirectTo,'https://tomodo.app/');
});
test('reset requests return to the existing allowlisted root, and recovery sessions are recognized',async()=>{
  const {backend,calls}=setup({hash:'#access_token=test&type=recovery',session:{access_token:'test',user:{id:'user-a'}}});
  await backend.init();assert.equal(backend.getState().recovery,true);
  await backend.resetPassword('a@example.com');
  assert.equal(calls[0][0],'reset');assert.equal(calls[0][2].redirectTo,'https://tomodo.app/');
  await backend.setPassword('a new long test passphrase');
  assert.equal(calls[1][0],'update');assert.equal(backend.getState().recovery,false);
});
test('email link sign-in remains available; rejected password login reports a useful message',async()=>{
  const {backend,calls}=setup({passwordError:{code:'invalid_credentials',message:'Invalid login credentials'}});await backend.init();
  await assert.rejects(()=>backend.signInWithPassword('a@example.com','wrong'),/email or password was not accepted/);
  await backend.signIn('a@example.com');assert.equal(calls.at(-1)[0],'link');
});
test('expired callbacks surface a useful error rather than silently appearing signed out',async()=>{
  const {backend}=setup({hash:'#error=access_denied&error_code=otp_expired',initError:{details:{code:'otp_expired'}}});
  await backend.init();assert.equal(backend.getState().authCallback,true);assert.match(backend.getState().error,/expired or has already been used/);
});
