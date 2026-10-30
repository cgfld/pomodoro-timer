import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { handleApi } from '../server/router.mjs';
import { paidSubscription } from '../server/billing.mjs';
import { body, dateKey, timezone, todayIn } from '../server/http.mjs';
import { validateSnapshot } from '../server/activity.mjs';
const env = { APP_ORIGIN:'https://tomodo.app',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'secret-test',STRIPE_SECRET_KEY:'sk_test_example',STRIPE_WEBHOOK_SECRET:'whsec_example',STRIPE_PRICE_MONTHLY:'price_month',STRIPE_PRICE_YEARLY:'price_year',BILLING_ENABLED:'true' };
const userId = '00000000-0000-4000-8000-000000000001';
function fakeDb(access = null) {
  const operations = [];
  const chain = { select(){return this;}, eq(){return this;}, maybeSingle:async()=>({data:access,error:null}) };
  return { operations,auth:{ getUser:async token=>token === 'valid' ? {data:{user:{id:userId,email:'test@example.com'}}} : {data:{user:null},error:{}} },from(name){operations.push(name);return chain;} };
}
function request(path, method='GET',data, origin='https://tomodo.app',token='valid') {
  return new Request(`https://tomodo.app${path}`,{method,headers:{ Authorization:`Bearer ${token}`,Origin:origin,'Content-Type':'application/json' },body:data === undefined ? undefined : JSON.stringify(data) });
}
test('unconfigured accounts fail closed and config never exposes secret keys', async () => {
  const config = await (await handleApi(request('/api/config'),env)).json();
  assert.equal(config.accountsEnabled,true);
  assert(!JSON.stringify(config).includes('secret-test'));
  assert(!JSON.stringify(config).includes('sk_test'));
  assert.equal((await handleApi(request('/api/account'),{})).status,503);
});
test('authentication is verified before reading protected data', async () => {
  const db = fakeDb();
  assert.equal((await handleApi(request('/api/account','GET',undefined,undefined,'invalid'),env,{db})).status,401);
  assert.equal(db.operations.length,0);
});
test('cross-origin writes and unsupported methods are rejected', async () => {
  const db = fakeDb();
  assert.equal((await handleApi(request('/api/preferences','PATCH',{},'https://evil.example'),env,{db})).status,403);
  assert.equal((await handleApi(request('/api/preferences','DELETE'),env,{db})).status,405);
  assert.equal(db.operations.length,0);
});
test('expired and nonpaying accounts cannot fetch history or write paid preferences', async () => {
  const db = fakeDb({status:'active',access_until:'2020-01-01T00:00:00Z'});
  const account = await (await handleApi(request('/api/account'),env,{db})).json();
  assert.equal(account.access.plus,false);
  const history = await handleApi(request('/api/activity?from=2020-01-01&to=2020-01-02'),env,{db});
  assert.equal(history.status,403);
  assert.equal((await handleApi(request('/api/preferences','PATCH',{default_theme:'rolex'}),env,{db})).status,403);
  assert.equal((await handleApi(request('/api/preferences','PATCH',{goal_seconds:3600}),env,{db})).status,403);
  assert.equal(db.operations.filter(x=>x==='activity_sources').length,0);
});
test('paid subscriptions must match an approved price and have a future period end', () => {
  const future = Math.floor(Date.now()/1000)+3600;
  const sub = (status,price,end=future)=>({ id:'sub_1',status,items:{data:[{price:{id:price},current_period_end:end}]} });
  assert.equal(paidSubscription([sub('active','unrelated')],env),null);
  assert.equal(paidSubscription([sub('past_due','price_month')],env),null);
  assert.equal(paidSubscription([sub('active','price_month',1)],env),null);
  assert.equal(paidSubscription([sub('active','price_month')],env).subscription.id,'sub_1');
  assert.equal(paidSubscription([sub('trialing','price_year')],env).end,future);
});
test('a validly signed stale event reconciles current Stripe state instead of granting old access', async () => {
  const stripe = new Stripe('sk_test_example');
  const now = Math.floor(Date.now()/1000);
  const payload = JSON.stringify({id:'evt_stale',type:'customer.subscription.updated',data:{object:{customer:'cus_test',status:'active'}}});
  const signature = stripe.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET,timestamp:now});
  let applied;
  const db = fakeDb({user_id:userId});
  db.rpc = async(name,params)=>{applied={name,params};return {data:null,error:null};};
  stripe.subscriptions.list = async()=>({data:[{id:'sub_cancelled',status:'canceled',items:{data:[]}}],has_more:false});
  const req = new Request('https://tomodo.app/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload});
  assert.equal((await handleApi(req,env,{db,stripe})).status,200);
  assert.equal(applied.params.p_status,'free');
  assert.equal(applied.params.p_access_until,null);
  assert.equal(applied.params.p_event_id,'evt_stale');
});
test('webhooks with forged signatures cannot modify billing', async () => {
  const db = fakeDb();
  const stripe = new Stripe('sk_test_example');
  const req = new Request('https://tomodo.app/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':'t=1,v1=bad'},body:'{}'});
  assert.equal((await handleApi(req,env,{db,stripe})).status,400);
  assert.equal(db.operations.length,0);
});
test('activity validation rejects invalid dates, durations, revisions, and completion counts', () => {
  const valid = {day:'2026-10-29',revision:1,work_seconds:60.1234,rest_seconds:5,work_completed:1,breaks_completed:0,cycles_completed:0};
  assert.equal(validateSnapshot(valid).work_seconds,60.123);
  for (const change of [{day:'2026-02-30'},{revision:0},{work_seconds:-1},{work_seconds:Infinity},{rest_seconds:90000},{work_completed:0.5}]) assert.throws(()=>validateSnapshot({...valid,...change}));
  assert.throws(()=>dateKey('not-a-date'));
  assert.throws(()=>timezone('invalid/timezone'));
  assert.equal(todayIn('America/Los_Angeles',new Date('2026-10-30T01:00:00Z')),'2026-10-29');
});
test('JSON parser rejects oversized and non-object input', async () => {
  await assert.rejects(()=>body(new Request('https://tomodo.app',{method:'POST',headers:{'content-type':'application/json'},body:'[]'})),/Invalid JSON/);
  await assert.rejects(()=>body(new Request('https://tomodo.app',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({large:'a'.repeat(100)})}),20),/too large/);
});

