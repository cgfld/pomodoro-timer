const { test } = require('node:test');
const assert = require('node:assert/strict');
const access = require('../access.js');
const daily = require('../daily-stats.js');

function stats() {
  return { workSeconds: 0, restSeconds: 0, dailyWorkHistory: {}, todayWorkSeconds: 0, todayWorkDate: '' };
}

test('only the three advertised themes are free; unknown themes are never available', () => {
  assert.deepEqual(Object.keys(access.themeNames).filter(t => access.canUseTheme(t)), ['tomato', 'sundial', 'zen']);
  for (const theme of Object.keys(access.themeNames)) assert.equal(access.canUseTheme(theme, true), true);
  assert.equal(access.canUseTheme('unknown', true), false);
});

test('today and timer are free; goals and history require Plus', () => {
  for (const feature of ['today', 'timer']) assert.equal(access.canUseFeature(feature), true);
  for (const feature of ['goals', 'history']) {
    assert.equal(access.canUseFeature(feature), false);
    assert.equal(access.canUseFeature(feature, true), true);
  }
  assert.equal(access.canUseFeature('unknown', true), false);
});

test('simulated Plus cannot be enabled on the production domain', () => {
  for (const hostname of ['tomodo.app', 'www.tomodo.app', 'tomodo.pages.dev', 'localhost.example.com']) {
    assert.equal(access.isLocalPreview({ hostname, search: '?review=plus' }), false);
  }
  assert.equal(access.isLocalPreview({ hostname: 'localhost', search: '?review=plus' }), true);
  assert.equal(access.isLocalPreview({ hostname: '127.0.0.1', search: '?review=plus' }), true);
  assert.equal(access.isLocalPreview({ hostname: 'localhost', search: '' }), false);
});

test('legacy daily work migrates without presenting lifetime rest or completions as today', () => {
  const date = new Date(2026, 9, 29, 12);
  const state = { ...stats(), workSeconds: 90000, restSeconds: 30000, workCompleted: 60, todayWorkDate: '2026-10-29', todayWorkSeconds: 300 };
  daily.ensureDay(state, date);
  assert.deepEqual(state.todaySummary, daily.emptyDay('2026-10-29', 300));
  assert.equal(state.workSeconds, 90000);
  assert.equal(state.restSeconds, 30000);
});

test('saved daily totals survive reload and a local midnight starts a fresh day', () => {
  const state = stats();
  daily.ensureDay(state, new Date(2026, 9, 29, 12));
  state.todaySummary.restSeconds = 75;
  state.todaySummary.workCompleted = 2;
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(daily.ensureDay(restored, new Date(2026, 9, 29, 16)), false);
  assert.equal(restored.todaySummary.restSeconds, 75);
  assert.equal(restored.todaySummary.workCompleted, 2);
  assert.equal(daily.ensureDay(restored, new Date(2026, 9, 30, 0)), true);
  assert.deepEqual(restored.todaySummary, daily.emptyDay('2026-10-30'));
});

test('work spanning midnight is assigned to each local day exactly once', () => {
  const state = stats();
  const from = new Date(2026, 9, 29, 23, 59, 58).getTime();
  daily.addTime(state, 'work', from, from + 5000);
  assert.equal(state.dailyWorkHistory['2026-10-29'], 2);
  assert.equal(state.dailyWorkHistory['2026-10-30'], 3);
  assert.equal(state.todaySummary.workSeconds, 3);
  assert.equal(state.workSeconds, 5);
  assert.equal(state.todayWorkDate, '2026-10-30');
  assert.equal(state.todayWorkSeconds, 3);
});

test('rest spanning midnight credits today only for the portion after midnight', () => {
  const state = stats();
  const from = new Date(2026, 9, 29, 23, 59, 59).getTime();
  daily.addTime(state, 'shortRest', from, from + 4000);
  assert.equal(state.restSeconds, 4);
  assert.equal(state.todaySummary.restSeconds, 3);
  assert.equal(state.todaySummary.workSeconds, 0);
  assert.deepEqual(state.dailyWorkHistory, {});
});

test('day boundaries use the local calendar over daylight-saving transitions', () => {
  const state = stats();
  const from = new Date(2026, 10, 1, 23, 59, 59).getTime();
  daily.addTime(state, 'work', from, from + 2000);
  assert.equal(state.dailyWorkHistory['2026-11-01'], 1);
  assert.equal(state.dailyWorkHistory['2026-11-02'], 1);
  assert.equal(state.workSeconds, 2);
});

test('Plus default overrides last used theme; Last used option and Free keep normal startup', () => {
  assert.equal(access.startupTheme('zen', 'astronomical', true), 'astronomical');
  assert.equal(access.startupTheme('hourglass', '', true), 'hourglass');
  assert.equal(access.startupTheme('zen', 'unknown', true), 'zen');
  assert.equal(access.startupTheme('zen', 'astronomical', false), 'zen');
  assert.equal(access.startupTheme('astronomical', 'hourglass', false), 'tomato');
  assert.equal(access.startupTheme(null, null, false), 'tomato');
});
