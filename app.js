/**
 * Pomodoro Timer with Segmented Lights
 * Segments:
 *  - 25 min Work intervals: Green lights
 *  - 5 min Short Rest intervals: Orange lights
 *  - 20 min Long Rest interval: Yellow light
 */

// --- Segment Configuration ---
const SEGMENTS = [
  { id: 1, type: 'work', durationSec: 25 * 60, name: 'Focus Session 1', color: 'green', subtext: 'Work interval • Stay focused' },
  { id: 2, type: 'shortRest', durationSec: 5 * 60, name: 'Short Rest 1', color: 'orange', subtext: 'Short break • Stretch & breathe' },
  { id: 3, type: 'work', durationSec: 25 * 60, name: 'Focus Session 2', color: 'green', subtext: 'Work interval • Deep work mode' },
  { id: 4, type: 'shortRest', durationSec: 5 * 60, name: 'Short Rest 2', color: 'orange', subtext: 'Short break • Hydrate & relax' },
  { id: 5, type: 'work', durationSec: 25 * 60, name: 'Focus Session 3', color: 'green', subtext: 'Work interval • Keep momentum' },
  { id: 6, type: 'shortRest', durationSec: 5 * 60, name: 'Short Rest 3', color: 'orange', subtext: 'Short break • Rest your eyes' },
  { id: 7, type: 'work', durationSec: 25 * 60, name: 'Focus Session 4', color: 'green', subtext: 'Final work interval • Finish strong' },
  { id: 8, type: 'longRest', durationSec: 20 * 60, name: 'Long Rest', color: 'yellow', subtext: 'Long break • Recharge fully' }
];

const COLOR_MAP = {
  green: {
    color: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.45)',
    soft: 'rgba(34, 197, 94, 0.15)'
  },
  orange: {
    color: '#f97316',
    glow: 'rgba(249, 115, 22, 0.45)',
    soft: 'rgba(249, 115, 22, 0.15)'
  },
  yellow: {
    color: '#facc15',
    glow: 'rgba(250, 204, 21, 0.55)',
    soft: 'rgba(250, 204, 21, 0.15)'
  }
};

// SVG Ring perimeter (2 * PI * 140)
const RING_CIRCUMFERENCE = 2 * Math.PI * 140;

// --- State ---
let currentSegmentIndex = 0;
let secondsRemaining = SEGMENTS[0].durationSec;
let isRunning = false;
let timerInterval = null;
let targetEndTime = null;
let soundEnabled = true;
let notificationsEnabled = false;

// Accomplishment & Time Tracking Statistics
let stats = {
  workSeconds: 0,
  restSeconds: 0,
  workCompleted: 0,
  breaksCompleted: 0,
  cyclesCompleted: 0
};

// --- DOM Elements ---
const lightsTrackEl = document.getElementById('lightsTrack');
const cycleSummaryEl = document.getElementById('cycleSummary');
const timeDisplayEl = document.getElementById('timeDisplay');
const segmentNameEl = document.getElementById('segmentName');
const segmentSubtextEl = document.getElementById('segmentSubtext');
const progressFillEl = document.getElementById('progressFill');
const startPauseBtn = document.getElementById('startPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const resetBtn = document.getElementById('resetBtn');
const skipBtn = document.getElementById('skipBtn');
const soundBtn = document.getElementById('soundBtn');
const soundOnIcon = document.getElementById('soundOnIcon');
const soundOffIcon = document.getElementById('soundOffIcon');
const notificationBtn = document.getElementById('notificationBtn');
const notifBadge = document.getElementById('notifBadge');

// Accomplishment Elements
const statsWorkTimeEl = document.getElementById('statsWorkTime');
const statsRestTimeEl = document.getElementById('statsRestTime');
const statsCyclesCompletedEl = document.getElementById('statsCyclesCompleted');
const statsSessionsCountEl = document.getElementById('statsSessionsCount');
const statsRestBreaksCountEl = document.getElementById('statsRestBreaksCount');
const balanceFocusLabelEl = document.getElementById('balanceFocusLabel');
const balanceRestLabelEl = document.getElementById('balanceRestLabel');
const balanceFillWorkEl = document.getElementById('balanceFillWork');
const balanceFillRestEl = document.getElementById('balanceFillRest');
const resetStatsBtn = document.getElementById('resetStatsBtn');

// --- Audio Context for Chimes ---
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays an organic synthesized musical chime
 * @param {'workComplete'|'restComplete'} type
 */
function playChime(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Frequencies: Work complete plays peaceful chime chord, Break complete plays clear bright chime
    const notes = type === 'workComplete' 
      ? [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 (warm major chord)
      : [440.00, 554.37, 659.25, 880.00]; // A4, C#5, E5, A5 (alert awakening chord)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      // Gentle attack and exponential decay for chime/singing bowl sound
      gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.25 / notes.length, now + idx * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.85);
    });
  } catch (err) {
    console.error('Audio playback error:', err);
  }
}

