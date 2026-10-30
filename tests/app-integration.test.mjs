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
