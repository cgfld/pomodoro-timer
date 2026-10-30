import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { HttpError, configured } from './http.mjs';
export function services(env) {
  if (!configured(env)) throw new HttpError(503, 'Account services are not configured yet.');
  return {
    db: createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } }),
    stripe: env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 }) : null
  };
}
export async function userFor(request, db) {
  const match = request.headers.get('authorization')?.match(/^Bearer (\S+)$/);
  if (!match) throw new HttpError(401, 'Please sign in.');
  const { data, error } = await db.auth.getUser(match[1]);
  if (error || !data?.user?.id) throw new HttpError(401, 'Your sign-in expired. Please sign in again.');
  return data.user;
}
export function checked(result) {
  if (result.error) { console.error('Database request failed:', result.error.code || 'unknown'); throw new HttpError(503, 'Unable to save or load your account. Please retry.'); }
  return result.data;
}
export async function entitlement(db, userId, now = Date.now()) {
  const row = checked(await db.from('billing_customers').select('status,access_until,stripe_customer_id').eq('user_id', userId).maybeSingle());
  const plus = Boolean(row && ['active', 'trialing'].includes(row.status) && Date.parse(row.access_until) > now);
  return { plus, status: row?.status || 'free', accessUntil: row?.access_until || null, customerId: row?.stripe_customer_id || null };
}
export async function requirePlus(db, userId) {
  const access = await entitlement(db, userId);
  if (!access.plus) throw new HttpError(403, 'This feature is included with Plus.');
  return access;
}