// --- Light Indicators Setup & Rendering ---
function renderLights() {
  lightsTrackEl.innerHTML = '';

  SEGMENTS.forEach((seg, idx) => {
    const button = document.createElement('button');
    button.className = 'light-item';
    button.setAttribute('data-type', seg.type);
    button.setAttribute('data-color', seg.color);
    button.setAttribute('aria-label', `${seg.name} (${formatMinutes(seg.durationSec)})`);
    button.setAttribute('role', 'tab');

    // State classes
    if (idx === currentSegmentIndex) {
      button.classList.add('active');
    } else if (idx < currentSegmentIndex) {
      button.classList.add('completed');
    }

    button.innerHTML = `
      <div class="light-bulb">
        <div class="light-inner-dot"></div>
      </div>
      <span class="light-number">${idx + 1}</span>
      <div class="light-tooltip">${seg.name} (${Math.round(seg.durationSec / 60)}m)</div>
    `;

    button.addEventListener('click', () => {
      switchSegment(idx);
    });

    lightsTrackEl.appendChild(button);
  });
}

function updateLightsState() {
  const lightItems = lightsTrackEl.querySelectorAll('.light-item');
  lightItems.forEach((item, idx) => {
    item.classList.remove('active', 'completed');
    if (idx === currentSegmentIndex) {
      item.classList.add('active');
    } else if (idx < currentSegmentIndex) {
      item.classList.add('completed');
    }
  });

  cycleSummaryEl.textContent = `Segment ${currentSegmentIndex + 1} of ${SEGMENTS.length}`;
}

// --- Theme & Style Dynamic Colors ---
function updateThemeColors() {
  const currentSeg = SEGMENTS[currentSegmentIndex];
  const colorData = COLOR_MAP[currentSeg.color];

  document.documentElement.style.setProperty('--current-color', colorData.color);
  document.documentElement.style.setProperty('--current-glow', colorData.glow);
  document.documentElement.style.setProperty('--current-soft', colorData.soft);
}

