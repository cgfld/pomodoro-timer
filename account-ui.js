let accountAuthMode = 'signin';
let handledAuthReturn = false;
/* Account integration for the existing timer. Cloud aggregates never enter source snapshots. */
function preferenceKey(name) { return currentAccountId ? `${name}_${currentAccountId}` : name; }
function currentTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
function showAccountError(error) {
  document.getElementById('accountMessage').textContent = error?.message || 'Unable to reach your account. Local work is still saved.';
}
function combinedToday() {
  const result = { ...stats.todaySummary };
  const other = cloudDays[getLocalDateKey()] || {};
  for (const key of ['workSeconds','restSeconds','workCompleted','breaksCompleted','cyclesCompleted']) result[key] = (Number(result[key]) || 0) + (Number(other[key]) || 0);
  return result;
}
function combinedWorkHistory() {
  const history = { ...stats.dailyWorkHistory };
  for (const [day,values] of Object.entries(cloudDays)) history[day] = (Number(history[day]) || 0) + (Number(values.workSeconds) || 0);
  return history;
}
function seedSyncSource() {
  if (!syncSource) return;
  const existing = new Set(syncSource.rows().map(row => row.day));
  for (const [day,seconds] of Object.entries(stats.dailyWorkHistory)) {
    if (!existing.has(day) && day !== getLocalDateKey()) syncSource.record(day,{ workSeconds:Number(seconds)||0 });
  }
  syncSource.record(getLocalDateKey(),stats.todaySummary);
}
function restoreSourceIfNeeded() {
  if (!syncSource || localStorage.getItem(statsStorageKey)) return;
  const rows = syncSource.rows();
  if (!rows.length) return;
  stats = emptyStats();
  for (const row of rows) {
    stats.dailyWorkHistory[row.day] = row.work_seconds;
    stats.workSeconds += row.work_seconds;
    stats.restSeconds += row.rest_seconds;
    stats.workCompleted += row.work_completed;
    stats.breaksCompleted += row.breaks_completed;
    stats.cyclesCompleted += row.cycles_completed;
    if (row.day === getLocalDateKey()) stats.todaySummary = {
      date:row.day,workSeconds:row.work_seconds,restSeconds:row.rest_seconds,
      workCompleted:row.work_completed,breaksCompleted:row.breaks_completed,cyclesCompleted:row.cycles_completed
    };
  }
  ensureTodayWorkStats();
}
function scheduleAccountSync() {
  if (!currentAccountId || !window.TomodoBackend || syncTimer) return;
  syncTimer = setTimeout(() => { syncTimer = null; syncAccount().catch(showAccountError); },15000);
}
async function syncAccount() {
  if (syncing || !currentAccountId || !syncSource || !window.TomodoBackend) return;
  syncing = true;
  const account = currentAccountId;
  const generation = syncGeneration;
  const source = syncSource;
  const paid = backendState.access.plus;
  try {
    const pending = source.pending(paid,getLocalDateKey());
    for (let offset = 0; offset < pending.length; offset += 100) {
      if (generation !== syncGeneration) return;
      const rows = pending.slice(offset,offset+100);
      await window.TomodoBackend.sync({ sourceId:source.sourceId,timezone:currentTimezone(),rows },account);
      source.acknowledge(rows);
    }
    if (generation !== syncGeneration) return;
    const today = getLocalDateKey();
    const earliest = new Date(); earliest.setFullYear(earliest.getFullYear() - 10);
    const result = await window.TomodoBackend.history({ from:paid ? getLocalDateKey(earliest) : today,to:today,timezone:currentTimezone(),excludeSource:source.sourceId },account);
    if (generation !== syncGeneration) return;
    cloudDays = result.days;
    renderStats();
    document.getElementById('accountMessage').textContent = 'Statistics synced. Local work is saved while offline.';
  } finally { syncing = false; if (generation !== syncGeneration) scheduleAccountSync(); }
}
function renderPaidFeatures() {
  document.querySelectorAll('[data-premium-content]').forEach(el => { el.hidden = !hasPlus; el.inert = !hasPlus; });
  document.querySelectorAll('[data-premium-teaser]').forEach(el => { el.hidden = hasPlus; });
  dailyFocusGoalInputEl.disabled = !hasPlus;
  document.getElementById('defaultThemeSelect').disabled = !hasPlus;
  document.getElementById('saveDefaultThemeBtn').disabled = !hasPlus;
  document.getElementById('settingsExplorePlusBtn').hidden = hasPlus;
}
function renderAccountUI() {
  const connected = backendState.config.accountsEnabled;
  const user = backendState.user;
  document.getElementById('accountSettingsStatus').textContent = user
    ? `${user.email} · ${backendState.access.plus ? 'Plus' : 'Free'}`
    : localPlusPreview ? 'Tomodo Plus · Local preview' : 'Tomodo Free';
  document.getElementById('accountSettingsNote').textContent = connected
    ? user ? 'Your activity stays with your account. You can manage your subscription below.' : 'Sign in to save your activity and access your subscription on another device.'
    : localPlusPreview ? 'This is a local preview. Connect account services to enable real accounts.' : 'Account services are not configured yet. The free timer works without an account.';
  document.getElementById('accountSignInForm').hidden = Boolean(user);
  document.getElementById('accountEmail').disabled = !connected;
  document.getElementById('accountSignInBtn').disabled = !connected;
  updateAccountAuthMode();
  document.getElementById('accountPasswordSection').hidden = !user;
  for (const id of ['newAccountPassword','confirmNewAccountPassword','saveAccountPasswordBtn']) document.getElementById(id).disabled = !connected || !user;
  document.getElementById('accountPasswordTitle').textContent = backendState.recovery ? 'Choose a new password' : 'Set or change your password';
  document.getElementById('accountPasswordHelp').textContent = backendState.recovery ? 'Your reset link has been verified. Save a new password to finish.' : 'Already using email links? Add a password to the same account. Your statistics and subscription stay with you.';
  document.getElementById('signOutBtn').hidden = !user;
  document.getElementById('refreshAccountBtn').hidden = !user;
  document.getElementById('manageBillingBtn').hidden = !user || !backendState.access.hasBillingAccount || !backendState.config.billingEnabled;
  document.getElementById('importLocalStatsBtn').hidden = !user;
  const enabled = backendState.config.billingEnabled;
  const unlock = document.getElementById('unlockPlusBtn');
  unlock.disabled = !enabled || Boolean(backendState.access.plus);
  unlock.textContent = backendState.access.plus ? 'Plus is active' : enabled ? 'Unlock goals & history' : 'Unlock goals & history · Coming soon';
  document.getElementById('plusPurchaseNote').textContent = enabled
    ? 'Choose monthly or yearly. Manage or cancel your subscription in Settings.'
    : 'Subscriptions are not configured yet.';
  document.getElementById('defaultThemeStatus').textContent = hasPlus
    ? user ? 'Your default theme is saved to your account.' : 'Your default is saved in this browser.'
    : 'Default theme selection is included with Plus.';
  renderPaidFeatures();
}
async function applyAccountState(next) {
  const changed = currentAccountId !== (next.user?.id || null);
  const wasPlus = hasPlus;
  if (changed) {
    if (isRunning) pauseTimer();
    syncGeneration++;
    clearTimeout(syncTimer); syncTimer = null;
    currentAccountId = next.user?.id || null;
    statsStorageKey = currentAccountId ? `tomodo_stats_${currentAccountId}` : 'pomodoro_accomplishments';
    cloudDays = {};
    syncSource = TomodoSyncStore.create(localStorage,currentAccountId || 'guest');
    loadStats();
    restoreSourceIfNeeded();
    seedSyncSource();
  }
  backendState = next;
  hasPlus = Boolean(localPlusPreview || next.access.plus);
  if (next.user && next.preferences) {
    const prefs = next.preferences;
    localStorage.setItem(preferenceKey('pomodoro_theme'),prefs.theme);
    if (prefs.default_theme) localStorage.setItem(preferenceKey('pomodoro_default_theme'),prefs.default_theme);
    else localStorage.removeItem(preferenceKey('pomodoro_default_theme'));
    if (prefs.goal_seconds) localStorage.setItem(preferenceKey(DAILY_WORK_GOAL_STORAGE_KEY),String(prefs.goal_seconds));
  }
  loadDailyWorkGoal();
  if (changed || (!wasPlus && hasPlus)) {
    activeThemePreview = null;
    const saved = localStorage.getItem(preferenceKey('pomodoro_theme'));
    const fallback = localStorage.getItem(preferenceKey('pomodoro_default_theme'));
    setTheme(TomodoAccess.startupTheme(saved,fallback,hasPlus),{ restoring:true });
  } else if (wasPlus && !hasPlus && !TomodoAccess.canUseTheme(currentTheme)) {
    pauseTimer(); activeThemePreview = null;
    setTheme('tomato',{ restoring:true });
  }
  renderAccountUI(); renderStats();
  if (next.authCallback && !handledAuthReturn && (next.user || next.error)) {
    handledAuthReturn = true;
    const settings = document.getElementById('settingsDialog');
    if (!settings.open) settings.showModal();
    if (next.user && next.recovery) {
      document.getElementById('passwordMessage').textContent = 'Enter and confirm your new password.';
      document.getElementById('newAccountPassword').focus();
    } else if (next.user) document.getElementById('accountMessage').textContent = 'You’re signed in.';
  }
  if (next.error) showAccountError(new Error(next.error));
  if (currentAccountId) await syncAccount();
}
async function importLocalStatistics() {
  if (!currentAccountId) return;
  if (!window.confirm('Add the statistics previously saved in this browser to your account? Repeating this import will not count them twice.')) return;
  const guest = TomodoSyncStore.create(localStorage,'guest');
  const rows = guest.rows().filter(row => backendState.access.plus || row.day === getLocalDateKey());
  const account = currentAccountId;
  for (let offset = 0; offset < rows.length; offset += 100) {
    await window.TomodoBackend.sync({ sourceId:guest.sourceId,timezone:currentTimezone(),rows:rows.slice(offset,offset+100) },account);
  }
  await syncAccount();
  document.getElementById('accountMessage').textContent = backendState.access.plus ? 'Previous browser activity imported.' : 'Today’s browser activity imported. Earlier history can be imported with Plus.';
}
function initAccountUI() {
  window.addEventListener('tomodo:account',event => { applyAccountState(event.detail).catch(showAccountError); });
  window.addEventListener('online',() => syncAccount().catch(showAccountError));
  document.addEventListener('visibilitychange',() => {
    if (document.visibilityState === 'hidden') { if (isRunning) flushTrackedTime(); syncAccount().catch(showAccountError); }
  });
  window.addEventListener('storage',event => {
    if (event.key === statsStorageKey) { loadStats(); renderStats(); }
  });
  initPasswordUI();
  document.getElementById('signOutBtn').addEventListener('click',async () => {
    if (isRunning) pauseTimer();
    try { await syncAccount(); } catch { /* Preserve local pending data for the next sign-in. */ }
    try { await window.TomodoBackend.signOut(); } catch (error) { showAccountError(error); }
  });
  document.getElementById('refreshAccountBtn').addEventListener('click',() => window.TomodoBackend.refresh().catch(showAccountError));
  document.getElementById('manageBillingBtn').addEventListener('click',() => window.TomodoBackend.billingPortal().catch(showAccountError));
  document.getElementById('importLocalStatsBtn').addEventListener('click',() => importLocalStatistics().catch(showAccountError));
  document.getElementById('unlockPlusBtn').addEventListener('click',async () => {
    if (!backendState.user) {
      document.getElementById('plusDialog').close();
      const dialog = document.getElementById('settingsDialog');
      if (!dialog.open) dialog.showModal();
      document.getElementById('accountMessage').textContent = 'Sign in first so Plus belongs to your account. Then select your plan in the Plus window.';
      document.getElementById('accountEmail').focus();
      return;
    }
    const button = document.getElementById('unlockPlusBtn');
    button.disabled = true;
    try { await window.TomodoBackend.checkout(document.querySelector('input[name="plusPlan"]:checked').value); }
    catch (error) { document.getElementById('checkoutMessage').textContent = error.message; renderAccountUI(); }
  });
  renderAccountUI();
  if (window.TomodoBackend) window.TomodoBackend.init();
}

