import Stripe from 'stripe';
import { HttpError, body, json, billingConfigured } from './http.mjs';
import { checked, entitlement } from './services.mjs';
function enabled(env) { if (!billingConfigured(env)) throw new HttpError(503, 'Subscriptions are not available yet.'); }
const idOf = value => typeof value === 'string' ? value : value?.id;
export function paidSubscription(subscriptions, env, now = Date.now()) {
  const allowed = new Set([env.STRIPE_PRICE_MONTHLY, env.STRIPE_PRICE_YEARLY]);
  const eligible = subscriptions.flatMap(subscription => {
    const items = subscription.items?.data || [];
    const paidItems = items.filter(item => allowed.has(idOf(item.price)));
    const end = Math.max(0, ...paidItems.map(item => item.current_period_end || subscription.current_period_end || 0));
    return paidItems.length && ['active','trialing'].includes(subscription.status) && end * 1000 > now
      ? [{ subscription, end }] : [];
  }).sort((a,b) => b.end - a.end);
  return eligible[0] || null;
}
export async function checkout(request, env, db, stripe, user) {
  enabled(env);
  const data = await body(request);
  const price = data.plan === 'monthly' ? env.STRIPE_PRICE_MONTHLY : data.plan === 'yearly' ? env.STRIPE_PRICE_YEARLY : null;
  if (!price) throw new HttpError(400, 'Choose monthly or yearly.');
  const configuredPrice = await stripe.prices.retrieve(price);
  const interval = data.plan === 'monthly' ? 'month' : 'year';
  if (!configuredPrice.active || configuredPrice.currency !== 'usd' || configuredPrice.unit_amount !== (data.plan === 'monthly' ? 300 : 2400) || configuredPrice.recurring?.interval !== interval || configuredPrice.recurring?.interval_count !== 1) {
    throw new HttpError(503, 'The subscription price is not configured correctly. Please contact support.');
  }
  let access = await entitlement(db,user.id);
  if (access.plus) throw new HttpError(409, 'You already have Plus. Use Manage billing to change your plan.');
  if (!access.customerId) {
    const customer = await stripe.customers.create({ email:user.email, metadata:{ tomodo_user_id:user.id } }, { idempotencyKey:`tomodo-customer-${user.id}` });
    checked(await db.from('billing_customers').upsert({ user_id:user.id, stripe_customer_id:customer.id }, { onConflict:'user_id', ignoreDuplicates:true }));
    access = await entitlement(db,user.id);
  }
  const customerId = access.customerId;
  if (!customerId) throw new HttpError(503,'Unable to create billing account. Please retry.');
  const lease = crypto.randomUUID();
  if (!checked(await db.rpc('claim_checkout',{ p_user_id:user.id,p_lease_id:lease }))) throw new HttpError(409,'Checkout is already opening. Please wait a moment.');
  try {
    // Check Stripe as well as the local entitlement: a webhook may still be on its way.
    const subscriptions = await stripe.subscriptions.list({ customer:customerId,status:'all',limit:100 });
    if (subscriptions.has_more) throw new HttpError(409,'Please use Manage billing for this account.');
    if (paidSubscription(subscriptions.data,env)) throw new HttpError(409,'Your subscription is being activated. Refresh your account shortly.');
    const sessions = await stripe.checkout.sessions.list({ customer:customerId,status:'open',limit:100 });
    if (sessions.has_more) throw new HttpError(409,'Please finish your existing checkout first.');
    // Reuse a live session; changing plans first expires the previous one.
    for (const session of sessions.data) {
      if (session.metadata?.tomodo_user_id !== user.id) continue;
      if (session.metadata?.plan === data.plan && session.url) return json({ url:session.url });
      await stripe.checkout.sessions.expire(session.id);
    }
    const origin = new URL(env.APP_ORIGIN).origin;
    const session = await stripe.checkout.sessions.create({
      mode:'subscription',customer:customerId,client_reference_id:user.id,
      line_items:[{ price,quantity:1 }],
      success_url:`${origin}/?checkout=success`,cancel_url:`${origin}/?checkout=cancelled`,
      metadata:{ tomodo_user_id:user.id,plan:data.plan },
      subscription_data:{ metadata:{ tomodo_user_id:user.id } },
      ...(env.STRIPE_AUTOMATIC_TAX === 'true' ? { automatic_tax:{ enabled:true },billing_address_collection:'required',customer_update:{ address:'auto' } } : {}),
      allow_promotion_codes:false
    }, { idempotencyKey:`tomodo-checkout-${lease}` });
    return json({ url:session.url });
  } finally {
    const result = await db.rpc('release_checkout',{ p_user_id:user.id,p_lease_id:lease });
    if (result.error) console.error('Checkout lease release failed');
  }
}
export async function portal(env,db,stripe,user) {
  enabled(env);
  const access = await entitlement(db,user.id);
  if (!access.customerId) throw new HttpError(404,'No billing account yet.');
  const session = await stripe.billingPortal.sessions.create({ customer:access.customerId,return_url:`${new URL(env.APP_ORIGIN).origin}/?billing=returned` });
  return json({ url:session.url });
}
export async function webhook(request,env,db,stripe) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) throw new HttpError(503,'Billing webhook is not configured.');
  const signature = request.headers.get('stripe-signature');
  if (!signature) throw new HttpError(400,'Missing webhook signature.');
  const raw = await request.text();
  if (raw.length > 1000000) throw new HttpError(413,'Webhook too large.');
  let event;
  try { event = await stripe.webhooks.constructEventAsync(raw,signature,env.STRIPE_WEBHOOK_SECRET,300,Stripe.createSubtleCryptoProvider()); }
  catch { throw new HttpError(400,'Invalid webhook signature.'); }
  const accepted = new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed']);
  if (!accepted.has(event.type)) return json({ received:true });
  const customerId = idOf(event.data.object.customer);
  if (!customerId) return json({ received:true });
  const customer = checked(await db.from('billing_customers').select('user_id').eq('stripe_customer_id',customerId).maybeSingle());
  if (!customer) return json({ received:true }); // Other products can share the Stripe account.
  const startedAt = new Date().toISOString();
  const subscriptions = await stripe.subscriptions.list({ customer:customerId,status:'all',limit:100 });
  if (subscriptions.has_more) throw new HttpError(503,'Subscription reconciliation requires a smaller account history.');
  const paid = paidSubscription(subscriptions.data,env);
  // Reconcile current Stripe state, never the possibly old event payload.
  checked(await db.rpc('apply_billing_event',{
    p_event_id:event.id,p_customer_id:customerId,
    p_subscription_id:paid?.subscription.id || null,p_status:paid?.subscription.status || 'free',
    p_access_until:paid ? new Date(paid.end*1000).toISOString() : null,p_started_at:startedAt
  }));
  return json({ received:true });
}
