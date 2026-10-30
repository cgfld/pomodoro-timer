const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../sync-store.js');
function storage() { const map = new Map(); return { getItem:k=>map.get(k) || null, setItem:(k,v)=>map.set(k,v) }; }
test('snapshots retry without adding time or losing changes while a sync is in flight', () => {
  const store = create(storage(),'user-a',()=> 'source-a');
  store.record('2026-10-29',{workSeconds:60});
  const request = store.pending(true,'2026-10-29');
  store.record('2026-10-29',{workSeconds:90});
  store.acknowledge(request);
  const retry = store.pending(true,'2026-10-29');
  assert.equal(retry.length,1);
  assert.equal(retry[0].work_seconds,90);
  assert.equal(retry[0].revision,2);
  store.acknowledge(retry);
  assert.equal(store.pending(true,'2026-10-29').length,0);
});
test('unchanged snapshots do not advance revisions; day resets are new snapshots', () => {
  const store = create(storage(),'user-a',()=> 'source-a');
  store.record('2026-10-29',{workSeconds:60});
  store.record('2026-10-29',{workSeconds:60});
  assert.equal(store.rows()[0].revision,1);
  store.record('2026-10-29',{workSeconds:0});
  assert.equal(store.rows()[0].revision,2);
  assert.equal(store.rows()[0].work_seconds,0);
});
test('account scopes are independent and Free sync excludes old days', () => {
  const disk = storage();
  const a = create(disk,'user-a',()=> 'source-a');
  const b = create(disk,'user-b',()=> 'source-b');
  a.record('2026-10-28',{workSeconds:50});
  a.record('2026-10-29',{workSeconds:70});
  assert.equal(b.rows().length,0);
  assert.equal(a.pending(false,'2026-10-29').length,1);
  assert.equal(a.pending(true,'2026-10-29').length,2);
  assert.equal(create(disk,'user-a',()=> 'unused').sourceId,'source-a');
});
