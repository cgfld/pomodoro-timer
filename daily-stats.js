/* Local calendar helpers keep free daily totals separate from lifetime records. */
(function (root) {
  function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function emptyDay(date, workSeconds = 0) {
    return { date, workSeconds, restSeconds: 0, workCompleted: 0, breaksCompleted: 0, cyclesCompleted: 0 };
  }
  function ensureDay(stats, date = new Date()) {
    const key = dateKey(date);
    const changed = stats.todaySummary?.date !== key;
    if (changed) {
      const legacyWork = stats.todayWorkDate === key ? Number(stats.todayWorkSeconds) || 0 : 0;
      stats.todaySummary = emptyDay(key, Math.max(0, Number(stats.dailyWorkHistory?.[key]) || legacyWork));
    }
    return changed;
  }
  function addTime(stats, type, from, to) {
    if (!(to > from)) return;
    const work = type === 'work';
    let cursor = from;
    while (cursor < to) {
      const date = new Date(cursor);
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      const end = Math.min(midnight, to);
      const seconds = (end - cursor) / 1000;
      ensureDay(stats, date);
      stats.todaySummary[work ? 'workSeconds' : 'restSeconds'] += seconds;
      stats[work ? 'workSeconds' : 'restSeconds'] += seconds;
      if (work) {
        const key = dateKey(date);
        stats.dailyWorkHistory[key] = (Number(stats.dailyWorkHistory[key]) || 0) + seconds;
      }
      cursor = end;
    }
    ensureDay(stats, new Date(to));
    stats.todayWorkDate = dateKey(new Date(to));
    stats.todayWorkSeconds = Number(stats.dailyWorkHistory[stats.todayWorkDate]) || 0;
  }
  const api = Object.freeze({ dateKey, emptyDay, ensureDay, addTime });
  root.TomodoDailyStats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
