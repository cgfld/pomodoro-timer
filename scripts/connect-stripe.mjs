import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import Stripe from 'stripe';

const file = new URL('../.dev.vars', import.meta.url);
const version = '2026-02-25.preview';
const webhookUrl = 'https://pomodoro-timer.colegreenfield3.workers.dev/api/stripe-webhook';
const events = ['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'];
async function connect() {
  const source = await readFile(file, 'utf8');
  const env = parseEnv(source);
  if (!/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY?.trim() || '')) throw new Error('A live Stripe secret key is required in .dev.vars.');
  const stripe = new Stripe(env.STRIPE_SECRET_KEY.trim(), { apiVersion:version, maxNetworkRetries:2 });
  const account = await stripe.accounts.retrieve();
  if (account.id !== 'acct_1UXP6z15GQrGdGPl' || !account.charges_enabled) throw new Error('Expected the charge-enabled tomodo.app live account.');
  const products = await stripe.products.list({limit:100,expand:['data.default_price']});
  if (products.has_more) throw new Error('Review product pagination before proceeding.');
  let product = products.data.find(p => p.active && p.metadata?.tomodo_plan === 'yearly');
  if (!product) product = await stripe.products.create({name:'Tomodo Plus',tax_code:'txcd_10103100',metadata:{tomodo_plan:'yearly'},default_price_data:{currency:'usd',unit_amount:1199,recurring:{interval:'year'},tax_behavior:'exclusive'}},{idempotencyKey:'tomodo-plus-live-yearly-1199'});
  const priceId = typeof product.default_price === 'string' ? product.default_price : product.default_price?.id;
  const price = await stripe.prices.retrieve(priceId);
  if (!price.active || !price.livemode || price.unit_amount !== 1199 || price.currency !== 'usd' || price.recurring?.interval !== 'year' || price.recurring?.interval_count !== 1 || product.tax_code !== 'txcd_10103100') throw new Error('Live product does not match the approved annual plan.');
  console.log(`Verified live annual product ${product.id}, price ${price.id}.`);
  // Validate account eligibility without collecting payment or creating a subscription.
  const session = await stripe.checkout.sessions.create({mode:'subscription',line_items:[{price:price.id,quantity:1}],managed_payments:{enabled:true},success_url:'https://tomodo.app/?checkout=success',cancel_url:'https://tomodo.app/?checkout=cancelled',metadata:{purpose:'integration_validation'}});
  await stripe.checkout.sessions.expire(session.id);
  console.log('Live Managed Payments Checkout verified; validation session expired without payment.');
  const configurations = await stripe.billingPortal.configurations.list({limit:100});
  if (!configurations.data.some(c=>c.active && c.is_default)) await stripe.billingPortal.configurations.create({business_profile:{headline:'Manage your Tomodo Plus subscription'},features:{customer_update:{enabled:true,allowed_updates:['email','address']},invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end'}},default_return_url:'https://tomodo.app/'});
  const endpoints = await stripe.webhookEndpoints.list({limit:100});
  if (endpoints.has_more) throw new Error('Review webhook pagination before proceeding.');
  let endpoint = endpoints.data.find(w=>[webhookUrl,'https://tomodo.app/api/stripe-webhook'].includes(w.url));
  let secret = env.STRIPE_WEBHOOK_SECRET;
  if (!endpoint) {
    endpoint = await stripe.webhookEndpoints.create({url:webhookUrl,enabled_events:events,api_version:version,description:'Tomodo live subscription reconciliation'},{idempotencyKey:'tomodo-live-billing-webhook'});
    secret = endpoint.secret;
  } else await stripe.webhookEndpoints.update(endpoint.id,{url:webhookUrl,enabled_events:events,disabled:false});
  if (!secret) throw new Error('Save the existing live endpoint signing secret to STRIPE_WEBHOOK_SECRET.');
  const values = {STRIPE_SECRET_KEY:env.STRIPE_SECRET_KEY.trim(),STRIPE_PRICE_YEARLY:price.id,STRIPE_WEBHOOK_SECRET:secret,BILLING_ENABLED:'true'};
  let updated = source;
  for (const [name,value] of Object.entries(values)) {
    const pattern = new RegExp(`^${name}=.*$`,'m');
    updated = pattern.test(updated) ? updated.replace(pattern,`${name}=${value}`) : `${updated}\n${name}=${value}\n`;
  }
  await writeFile(file,updated,{mode:0o600});
  console.log(`Live webhook ${endpoint.id} configured; credentials saved locally without displaying secrets.`);
  if (!process.argv.includes('--upload')) return;
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--config','wrangler.jsonc'],{stdio:['pipe','inherit','inherit']});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Cloudflare secret upload failed.')));
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(values));
  });
}
connect().catch(error=>{console.error('Stripe setup failed:',error.type || error.name, error.message);process.exitCode=1;});
