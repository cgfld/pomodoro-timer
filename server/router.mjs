import { HttpError, json, sameOrigin, configured, billingConfigured } from './http.mjs';
import { services, userFor, entitlement } from './services.mjs';
import { checkout, portal, webhook } from './billing.mjs';
import { syncActivity, readActivity, preferences } from './activity.mjs';
const methods = {
  '/api/config':['GET'], '/api/account':['GET'], '/api/activity':['GET','POST'],
  '/api/preferences':['GET','PATCH'], '/api/checkout':['POST'], '/api/billing-portal':['POST'], '/api/stripe-webhook':['POST']
};
export async function handleApi(request, env, injectedServices) {
  try {
    const path = new URL(request.url).pathname.replace(/\/$/,'');
    if (!methods[path]) throw new HttpError(404,'API route not found.');
    if (!methods[path].includes(request.method)) return new Response(null,{ status:405,headers:{ Allow:methods[path].join(', '),'Cache-Control':'no-store' } });
    if (path === '/api/config') return json({
      accountsEnabled:configured(env), billingEnabled:billingConfigured(env),
      supabaseUrl:configured(env) ? env.SUPABASE_URL : null,
      supabasePublishableKey:configured(env) ? env.SUPABASE_PUBLISHABLE_KEY : null
    });
    const { db,stripe } = injectedServices || services(env);
    if (path === '/api/stripe-webhook') return await webhook(request,env,db,stripe);
    if (request.method !== 'GET') sameOrigin(request,env);
    const user = await userFor(request,db);
    if (path === '/api/account') {
      const access = await entitlement(db,user.id);
      return json({ user:{ id:user.id,email:user.email },access:{ plus:access.plus,status:access.status,accessUntil:access.accessUntil,hasBillingAccount:Boolean(access.customerId) } });
    }
    if (path === '/api/checkout') return await checkout(request,env,db,stripe,user);
    if (path === '/api/billing-portal') return await portal(env,db,stripe,user);
    const access = await entitlement(db,user.id);
    if (path === '/api/preferences') return await preferences(request,db,user,access);
    if (path === '/api/activity') return request.method === 'POST' ? await syncActivity(request,db,user,access) : await readActivity(request,db,user,access);
    throw new HttpError(404,'API route not found.');
  } catch (error) {
    if (error instanceof HttpError) return json({ error:error.message },error.status);
    console.error('API failure:',error?.type || error?.name || 'unknown');
    return json({ error:'The service is temporarily unavailable. Please retry.' },503);
  }
}
