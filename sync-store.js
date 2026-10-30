/* Versioned per-device snapshots; cloud totals are never written into local sources. */
(function (root) {
  function create(storage, scope, randomId = () => crypto.randomUUID()) {
    const key = `tomodo_sync_${scope}`;
    const read = () => {
      try { const parsed = JSON.parse(storage.getItem(key)); if (parsed?.sourceId && parsed.rows) return parsed; } catch {}
      return { sourceId:randomId(),rows:{},ack:{} };
    };
    let state = read();
    storage.setItem(key,JSON.stringify(state));
    const save = () => storage.setItem(key,JSON.stringify(state));
    return {
      get sourceId() { return state.sourceId; },
      record(day, summary) {
        state = read();
        const values = {
          work_seconds:Number(summary.workSeconds)||0,rest_seconds:Number(summary.restSeconds)||0,
          work_completed:Number(summary.workCompleted)||0,breaks_completed:Number(summary.breaksCompleted)||0,cycles_completed:Number(summary.cyclesCompleted)||0
        };
        const old = state.rows[day];
        if (old && Object.entries(values).every(([k,v]) => old[k] === v)) return;
        state.rows[day] = { day,...values,revision:(old?.revision || 0)+1 };
        save();
      },
      pending(plus,today) {
        state = read();
        return Object.values(state.rows).filter(row => (plus || row.day === today) && row.revision > (state.ack[row.day] || 0));
      },
      acknowledge(rows) {
        state = read();
        for (const row of rows) state.ack[row.day] = Math.max(state.ack[row.day] || 0,row.revision);
        save();
      },
      rows() { state = read(); return Object.values(state.rows); }
    };
  }
  root.TomodoSyncStore = Object.freeze({ create });
  if (typeof module !== 'undefined') module.exports = root.TomodoSyncStore;
})(globalThis);
