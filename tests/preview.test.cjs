const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const policy = require('../access.js');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');

function setup() {
  const stored = new Map([['pomodoro_theme', 'zen']]);
  const app = { inert: false };
  const elements = Object.fromEntries(['themePreviewName', 'themePreviewBar', 'exitThemePreviewBtn'].map(id => [id, { hidden: true, focus() { this.focused = true; } }]));
  const body = { attributes: {}, classList: { add() {}, remove() {} }, setAttribute(k,v) { this.attributes[k] = v; } };
  let paused = 0;
  const prompts = [];
  const context = vm.createContext({
    TomodoAccess: policy, hasPlus: false, currentAccountId:null, preferenceKey:key=>key, document: { body, querySelector: () => app, getElementById: id => elements[id] },
    localStorage: { setItem: (k,v) => stored.set(k,v) }, themePills: [], logoIconEl: null,
    moreThemesToggleEl: { classList: { toggle() {} }, focus() {} },
    openPlusDialog(feature) { prompts.push(feature); },
    updateThemeColors() {}, updateDisplay() {}, playRatchetWind() {},
    pauseTimer() { paused++; vm.runInContext('isRunning = false', context); }
  });
  const palettes = source.slice(source.indexOf('const THEME_PALETTES'), source.indexOf('const COLOR_MAP'));
  const setTheme = source.slice(source.indexOf('function setTheme('), source.indexOf('function updateThemeColors('));
  const startTimer = source.slice(source.indexOf('function startTimer()'), source.indexOf('function pauseTimer()'));
  const previews = source.slice(source.indexOf('function previewPremiumTheme('), source.indexOf('function openPlusDialog('));
  vm.runInContext(palettes + "let currentTheme = 'zen'; let activeThemePreview = null; let isRunning = true;" + setTheme + previews + startTimer, context);
  return { context, stored, app, elements, body, prompts, paused: () => paused };
}

test('premium selection shows the actual theme without a window or changing saved preference', () => {
  const env = setup();
  vm.runInContext("setTheme('astronomical')", env.context);
  assert.equal(env.body.attributes['data-theme'], 'astronomical');
  assert.equal(env.app.inert, false);
  assert.equal(env.prompts.length, 0);
  assert.equal(env.stored.get('pomodoro_theme'), 'zen');
  assert.equal(env.paused(), 1);
  assert.equal(vm.runInContext('isRunning', env.context), false);
});

test('exit restores previous theme and controls without overwriting the saved preference', () => {
  const env = setup();
  vm.runInContext("setTheme('hourglass'); closeThemePreview()", env.context);
  assert.equal(env.body.attributes['data-theme'], 'zen');
  assert.equal(env.app.inert, false);
  assert.equal(env.elements.themePreviewBar.hidden, true);
  assert.equal(env.stored.get('pomodoro_theme'), 'zen');
  assert.equal(vm.runInContext('activeThemePreview', env.context), null);
});

test('restoring a saved premium theme as Free falls back without starting a preview or erasing the preference', () => {
  const env = setup();
  env.stored.set('pomodoro_theme', 'astronomical');
  vm.runInContext("setTheme('astronomical', { restoring: true })", env.context);
  assert.equal(env.body.attributes['data-theme'], 'tomato');
  assert.equal(env.app.inert, false);
  assert.equal(env.paused(), 0);
  assert.equal(env.stored.get('pomodoro_theme'), 'astronomical');
});


test('Start on a premium theme opens Plus and never starts the timer', () => {
  const env = setup();
  vm.runInContext("setTheme('astronomical'); startTimer()", env.context);
  assert.deepEqual(env.prompts, ['astronomical']);
  assert.equal(vm.runInContext('isRunning', env.context), false);
});

test('switching back to a free theme exits preview and saves the chosen free theme', () => {
  const env = setup();
  vm.runInContext("setTheme('hourglass'); setTheme('tomato')", env.context);
  assert.equal(env.body.attributes['data-theme'], 'tomato');
  assert.equal(env.stored.get('pomodoro_theme'), 'tomato');
  assert.equal(vm.runInContext('activeThemePreview', env.context), null);
  assert.equal(env.prompts.length, 0);
});