// --- Time Formatter ---
function formatMinutes(seconds) {
  return `${Math.floor(seconds / 60)}m`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(totalSeconds) {
  const secs = Math.floor(Math.max(0, totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// --- Display Updates ---
function updateDisplay() {
  const currentSeg = SEGMENTS[currentSegmentIndex];

  // Time readout
  timeDisplayEl.textContent = formatTime(secondsRemaining);
  
  // Title attribute for tab readability
  document.title = `${formatTime(secondsRemaining)} - ${currentSeg.name} | Pomodoro`;

  // Segment Badge & info
  segmentNameEl.textContent = currentSeg.name;
  segmentSubtextEl.textContent = currentSeg.subtext;

  // Ring Progress: 1 is full, 0 is empty
  const progressRatio = secondsRemaining / currentSeg.durationSec;
  const strokeOffset = RING_CIRCUMFERENCE * (1 - progressRatio);
  progressFillEl.style.strokeDashoffset = strokeOffset;

  // Body running state
  if (isRunning) {
    document.body.classList.add('is-running');
  } else {
    document.body.classList.remove('is-running');
  }

  // Play/pause button icons
  if (isRunning) {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    startPauseBtn.title = "Pause Timer (Spacebar)";
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    startPauseBtn.title = "Start Timer (Spacebar)";
  }
}

// --- Timer Control Functions ---
function startTimer() {
  getAudioContext();
  isRunning = true;
  targetEndTime = performance.now() + (secondsRemaining * 1000);

  clearInterval(timerInterval);
  timerInterval = setInterval(tick, 200);

  updateDisplay();
}

function pauseTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  updateDisplay();
}

function toggleTimer() {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function tick() {
  if (!isRunning) return;

  const now = performance.now();
  const diffSec = Math.max(0, Math.round((targetEndTime - now) / 1000));
  secondsRemaining = diffSec;
  updateDisplay();

  if (secondsRemaining <= 0) {
    handleSegmentComplete();
  }
}

function handleSegmentComplete() {
  pauseTimer();

  const completedSeg = SEGMENTS[currentSegmentIndex];

  // Record stats
  if (completedSeg.type === 'work') {
    stats.workCompleted += 1;
  } else {
    stats.breaksCompleted += 1;
  }

  // Completing the last segment (long rest) completes the full 8-segment cycle!
  if (currentSegmentIndex === SEGMENTS.length - 1) {
    stats.cyclesCompleted += 1;
  }

  saveStats();
  renderStats();

  // Play sound & notify
  if (completedSeg.type === 'work') {
    playChime('workComplete');
    sendNotification('Work Session Done! 🎉', `Time for your ${SEGMENTS[(currentSegmentIndex + 1) % SEGMENTS.length].name}. Take a breather!`);
  } else {
    playChime('restComplete');
    sendNotification('Break Finished! ⚡️', `Ready for your next work session? Click start when you are ready.`);
  }

  // Advance to next segment
  const nextIndex = (currentSegmentIndex + 1) % SEGMENTS.length;
  switchSegment(nextIndex, false);
}

function resetSegment() {
  pauseTimer();
  secondsRemaining = SEGMENTS[currentSegmentIndex].durationSec;
  updateDisplay();
}

function switchSegment(index, autoStart = false) {
  pauseTimer();
  currentSegmentIndex = index;
  secondsRemaining = SEGMENTS[currentSegmentIndex].durationSec;
  
  updateThemeColors();
  updateLightsState();
  updateDisplay();

  if (autoStart) {
    startTimer();
  }
}

function skipSegment() {
  const nextIndex = (currentSegmentIndex + 1) % SEGMENTS.length;
  switchSegment(nextIndex, isRunning);
}

// --- Browser Notifications ---
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('This browser does not support desktop notifications.');
    return;
  }

  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      notificationsEnabled = true;
      notifBadge.classList.add('active');
      notificationBtn.classList.add('active');
      sendNotification('Notifications Enabled', 'You will be alerted when intervals finish!');
    } else {
      notificationsEnabled = false;
      notifBadge.classList.remove('active');
      notificationBtn.classList.remove('active');
    }
  });
}

function sendNotification(title, body) {
  if (!notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  try {
    new Notification(title, {
      body: body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏳</text></svg>'
    });
  } catch (err) {
    console.error('Notification error:', err);
  }
}

// --- Sound Controls ---
function toggleSound() {
  soundEnabled = !soundEnabled;
  if (soundEnabled) {
    soundOnIcon.classList.remove('hidden');
    soundOffIcon.classList.add('hidden');
    soundBtn.classList.add('active');
    playChime('restComplete'); // quick audio preview
  } else {
    soundOnIcon.classList.add('hidden');
    soundOffIcon.classList.remove('hidden');
    soundBtn.classList.remove('active');
  }
  localStorage.setItem('pomodoro_sound', soundEnabled);
}

// --- Accomplishments & Statistics Storage ---
function loadStats() {
  const saved = localStorage.getItem('pomodoro_accomplishments') || localStorage.getItem('pomodoro_stats');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migration from previous schema
      if (parsed.focusSeconds && !parsed.workSeconds) {
        parsed.workSeconds = parsed.focusSeconds;
      }
      stats = Object.assign(stats, parsed);
    } catch (e) {
      console.warn('Failed to parse saved stats');
    }
  }
  const savedSound = localStorage.getItem('pomodoro_sound');
  if (savedSound !== null) {
    soundEnabled = savedSound === 'true';
    if (!soundEnabled) {
      soundOnIcon.classList.add('hidden');
      soundOffIcon.classList.remove('hidden');
      soundBtn.classList.remove('active');
    }
  }
}

