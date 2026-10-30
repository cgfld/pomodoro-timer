export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin'
  } });
}
export async function body(request, maxBytes = 32768) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
  if (Number(request.headers.get('content-length')) > maxBytes) throw new HttpError(413, 'Request too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing request body.');
  const chunks = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) { await reader.cancel(); throw new HttpError(413, 'Request too large.'); }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, 'Invalid JSON object.'); }
}
export function sameOrigin(request, env) {
  const expected = new URL(env.APP_ORIGIN).origin;
  if (request.headers.get('origin') !== expected || new URL(request.url).origin !== expected) {
    throw new HttpError(403, 'Request origin is not allowed.');
  }
}
export function configured(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY && env.APP_ORIGIN);
}
export function billingConfigured(env) {
  return configured(env) && env.BILLING_ENABLED === 'true' && Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_MONTHLY && env.STRIPE_PRICE_YEARLY);
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, 'Invalid record identifier.');
  return value;
}
export function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new HttpError(400, 'Invalid calendar date.');
  return value;
}
export function timezone(value = 'UTC') {
  if (typeof value !== 'string' || value.length > 80) throw new HttpError(400, 'Invalid timezone.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return value; }
  catch { throw new HttpError(400, 'Invalid timezone.'); }
}
export function todayIn(zone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new HttpError(400, `Invalid ${name}.`);
  return value;
}