function updateAccountAuthMode() {
  const signup = accountAuthMode === 'signup';
  const connected = backendState.config.accountsEnabled;
  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    button.setAttribute('aria-pressed',String(button.dataset.authMode === accountAuthMode));
  });
  document.getElementById('accountAuthHeading').textContent = signup ? 'Create your Tomodo account' : 'Sign in to Tomodo';
  document.getElementById('accountSignInBtn').textContent = signup ? 'Create account' : 'Sign in';
  document.getElementById('accountPasswordConfirmWrap').hidden = !signup;
  document.getElementById('accountPasswordConfirm').disabled = !signup || !connected;
  const password = document.getElementById('accountPassword');
  password.disabled = !connected;
  password.autocomplete = signup ? 'new-password' : 'current-password';
  document.getElementById('forgotPasswordBtn').hidden = signup;
  for (const id of ['forgotPasswordBtn','emailLinkBtn']) document.getElementById(id).disabled = !connected;
  document.getElementById('accountAuthHelp').textContent = signup
    ? 'Confirm your email to finish creating your account.'
    : 'Use your email and password, or sign in with an email link.';
}
function initPasswordUI() {
  const form = document.getElementById('accountSignInForm');
  const password = document.getElementById('accountPassword');
  const confirm = document.getElementById('accountPasswordConfirm');
  const email = document.getElementById('accountEmail');
  const message = document.getElementById('accountMessage');
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click',() => {
    accountAuthMode = button.dataset.authMode;
    password.value = ''; confirm.value = ''; message.textContent = '';
    updateAccountAuthMode();
  }));
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (!backendState.config.accountsEnabled) return;
    const signup = accountAuthMode === 'signup';
    if (signup && password.value !== confirm.value) { message.textContent = 'The passwords do not match.'; confirm.focus(); return; }
    const button = document.getElementById('accountSignInBtn');
    button.disabled = true;
    message.textContent = signup ? 'Creating your account…' : 'Signing in…';
    try {
      if (signup) {
        const result = await window.TomodoBackend.signUp(email.value.trim(),password.value);
        message.textContent = result.signedIn ? 'Your account is ready. You’re signed in.' : 'Check your email to confirm your account. If you already have an account, sign in or reset your password.';
      } else {
        await window.TomodoBackend.signInWithPassword(email.value.trim(),password.value);
        message.textContent = 'You’re signed in.';
      }
      password.value = ''; confirm.value = '';
    } catch (error) { showAccountError(error); }
    finally { button.disabled = !backendState.config.accountsEnabled; }
  });
  const sendEmail = async reset => {
    if (!email.reportValidity()) return;
    const button = document.getElementById(reset ? 'forgotPasswordBtn' : 'emailLinkBtn');
    button.disabled = true;
    try {
      if (reset) await window.TomodoBackend.resetPassword(email.value.trim());
      else await window.TomodoBackend.signIn(email.value.trim());
      message.textContent = reset
        ? 'If an account exists for that email, a password-reset link is on its way. Use the newest email.'
        : 'Check your email for a sign-in link. Use the newest email.';
    } catch (error) { showAccountError(error); }
    finally { button.disabled = !backendState.config.accountsEnabled; }
  };
  document.getElementById('forgotPasswordBtn').addEventListener('click',() => sendEmail(true));
  document.getElementById('emailLinkBtn').addEventListener('click',() => sendEmail(false));
  document.getElementById('setPasswordForm').addEventListener('submit',async event => {
    event.preventDefault();
    if (!backendState.user) return;
    const first = document.getElementById('newAccountPassword');
    const second = document.getElementById('confirmNewAccountPassword');
    const status = document.getElementById('passwordMessage');
    if (first.value !== second.value) { status.textContent = 'The passwords do not match.'; second.focus(); return; }
    const button = document.getElementById('saveAccountPasswordBtn');
    button.disabled = true;
    try {
      await window.TomodoBackend.setPassword(first.value);
      first.value = ''; second.value = '';
      status.textContent = 'Password saved. You can now sign in with your email and password.';
    } catch (error) { status.textContent = error.message || 'Unable to save the password. Please try again.'; }
    finally { button.disabled = !backendState.user; }
  });
  document.getElementById('settingsDialog').addEventListener('close',() => {
    for (const field of [password,confirm,document.getElementById('newAccountPassword'),document.getElementById('confirmNewAccountPassword')]) field.value = '';
  });
}