test('Checkout accepts only configured plans and correctly priced Stripe products', async () => {
  const db = fakeDb({status:'free',stripe_customer_id:'cus_test'});
  const stripe = { prices:{ retrieve:async()=>({active:true,currency:'usd',unit_amount:999,recurring:{interval:'month',interval_count:1}}) } };
  assert.equal((await handleApi(request('/api/checkout','POST',{plan:'arbitrary',price:'price_attacker'}),env,{db,stripe})).status,400);
  assert.equal((await handleApi(request('/api/checkout','POST',{plan:'monthly'}),env,{db,stripe})).status,503);
});
test('Checkout uses the verified customer, configured price, and fixed return URLs',async()=>{
  const db = fakeDb({status:'free',stripe_customer_id:'cus_verified'});
  const leases=[];
  db.rpc=async(name,params)=>{leases.push({name,params});return {data:name==='claim_checkout'?true:null,error:null};};
  let captured;
  const stripe={
    prices:{retrieve:async()=>({active:true,currency:'usd',unit_amount:2400,recurring:{interval:'year',interval_count:1}})},
    subscriptions:{list:async()=>({data:[],has_more:false})},
    checkout:{sessions:{list:async()=>({data:[],has_more:false}),create:async(params)=>{captured=params;return {url:'https://checkout.stripe.com/test'};}}}
  };
  const response=await handleApi(request('/api/checkout','POST',{plan:'yearly',customer:'cus_attacker',userId:'attacker',success_url:'https://evil.example'}),env,{db,stripe});
  assert.equal(response.status,200);
  assert.equal(captured.customer,'cus_verified');
  assert.equal(captured.client_reference_id,userId);
  assert.equal(captured.line_items[0].price,'price_year');
  assert.equal(captured.success_url,'https://tomodo.app/?checkout=success');
  assert.equal(leases[0].name,'claim_checkout');
  assert.equal(leases[1].name,'release_checkout');
  assert.equal(leases[0].params.p_lease_id,leases[1].params.p_lease_id);
});
test('parallel Checkout requests stop at the lease and do not create another session',async()=>{
  const db=fakeDb({status:'free',stripe_customer_id:'cus_verified'});
  db.rpc=async()=>({data:false,error:null});
  const stripe={prices:{retrieve:async()=>({active:true,currency:'usd',unit_amount:300,recurring:{interval:'month',interval_count:1}})}};
  assert.equal((await handleApi(request('/api/checkout','POST',{plan:'monthly'}),env,{db,stripe})).status,409);
});
