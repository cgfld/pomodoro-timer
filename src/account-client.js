import { createClient } from '@supabase/supabase-js';
let client;
let state = { ready:false,config:{ accountsEnabled:false,billingEnabled:false },user:null,access:{ plus:false },preferences:null,error:null };
let refreshInFlight;
const emit = () => window.dispatchEvent(new CustomEvent('tomodo:account',{ detail:{ ...state } }));
async function api(path,options = {}) {
  const { data:{ session } } = await client.auth.getSession();
  if (!session) throw new Error('Please sign in.');
  const expected = options.expectedUserId || state.user?.id;
  if (expected && session.user.id !== expected) throw new Error('Account changed. Please refresh.');
  const { expectedUserId, ...fetchOptions } = options;
  const response = await fetch(path,{
    ...fetchOptions, headers:{ 'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...options.headers }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Please try again.');
  return result;
}
async function refresh() {
  if (!client) return state;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const { data:{ session } } = await client.auth.getSession();
    if (!session) { state = { ...state,ready:true,user:null,access:{ plus:false },preferences:null,error:null }; emit(); return state; }
    try {
      const [account,preferences] = await Promise.all([api('/api/account'),api('/api/preferences')]);
      // A sign-out in another tab must not resurrect the prior account.
      const { data:{ session:latest } } = await client.auth.getSession();
      if (latest?.user.id !== account.user.id) return state;
      state = { ...state,...account,preferences,ready:true,error:null };
    } catch (error) {
      // Fail closed for premium access on authentication/service failures.
      const safeUser = state.user?.id === session.user.id ? state.user : null;
      state = { ...state,ready:true,user:safeUser,preferences:null,access:{ plus:false },error:error.message };
    }
    emit(); return state;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
async function init() {
  try {
    const response = await fetch('/api/config',{ cache:'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Account services are not configured yet.');
    const config = await response.json();
    state.config = config;
    if (!config.accountsEnabled) { state.ready = true; emit(); return; }
    client = createClient(config.supabaseUrl,config.supabasePublishableKey,{
      auth:{ persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit' }
    });
    client.auth.onAuthStateChange(() => { setTimeout(() => refresh(),0); });
    await refresh();
    window.addEventListener('focus',() => refresh());
    setInterval(() => refresh(),60000);
  } catch (error) { state = { ...state,ready:true,error:error.message }; emit(); }
}
window.TomodoBackend = Object.freeze({
  init,refresh,getState:() => ({ ...state }),
  async signIn(email) {
    if (!client) throw new Error('Account services are not configured yet.');
    const { error } = await client.auth.signInWithOtp({ email,options:{ emailRedirectTo:`${window.location.origin}/` } });
    if (error) throw error;
  },
  async signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut({ scope:'local' });
    if (error) throw error;
    await refresh();
  },
  savePreferences:values => api('/api/preferences',{ method:'PATCH',body:JSON.stringify(values) }),
  sync:(values,expectedUserId) => api('/api/activity',{ method:'POST',body:JSON.stringify(values),expectedUserId }),
  history:(params,expectedUserId) => api(`/api/activity?${new URLSearchParams(params)}`,{ expectedUserId }),
  async checkout(plan) {
    const result = await api('/api/checkout',{ method:'POST',body:JSON.stringify({ plan }) });
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected checkout destination.');
    window.location.assign(url.href);
  },
  async billingPortal() {
    const result = await api('/api/billing-portal',{ method:'POST',body:'{}' });
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com') throw new Error('Unexpected billing destination.');
    window.location.assign(url.href);
  }
});
