import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
const files = await Promise.all(['access.js','daily-stats.js','sync-store.js','account-ui.js','app.js'].map(async file=>[file,await readFile(new URL(`../${file}`,import.meta.url),'utf8')]));
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const day=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
async function boot() {
  const dom=new JSDOM(html,{url:'http://localhost:8788/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.setInterval=()=>0; w.requestAnimationFrame=()=>0; w.alert=()=>{}; w.confirm=()=>true;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  const guest={workSeconds:120,restSeconds:15,workCompleted:0,breaksCompleted:0,cyclesCompleted:0,todayWorkDate:day(),todayWorkSeconds:120,dailyWorkHistory:{[day()]:120}};
  w.localStorage.setItem('pomodoro_accomplishments',JSON.stringify(guest));
  const syncs=[];
  w.TomodoBackend={init(){},sync:async(payload,user)=>syncs.push({payload,user}),history:async()=>({days:{[day()]:{workSeconds:600,restSeconds:60,workCompleted:1,breaksCompleted:0,cyclesCompleted:0}}}),savePreferences:async()=>{},refresh:async()=>{},getState:()=>({})};
  const context=dom.getInternalVMContext();
  for(const [file,source] of files) vm.runInContext(source,context,{filename:file});
  return {dom,w,context,syncs};
}
function account(id='user-a',plus=true) {
  return {ready:true,config:{accountsEnabled:true,billingEnabled:true},user:{id,email:`${id}@example.com`},access:{plus,hasBillingAccount:plus},preferences:{theme:'zen',default_theme:plus?'hourglass':null,goal_seconds:plus?3600:null,timezone:'UTC'}};
}
test('actual app markup boots with free timer, menus, settings, and disabled unconfigured checkout',async()=>{
  const {dom,w}=await boot();
  try {
    assert.equal(w.document.getElementById('timeDisplay').textContent,'25:00');
    assert.equal(w.document.getElementById('statsWorkTime').textContent,'2m 0s');
    assert.equal(w.document.getElementById('unlockPlusBtn').disabled,true);
    w.document.getElementById('alertsMenuToggle').click();
    assert.equal(w.document.getElementById('alertsMenu').hidden,false);
    w.document.getElementById('soundBtn').click();
    assert.equal(w.document.getElementById('soundStatus').textContent,'Off');
    w.document.getElementById('settingsBtn').click();
    assert.equal(w.document.getElementById('settingsDialog').open,true);
    assert.equal(w.document.getElementById('defaultThemeSelect').disabled,true);
    assert.equal(w.document.getElementById('accountSignInForm').hidden,false);
    assert.equal(w.document.getElementById('accountEmail').disabled,true);
    assert.equal(w.document.getElementById('accountSignInBtn').disabled,true);
  } finally {dom.window.close();}
});
test('verified account state unlocks paid controls and combines cloud totals without re-uploading them',async()=>{
  const {dom,w,context,syncs}=await boot();
  try {
    context.nextAccount=account();
    await vm.runInContext('applyAccountState(nextAccount)',context);
    assert.equal(w.document.body.getAttribute('data-theme'),'hourglass');
    assert.equal(w.document.getElementById('dailyFocusGoalInput').disabled,false);
    assert.equal(w.document.getElementById('statsWorkTime').textContent,'10m 0s');
    assert.equal(w.document.getElementById('manageBillingBtn').hidden,false);
    assert.equal(w.document.getElementById('accountSignInForm').hidden,true);
    assert(syncs.length>0);
    assert.equal(syncs[0].user,'user-a');
    assert.equal(syncs[0].payload.rows[0].work_seconds,0);
    assert.equal(JSON.parse(w.localStorage.getItem('tomodo_stats_user-a')||'{"workSeconds":0}').workSeconds,0);
    assert.equal(JSON.parse(w.localStorage.getItem('pomodoro_accomplishments')).workSeconds,120);
  } finally {dom.window.close();}
});
test('changing accounts isolates local sources; sign-out restores guest stats and revokes paid UI',async()=>{
  const {dom,w,context}=await boot();
  try {
    context.nextAccount=account();await vm.runInContext('applyAccountState(nextAccount)',context);
    const a=vm.runInContext('syncSource.sourceId',context);
    context.nextAccount=account('user-b',false);await vm.runInContext('applyAccountState(nextAccount)',context);
    assert.notEqual(vm.runInContext('syncSource.sourceId',context),a);
    assert.equal(w.document.getElementById('defaultThemeSelect').disabled,true);
    assert.equal(w.document.body.getAttribute('data-theme'),'zen');
    context.nextAccount={ready:true,config:{accountsEnabled:true,billingEnabled:true},user:null,access:{plus:false},preferences:null};
    await vm.runInContext('applyAccountState(nextAccount)',context);
    assert.equal(w.document.getElementById('statsWorkTime').textContent,'2m 0s');
    assert.equal(w.document.getElementById('accountSignInForm').hidden,false);
    assert.equal(w.document.getElementById('accountEmail').disabled,false);
    assert.equal(w.document.getElementById('accountSignInBtn').disabled,false);
    assert.equal(w.document.getElementById('manageBillingBtn').hidden,true);
  } finally {dom.window.close();}
});

test('password sign-in, signup mismatch, and email reset use their separate actions',async()=>{
  const {dom,w,context}=await boot();
  const calls=[];
  w.TomodoBackend.signInWithPassword=async(email,password)=>calls.push(['signin',email,password]);
  w.TomodoBackend.signUp=async(email,password)=>{calls.push(['signup',email,password]);return {signedIn:false};};
  w.TomodoBackend.resetPassword=async email=>calls.push(['reset',email]);
  w.TomodoBackend.signIn=async email=>calls.push(['link',email]);
  try {
    context.nextAccount={ready:true,config:{accountsEnabled:true,billingEnabled:false},user:null,access:{plus:false},preferences:null};
    await vm.runInContext('applyAccountState(nextAccount)',context);
    const email=w.document.getElementById('accountEmail');email.value='person@example.com';
    const password=w.document.getElementById('accountPassword');password.value='test password phrase';
    w.document.getElementById('accountSignInForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls[0][0],'signin');assert.equal(password.value,'');
    w.document.querySelector('[data-auth-mode="signup"]').click();
    assert.equal(w.document.getElementById('accountPasswordConfirmWrap').hidden,false);
    password.value='test password phrase';w.document.getElementById('accountPasswordConfirm').value='different phrase';
    w.document.getElementById('accountSignInForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
    assert.equal(calls.length,1);assert.match(w.document.getElementById('accountMessage').textContent,/do not match/);
    w.document.querySelector('[data-auth-mode="signin"]').click();
    w.document.getElementById('forgotPasswordBtn').click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.at(-1)[0],'reset');
    w.document.getElementById('emailLinkBtn').click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.at(-1)[0],'link');
  } finally {w.close();}
});
test('a verified recovery callback opens password settings; saving and closing clears password fields',async()=>{
  const {dom,w,context}=await boot();
  const calls=[];w.TomodoBackend.setPassword=async password=>calls.push(password);
  try {
    context.nextAccount={...account('user-a',false),recovery:true,authCallback:true};
    await vm.runInContext('applyAccountState(nextAccount)',context);
    assert.equal(w.document.getElementById('settingsDialog').open,true);
    assert.equal(w.document.getElementById('accountPasswordSection').hidden,false);
    assert.equal(w.document.getElementById('accountPasswordTitle').textContent,'Choose a new password');
    const password=w.document.getElementById('newAccountPassword');const confirm=w.document.getElementById('confirmNewAccountPassword');
    password.value='a new test passphrase';confirm.value=password.value;
    w.document.getElementById('setPasswordForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.length,1);assert.equal(password.value,'');assert.equal(confirm.value,'');
    password.value='another test password';w.document.getElementById('settingsDialog').close();assert.equal(password.value,'');
    assert(!Object.keys(w.localStorage).some(key=>String(w.localStorage.getItem(key)).includes('a new test passphrase')));
  } finally {w.close();}
});
