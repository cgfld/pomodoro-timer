import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import Stripe from 'stripe';
import {createClient} from '@supabase/supabase-js';
import {handleApi} from '../server/router.mjs';

async function check() {
  const env=parseEnv(await readFile(new URL('../.dev.vars',import.meta.url),'utf8'));
  const origin='https://tomodo.app';
  const transport='https://pomodoro-timer.colegreenfield3.workers.dev';
  const configResponse=await fetch(`${transport}/api/config`);
  if(!configResponse.ok) throw new Error(`Production configuration returned HTTP ${configResponse.status}.`);
  const config=await configResponse.json();
  if(!config.accountsEnabled || !config.billingEnabled) throw new Error('Production accounts or billing are disabled.');
  console.log('Production accounts and billing are enabled.');
  const stripe=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:'2026-02-25.preview'});
  const db=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  let userId,sessionId,customerId;
  try {
    const email=`billing-check-${randomUUID()}@example.com`;
    const password=randomUUID()+randomUUID();
    const created=await db.auth.admin.createUser({email,password,email_confirm:true});
    if(created.error) throw new Error('Unable to create disposable verification account.');
    userId=created.data.user.id;
    const auth=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const signed=await auth.auth.signInWithPassword({email,password});
    if(signed.error) throw new Error('Unable to sign in verification account.');
    const response=await handleApi(new Request(`${origin}/api/checkout`,{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${signed.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({plan:'yearly'})}),{...env,APP_ORIGIN:origin});
    if(!response.ok) throw new Error(`Authenticated Checkout with live services returned HTTP ${response.status}.`);
    const result=await response.json();
    const row=await db.from('billing_customers').select('stripe_customer_id').eq('user_id',userId).single();
    customerId=row.data?.stripe_customer_id;
    if(!customerId) throw new Error('Production did not persist the Stripe customer.');
    const sessions=await stripe.checkout.sessions.list({customer:customerId,status:'open'});
    const session=sessions.data.find(s=>s.url===result.url);
    sessionId=session?.id;
    if(!session?.livemode || !session.managed_payments?.enabled || session.amount_subtotal!==1199 || session.client_reference_id!==userId) throw new Error('Checkout did not match the expected live annual Managed Payments session.');
    console.log('Authenticated Checkout with live services verified: live, $11.99/year, Managed Payments, persisted customer.');
    const payload=JSON.stringify({id:`evt_tomodo_check_${randomUUID()}`,type:'checkout.session.completed',data:{object:{id:sessionId,customer:customerId}}});
    const signature=stripe.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET});
    const webhook=await fetch(`${transport}/api/stripe-webhook`,{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':signature},body:payload});
    if(!webhook.ok) throw new Error(`Signed production webhook returned HTTP ${webhook.status}.`);
    const access=await db.from('billing_customers').select('status,access_until').eq('user_id',userId).single();
    if(access.error || access.data.status!=='free' || access.data.access_until!==null) throw new Error('Unpaid Checkout incorrectly granted paid access.');
    console.log('Signed webhook accepted and reconciled unpaid account without granting Plus.');
    const portal=await handleApi(new Request(`${origin}/api/billing-portal`,{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${signed.data.session.access_token}`}}),{...env,APP_ORIGIN:origin});
    if(!portal.ok) throw new Error(`Production billing portal returned HTTP ${portal.status}.`);
    console.log('Billing portal with live services verified. No payment taken.');
  } finally {
    if(sessionId) await stripe.checkout.sessions.expire(sessionId);
    if(customerId) await stripe.customers.del(customerId);
    if(userId) {const removed=await db.auth.admin.deleteUser(userId);if(removed.error) throw new Error('Verification user cleanup failed.');}
    console.log('Disposable verification resources cleaned up.');
  }
}
check().catch(e=>{console.error('Live billing verification failed:',e.type||e.name,e.message);process.exitCode=1;});