function saveStats() {
  localStorage.setItem('pomodoro_accomplishments', JSON.stringify(stats));
}

function renderStats() {
  if (!statsWorkTimeEl) return;

  statsWorkTimeEl.textContent = formatDuration(stats.workSeconds);
  statsRestTimeEl.textContent = formatDuration(stats.restSeconds);
  statsCyclesCompletedEl.textContent = stats.cyclesCompleted;

  statsSessionsCountEl.textContent = `${stats.workCompleted} session${stats.workCompleted === 1 ? '' : 's'} done`;
  statsRestBreaksCountEl.textContent = `${stats.breaksCompleted} break${stats.breaksCompleted === 1 ? '' : 's'} taken`;

  // Focus vs Rest Balance Ratio
  const totalTracked = stats.workSeconds + stats.restSeconds;
  if (totalTracked > 0) {
    const workPercent = Math.round((stats.workSeconds / totalTracked) * 100);
    const restPercent = 100 - workPercent;
    balanceFocusLabelEl.textContent = `Focus ${workPercent}%`;
    balanceRestLabelEl.textContent = `Rest ${restPercent}%`;
    balanceFillWorkEl.style.width = `${workPercent}%`;
    balanceFillRestEl.style.width = `${restPercent}%`;
  } else {
    balanceFocusLabelEl.textContent = `Focus 0%`;
    balanceRestLabelEl.textContent = `Rest 0%`;
    balanceFillWorkEl.style.width = `50%`;
    balanceFillRestEl.style.width = `50%`;
  }
}

function resetStats() {
  const confirmed = window.confirm('Are you sure you want to reset your accomplishments history?');
  if (confirmed) {
    stats = {
      workSeconds: 0,
      restSeconds: 0,
      workCompleted: 0,
      breaksCompleted: 0,
      cyclesCompleted: 0
    };
    saveStats();
    renderStats();
  }
}

// --- Live Time Tracker Heartbeat ---
// Accurately tracks working time and resting time second by second while the timer runs
let lastHeartbeatTime = Date.now();
function initHeartbeat() {
  setInterval(() => {
    const now = Date.now();
    const delta = (now - lastHeartbeatTime) / 1000;
    lastHeartbeatTime = now;

    if (isRunning && delta > 0 && delta < 600) {
      const cur = SEGMENTS[currentSegmentIndex];
      if (cur.type === 'work') {
        stats.workSeconds += delta;
      } else {
        stats.restSeconds += delta;
      }

      saveStats();
      renderStats();
    }
  }, 1000);
}

// --- Event Listeners ---
startPauseBtn.addEventListener('click', toggleTimer);
resetBtn.addEventListener('click', resetSegment);
skipBtn.addEventListener('click', skipSegment);
if (resetStatsBtn) {
  resetStatsBtn.addEventListener('click', resetStats);
}

soundBtn.addEventListener('click', toggleSound);
notificationBtn.addEventListener('click', () => {
  if (Notification.permission === 'default') {
    requestNotificationPermission();
  } else if (Notification.permission === 'granted') {
    notificationsEnabled = !notificationsEnabled;
    notificationBtn.classList.toggle('active', notificationsEnabled);
    notifBadge.classList.toggle('active', notificationsEnabled);
  } else {
    alert('Notifications are blocked in your browser settings. Please enable them in site settings if desired.');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    toggleTimer();
  } else if (e.key === 'r' || e.key === 'R') {
    resetSegment();
  } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowRight') {
    skipSegment();
  }
});

// --- Initialization ---
function init() {
  loadStats();
  renderLights();
  updateThemeColors();
  updateLightsState();
  updateDisplay();
  renderStats();
  initHeartbeat();

  if ('Notification' in window && Notification.permission === 'granted') {
    notificationsEnabled = true;
    notifBadge.classList.add('active');
    notificationBtn.classList.add('active');
  }

  soundBtn.classList.toggle('active', soundEnabled);
}

init();
