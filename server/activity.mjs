import { HttpError, body, dateKey, integer, timezone, todayIn, uuid, json } from './http.mjs';
import { checked } from './services.mjs';
const THEMES = new Set(['tomato','sundial','zen','astronomical','rolex','hourglass','retro','rainy','night','forest','winter']);
const FREE = new Set(['tomato','sundial','zen']);
export function validateSnapshot(row) {
  if (!row || typeof row !== 'object') throw new HttpError(400, 'Invalid activity record.');
  const result = { day: dateKey(row.day), revision: integer(row.revision, 1, Number.MAX_SAFE_INTEGER, 'revision') };
  for (const field of ['work_seconds', 'rest_seconds']) {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 86400) throw new HttpError(400, 'Invalid duration.');
    result[field] = Math.round(value * 1000) / 1000;
  }
  for (const field of ['work_completed','breaks_completed','cycles_completed']) result[field] = integer(row[field], 0, field === 'cycles_completed' ? 100 : 500, 'completion count');
  return result;
}
export async function syncActivity(request, db, user, access) {
  const data = await body(request, 100000);
  const source = uuid(data.sourceId);
  const zone = timezone(data.timezone);
  const today = todayIn(zone);
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 100) throw new HttpError(400, 'Send between 1 and 100 activity records.');
  const rows = data.rows.map(validateSnapshot);
  if (new Set(rows.map(r => r.day)).size !== rows.length) throw new HttpError(400, 'Duplicate dates.');
  for (const row of rows) {
    if (row.day > today || row.day < '2000-01-01') throw new HttpError(400, 'Activity date is outside the allowed range.');
    if (!access.plus && row.day !== today) throw new HttpError(403, 'History sync is included with Plus.');
  }
  checked(await db.rpc('sync_activity', { p_user_id: user.id, p_source_id: source, p_rows: rows }));
  return json({ saved: rows.length });
}
export async function readActivity(request, db, user, access) {
  const query = new URL(request.url).searchParams;
  const today = todayIn(timezone(query.get('timezone') || 'UTC'));
  const from = dateKey(query.get('from') || today);
  const to = dateKey(query.get('to') || today);
  if (from > to || Date.parse(to) - Date.parse(from) > 3660 * 86400000) throw new HttpError(400, 'Choose a date range of up to ten years.');
  if (!access.plus && (from !== today || to !== today)) throw new HttpError(403, 'Work history is included with Plus.');
  const excluded = query.get('excludeSource');
  if (excluded) uuid(excluded);
  // Page through sources rather than silently truncating accounts with many days/devices.
  const totals = {};
  for (let page = 0; page < 100; page++) {
    let requestQuery = db.from('activity_sources').select('day,work_seconds,rest_seconds,work_completed,breaks_completed,cycles_completed').eq('user_id', user.id).gte('day', from).lte('day', to).order('day').order('source_id').range(page * 500, page * 500 + 499);
    if (excluded) requestQuery = requestQuery.neq('source_id', excluded);
    const rows = checked(await requestQuery);
    for (const row of rows) {
      const total = totals[row.day] ||= { workSeconds: 0, restSeconds: 0, workCompleted: 0, breaksCompleted: 0, cyclesCompleted: 0 };
      for (const [key, field] of Object.entries({ workSeconds:'work_seconds', restSeconds:'rest_seconds', workCompleted:'work_completed', breaksCompleted:'breaks_completed', cyclesCompleted:'cycles_completed' })) total[key] += Number(row[field]);
    }
    if (rows.length < 500) return json({ days: totals, from, to });
  }
  throw new HttpError(413, 'Please choose a smaller history range.');
}
export async function preferences(request, db, user, access) {
  if (request.method === 'GET') {
    const row = checked(await db.from('account_preferences').select('theme,default_theme,goal_seconds,timezone').eq('user_id', user.id).maybeSingle());
    const result = row || { theme:'tomato', default_theme:null, goal_seconds:7200, timezone:'UTC' };
    if (!access.plus) { result.default_theme = null; result.goal_seconds = null; }
    return json(result);
  }
  const data = await body(request);
  const update = { user_id:user.id, updated_at:new Date().toISOString() };
  if (data.theme !== undefined) {
    if (!THEMES.has(data.theme)) throw new HttpError(400, 'Unknown theme.');
    if (!access.plus && !FREE.has(data.theme)) throw new HttpError(403, 'This theme is included with Plus.');
    update.theme = data.theme;
  }
  if (data.default_theme !== undefined || data.goal_seconds !== undefined) {
    if (!access.plus) throw new HttpError(403, 'Default themes and goals are included with Plus.');
    if (data.default_theme !== undefined) {
      if (data.default_theme !== null && !THEMES.has(data.default_theme)) throw new HttpError(400, 'Unknown default theme.');
      update.default_theme = data.default_theme;
    }
    if (data.goal_seconds !== undefined) {
      update.goal_seconds = integer(data.goal_seconds,1800,43200,'work goal');
      if (update.goal_seconds % 1800) throw new HttpError(400, 'Choose a goal in half-hour increments.');
    }
  }
  if (data.timezone !== undefined) update.timezone = timezone(data.timezone);
  // Initialize once, then patch only supplied columns so saving a theme cannot
  // reset a concurrently saved goal or timezone to the column defaults.
  checked(await db.from('account_preferences').upsert({ user_id:user.id }, { onConflict:'user_id',ignoreDuplicates:true }));
  const { user_id:ignored,...patch } = update;
  checked(await db.from('account_preferences').update(patch).eq('user_id',user.id));
  return json({ saved:true });
}
