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

const THEME_PALETTES = {
  zen: {
    green: { color: '#789274', glow: 'rgba(120, 146, 116, 0.48)', soft: 'rgba(120, 146, 116, 0.16)' },
    orange: { color: '#b58a5c', glow: 'rgba(181, 138, 92, 0.45)', soft: 'rgba(181, 138, 92, 0.15)' },
    yellow: { color: '#9c8056', glow: 'rgba(156, 128, 86, 0.45)', soft: 'rgba(156, 128, 86, 0.16)' }
  },
  sundial: {
    green: { color: '#75834f', glow: 'rgba(117, 131, 79, 0.48)', soft: 'rgba(117, 131, 79, 0.16)' },
    orange: { color: '#bd7045', glow: 'rgba(189, 112, 69, 0.46)', soft: 'rgba(189, 112, 69, 0.16)' },
    yellow: { color: '#d0aa5d', glow: 'rgba(208, 170, 93, 0.5)', soft: 'rgba(208, 170, 93, 0.16)' }
  },
  rainy: {
    green: { color: '#628e8a', glow: 'rgba(98, 142, 138, 0.48)', soft: 'rgba(98, 142, 138, 0.16)' },
    orange: { color: '#7e9fb5', glow: 'rgba(126, 159, 181, 0.46)', soft: 'rgba(126, 159, 181, 0.16)' },
    yellow: { color: '#a899bb', glow: 'rgba(168, 153, 187, 0.5)', soft: 'rgba(168, 153, 187, 0.16)' }
  },
  forest: {
    green: { color: '#789b70', glow: 'rgba(120, 155, 112, 0.48)', soft: 'rgba(120, 155, 112, 0.16)' },
    orange: { color: '#c18c5c', glow: 'rgba(193, 140, 92, 0.46)', soft: 'rgba(193, 140, 92, 0.16)' },
    yellow: { color: '#d2bd78', glow: 'rgba(210, 189, 120, 0.5)', soft: 'rgba(210, 189, 120, 0.17)' }
  },
  night: {
    green: { color: '#9b91cf', glow: 'rgba(155, 145, 207, 0.5)', soft: 'rgba(155, 145, 207, 0.17)' },
    orange: { color: '#78a9c5', glow: 'rgba(120, 169, 197, 0.48)', soft: 'rgba(120, 169, 197, 0.16)' },
    yellow: { color: '#e3c77e', glow: 'rgba(227, 199, 126, 0.52)', soft: 'rgba(227, 199, 126, 0.18)' }
  },
  winter: {
    green: { color: '#4d8065', glow: 'rgba(77, 128, 101, 0.45)', soft: 'rgba(77, 128, 101, 0.16)' },
    orange: { color: '#5596a5', glow: 'rgba(85, 150, 165, 0.44)', soft: 'rgba(85, 150, 165, 0.16)' },
    yellow: { color: '#8993c7', glow: 'rgba(137, 147, 199, 0.48)', soft: 'rgba(137, 147, 199, 0.18)' }
  },
  tomato: {
    green: { color: '#16a34a', glow: 'rgba(22, 163, 74, 0.55)', soft: 'rgba(22, 163, 74, 0.18)' },
    orange: { color: '#ea580c', glow: 'rgba(234, 88, 12, 0.55)', soft: 'rgba(234, 88, 12, 0.18)' },
    yellow: { color: '#eab308', glow: 'rgba(234, 179, 8, 0.65)', soft: 'rgba(234, 179, 8, 0.20)' }
  }
};

const COLOR_MAP = THEME_PALETTES.tomato;

// SVG Ring perimeter (2 * PI * 140)
const RING_CIRCUMFERENCE = 2 * Math.PI * 140;

// --- State ---
let currentTheme = 'tomato';
let currentSegmentIndex = 0;
let completedSegmentIndices = new Set();
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
  cyclesCompleted: 0,
  todayWorkDate: '',
  todayWorkSeconds: 0,
  dailyWorkHistory: {}
};

// --- DOM Elements ---
const lightsTrackEl = document.getElementById('lightsTrack');
const cycleSummaryEl = document.getElementById('cycleSummary');
const focusSessionTitleEl = document.getElementById('focusSessionTitle');
const timeDisplayEl = document.getElementById('timeDisplay');
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
const dailyFocusTimeEl = document.getElementById('dailyFocusTime');
const dailyFocusGoalInputEl = document.getElementById('dailyFocusGoalInput');
const dailyFocusGoalValueEl = document.getElementById('dailyFocusGoalValue');
const dailyFocusTrackEl = document.getElementById('dailyFocusTrack');
const dailyFocusFillEl = document.getElementById('dailyFocusFill');
const dailyFocusProgressTextEl = document.getElementById('dailyFocusProgressText');
const resetStatsBtn = document.getElementById('resetStatsBtn');
const statsBtn = document.getElementById('statsBtn');
const statsDialog = document.getElementById('statsDialog');
const closeStatsBtn = document.getElementById('closeStatsBtn');

// Theme Elements
const themePills = document.querySelectorAll('.theme-switcher .theme-pill');
const moreThemesToggleEl = document.getElementById('moreThemesToggle');
const moreThemesMenuEl = document.getElementById('moreThemesMenu');
const forestModeButtons = document.querySelectorAll('.forest-mode-button');
const logoIconEl = document.querySelector('.logo-icon');
const zenLogoMarkup = logoIconEl?.innerHTML || '';
const zenRakeGroovesEl = document.getElementById('zenRakeGrooves');
const zenRakeToolEl = document.getElementById('zenRakeTool');

// --- Audio Context for Chimes & Sound Effects ---
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
 * Plays a subtle tactile mechanical click when controls or themes are clicked
 */
function playClick() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.025);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (err) {
    // Ignore audio error
  }
}

/**
 * Plays a rapid spring-winding ratchet sound when setting the tomato timer
 */
function playRatchetWind() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100 - i * 50, now + i * 0.032);
      gain.gain.setValueAtTime(0.045, now + i * 0.032);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.032 + 0.018);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.032);
      osc.stop(now + i * 0.032 + 0.022);
    }
  } catch (err) {}
}

/**
 * Plays a soft, subtle mechanical clockwork tick every second in Tomato theme
 */
function playClockTick() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.012);
    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.016);
  } catch (err) {}
}

/**
 * Plays an organic synthesized musical chime customized per theme
 * @param {'workComplete'|'restComplete'} type
 */
function playChime(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (currentTheme === 'tomato') {
      // Classic mechanical kitchen timer bell: sharp strike + metallic bell resonance
      const bellFreqs = type === 'workComplete'
        ? [1568, 2093, 3136] // G6, C7, G7 (metallic bell resonance)
        : [1760, 2217, 3520]; // A6, C#7, A7 (bright kitchen alert)

      // Double mechanical bell strike: "Ding... DING!"
      [0, 0.18].forEach((delay) => {
        bellFreqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + delay);

          gain.gain.setValueAtTime(0.0001, now + delay);
          gain.gain.linearRampToValueAtTime(0.3 / bellFreqs.length, now + delay + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.2);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + delay);
          osc.stop(now + delay + 1.25);
        });
      });
    } else {
      // Gentle pentatonic garden chime
      const notes = currentTheme === 'winter'
        ? (type === 'workComplete' ? [392.00, 493.88, 587.33, 783.99] : [523.25, 659.25, 783.99, 1046.50])
        : currentTheme === 'zen'
          ? (type === 'workComplete' ? [523.25, 659.25, 783.99] : [587.33, 698.46, 880.00])
        : (type === 'workComplete'
          ? [523.25, 659.25, 783.99, 1046.50]
          : [440.00, 554.37, 659.25, 880.00]);
      const noteSpacing = ['zen', 'winter'].includes(currentTheme) ? 0.16 : 0.08;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * noteSpacing);

        gain.gain.setValueAtTime(0.0001, now + idx * noteSpacing);
        gain.gain.exponentialRampToValueAtTime(0.18 / notes.length, now + idx * noteSpacing + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * noteSpacing + 1.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * noteSpacing);
        osc.stop(now + idx * noteSpacing + 1.85);
      });
    }
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
    } else if (idx < currentSegmentIndex || completedSegmentIndices.has(idx)) {
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
    } else if (idx < currentSegmentIndex || completedSegmentIndices.has(idx)) {
      item.classList.add('completed');
    }
  });

  cycleSummaryEl.textContent = `Segment ${currentSegmentIndex + 1} of ${SEGMENTS.length}`;
  if (focusSessionTitleEl) {
    focusSessionTitleEl.textContent = SEGMENTS[currentSegmentIndex].name;
  }
}

// --- Theme Switcher & Dynamic Colors ---
function setForestMode(mode) {
  const forestMode = mode === 'night' ? 'night' : 'day';
  document.body.setAttribute('data-forest-mode', forestMode);
  localStorage.setItem('pomodoro_forest_mode', forestMode);
  forestModeButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.getAttribute('data-forest-mode') === forestMode));
  });
}

function setTheme(theme) {
  if (!['zen', 'sundial', 'tomato', 'rainy', 'night', 'forest', 'winter'].includes(theme)) return;
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('pomodoro_theme', theme);

  if (theme === 'tomato') {
    playRatchetWind();
  }

  // Update theme pill buttons
  themePills.forEach(pill => {
    const isSelected = pill.getAttribute('data-theme') === theme;
    pill.classList.toggle('active', isSelected);
    pill.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  });
  moreThemesToggleEl?.classList.toggle('active', ['rainy', 'night', 'forest', 'winter'].includes(theme));

  // Keep the bonsai mark for Zen while restoring each theme's original logo icon.
  if (logoIconEl) {
    if (theme === 'sundial') {
      logoIconEl.textContent = '🌴';
    } else if (theme === 'zen') {
      logoIconEl.innerHTML = zenLogoMarkup;
    } else if (theme === 'tomato') {
      logoIconEl.textContent = '🍅';
    } else if (theme === 'rainy') {
      logoIconEl.textContent = '🌧️';
    } else if (theme === 'night') {
      logoIconEl.textContent = '🌙';
    } else if (theme === 'forest') {
      logoIconEl.textContent = '🌲';
    } else if (theme === 'winter') {
      logoIconEl.textContent = '❄️';
    } else {
      logoIconEl.textContent = '⏳';
    }
  }

  updateThemeColors();
  updateDisplay();
}

function updateThemeColors() {
  const currentSeg = SEGMENTS[currentSegmentIndex];
  const palette = THEME_PALETTES[currentTheme] || THEME_PALETTES.zen;
  const colorData = palette[currentSeg.color];

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

function updateZenRake(progressRatio) {
  if (currentTheme !== 'zen' || !zenRakeGroovesEl || !zenRakeToolEl) return;

  const grooveCount = 20;
  const firstRadius = 6;
  const radiusStep = 102 / (grooveCount - 1);
  if (zenRakeGroovesEl.childElementCount !== grooveCount) {
    zenRakeGroovesEl.replaceChildren();
    for (let i = 0; i < grooveCount; i += 1) {
      const groove = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      groove.setAttribute('class', 'zen-rake-groove');
      zenRakeGroovesEl.appendChild(groove);
    }
  }

  const elapsed = Math.min(1, Math.max(0, 1 - progressRatio));
  const isResting = SEGMENTS[currentSegmentIndex].type !== 'work';
  const grooveProgress = isResting ? 1 - elapsed : elapsed;
  Array.from(zenRakeGroovesEl.children).forEach((groove, index) => {
    const radius = firstRadius + index * radiusStep;
    let path = `M 145 ${145 - radius}`;
    if (grooveProgress >= 1) {
      path += ` A ${radius} ${radius} 0 1 1 145 ${145 + radius} A ${radius} ${radius} 0 1 1 145 ${145 - radius}`;
    } else if (grooveProgress > 0) {
      if (isResting) {
        const startAngle = -Math.PI / 2 + elapsed * Math.PI * 2;
        const midpointAngle = startAngle + grooveProgress * Math.PI;
        const startX = 145 + radius * Math.cos(startAngle);
        const startY = 145 + radius * Math.sin(startAngle);
        const midpointX = 145 + radius * Math.cos(midpointAngle);
        const midpointY = 145 + radius * Math.sin(midpointAngle);
        path = `M ${startX.toFixed(2)} ${startY.toFixed(2)}`;
        path += ` A ${radius} ${radius} 0 0 1 ${midpointX.toFixed(2)} ${midpointY.toFixed(2)}`;
        path += ` A ${radius} ${radius} 0 0 1 145 ${(145 - radius).toFixed(2)}`;
      } else {
        const angle = -Math.PI / 2 + grooveProgress * Math.PI * 2;
        const x = 145 + radius * Math.cos(angle);
        const y = 145 + radius * Math.sin(angle);
        path += ` A ${radius} ${radius} 0 ${grooveProgress > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    }
    groove.setAttribute('d', path);
  });

  const rotation = elapsed * 360;
  zenRakeToolEl.setAttribute('transform', `translate(145 145) rotate(${rotation})`);
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

  // Ring Progress: 1 is full, 0 is empty
  const progressRatio = secondsRemaining / currentSeg.durationSec;
  updateMoonPhase(progressRatio);
  // Progress advances clockwise by default; the Sundial theme opts into the opposite stroke direction.
  const strokeDirection = currentTheme === 'sundial' ? -1 : 1;
  const strokeOffset = RING_CIRCUMFERENCE * (1 - progressRatio) * strokeDirection;
  progressFillEl.style.strokeDashoffset = strokeOffset;
  const rakeRemaining = isRunning && targetEndTime
    ? Math.max(0, (targetEndTime - performance.now()) / 1000)
    : secondsRemaining;
  updateZenRake(rakeRemaining / currentSeg.durationSec);

  // The Oasis sun and its opposite shadow orbit counterclockwise around the fixed sundial face.
  const sundialProgress = Math.min(1, Math.max(0, 1 - progressRatio));
  const sundialSunEl = document.getElementById('sundialRingSun');
  const sundialShadowEl = document.getElementById('sundialShadow');
  if (sundialSunEl) sundialSunEl.setAttribute('transform', `rotate(${sundialProgress * 360} 160 160)`);
  if (sundialShadowEl) sundialShadowEl.setAttribute('transform', `rotate(${-sundialProgress * 360} 145 145)`);

  // Mechanical Rotating Kitchen Timer Dial (Tomato Theme)
  const tomatoRotatingDialEl = document.getElementById('tomatoRotatingDial');
  if (tomatoRotatingDialEl) {
    // Each minute is 6 degrees on a 60-minute dial.
    // Winds clockwise when set, and unwinds counter-clockwise as time ticks toward zero!
    // e.g. 25 min remaining -> +150deg (brings 25 to top pointer)
    //       5 min remaining -> +30deg (brings 5 to top pointer)
    //       0 min remaining -> 0deg (brings 0 to top pointer)
    const dialAngle = (secondsRemaining / 10);
    tomatoRotatingDialEl.style.transform = `rotate(${dialAngle}deg)`;
  }

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

function updateMoonPhase(progressRatio) {
  // New moon at the start and end, full moon halfway through the interval.
  const phase = Math.min(1, Math.max(0, 1 - progressRatio));
  const waxing = phase <= 0.5;
  const terminatorX = 13 * Math.cos(phase * Math.PI * 2) * (waxing ? 1 : -1);
  const sweep = waxing ? 1 : 0;
  const clockMoonEl = document.getElementById('nightClockMoonIllumination');
  const landscapeMoonEl = document.getElementById('nightLandscapeMoonIllumination');
  if (clockMoonEl) {
    clockMoonEl.setAttribute('d', `M145 55 A15 15 0 0 ${sweep} 145 85 Q${145 + (30 / 13) * terminatorX} 70 145 55Z`);
  }
  if (landscapeMoonEl) {
    const landscapeTerminatorX = 57 * Math.cos(phase * Math.PI * 2) * (waxing ? 1 : -1);
    landscapeMoonEl.setAttribute('d', `M1086 120 A57 57 0 0 ${sweep} 1086 234 Q${1086 + 2 * landscapeTerminatorX} 177 1086 120Z`);
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
  playClick();
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

let lastSecondTicked = null;

function tick() {
  if (!isRunning) return;

  const now = performance.now();
  const preciseRemaining = Math.max(0, (targetEndTime - now) / 1000);
  const preciseProgress = preciseRemaining / SEGMENTS[currentSegmentIndex].durationSec;
  updateZenRake(preciseProgress);
  const sundialProgress = Math.min(1, Math.max(0, 1 - preciseProgress));
  document.getElementById('sundialRingSun')?.setAttribute('transform', `rotate(${sundialProgress * 360} 160 160)`);
  document.getElementById('sundialShadow')?.setAttribute('transform', `rotate(${-sundialProgress * 360} 145 145)`);
  const diffSec = Math.max(0, Math.round((targetEndTime - now) / 1000));

  if (diffSec !== secondsRemaining) {
    secondsRemaining = diffSec;
    // Play a gentle mechanical clockwork tick every second in Tomato theme
    if (currentTheme === 'tomato' && secondsRemaining !== lastSecondTicked) {
      lastSecondTicked = secondsRemaining;
      playClockTick();
    }
    updateDisplay();
  }

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
  completedSegmentIndices.add(currentSegmentIndex);
  if (currentSegmentIndex === SEGMENTS.length - 1) {
    stats.cyclesCompleted += 1;
    completedSegmentIndices.clear();
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

  // Let Zen users see the finished raked circle at 00:00 for one frame.
  const nextIndex = (currentSegmentIndex + 1) % SEGMENTS.length;
  if (currentTheme === 'zen') {
    requestAnimationFrame(() => requestAnimationFrame(() => switchSegment(nextIndex, false)));
  } else {
    switchSegment(nextIndex, false);
  }
}

function resetSegment() {
  playClick();
  if (currentTheme === 'tomato') {
    playRatchetWind();
  }
  pauseTimer();
  secondsRemaining = SEGMENTS[currentSegmentIndex].durationSec;
  updateDisplay();
}

function switchSegment(index, autoStart = false) {
  pauseTimer();
  currentSegmentIndex = index;
  secondsRemaining = SEGMENTS[currentSegmentIndex].durationSec;
  
  if (currentTheme === 'tomato') {
    playRatchetWind();
  }

  updateThemeColors();
  updateLightsState();
  updateDisplay();

  if (autoStart) {
    startTimer();
  }
}

function skipSegment() {
  playClick();
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
  ensureTodayWorkStats();
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

let dailyWorkGoalSeconds = 2 * 60 * 60;
const DAILY_WORK_GOAL_STORAGE_KEY = 'pomodoro_daily_work_goal_seconds';

function loadDailyWorkGoal() {
  const savedGoal = Number(localStorage.getItem(DAILY_WORK_GOAL_STORAGE_KEY));
  if (Number.isFinite(savedGoal) && savedGoal > 0) {
    dailyWorkGoalSeconds = Math.min(12 * 60 * 60, Math.max(30 * 60, Math.round(savedGoal / (30 * 60)) * 30 * 60));
  }
  if (dailyFocusGoalInputEl) dailyFocusGoalInputEl.value = String(dailyWorkGoalSeconds / 3600);
}

function formatFocusDuration(seconds) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${totalMinutes}m`;
}

function renderDailyWorkGoal() {
  const today = getLocalDateKey();
  const focusedSeconds = Math.max(0, Number(stats.dailyWorkHistory?.[today] ?? stats.todayWorkSeconds) || 0);
  const progress = Math.min(1, focusedSeconds / dailyWorkGoalSeconds);
  const goalHours = dailyWorkGoalSeconds / 3600;
  const goalLabel = `${Number.isInteger(goalHours) ? goalHours : goalHours.toFixed(1)}h`;

  if (dailyFocusTimeEl) dailyFocusTimeEl.textContent = formatFocusDuration(focusedSeconds);
  if (dailyFocusGoalValueEl) dailyFocusGoalValueEl.textContent = goalLabel;
  if (dailyFocusFillEl) dailyFocusFillEl.style.width = `${progress * 100}%`;
  if (dailyFocusTrackEl) {
    dailyFocusTrackEl.setAttribute('aria-valuemax', String(dailyWorkGoalSeconds));
    dailyFocusTrackEl.setAttribute('aria-valuenow', String(Math.min(focusedSeconds, dailyWorkGoalSeconds)));
  }
  if (dailyFocusProgressTextEl) {
    dailyFocusProgressTextEl.textContent = focusedSeconds >= dailyWorkGoalSeconds
      ? 'Goal reached'
      : `${Math.floor(progress * 100)}% complete`;
  }
  renderWorkHistory();
}

let workHistoryMode = 'week';
let workHistoryOffset = 0;

function shiftLocalDate(date, days) {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function renderWorkHistory() {
  const chart = document.getElementById('workHistoryChart');
  const title = document.getElementById('workHistoryPeriod');
  if (!chart || !title) return;

  const today = new Date();
  let dates = [];
  let label = '';
  if (workHistoryMode === 'week') {
    const start = shiftLocalDate(today, -((today.getDay() + 6) % 7) + workHistoryOffset * 7);
    dates = Array.from({ length: 7 }, (_, index) => shiftLocalDate(start, index));
    const end = dates[6];
    const options = { month: 'short', day: 'numeric' };
    label = `${dates[0].toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, { ...options, year: 'numeric' })}`;
  } else {
    const monthStart = new Date(today.getFullYear(), today.getMonth() + workHistoryOffset, 1);
    const dayCount = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    dates = Array.from({ length: dayCount }, (_, index) => new Date(monthStart.getFullYear(), monthStart.getMonth(), index + 1));
    label = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  title.textContent = label;
  chart.classList.toggle('monthly', workHistoryMode === 'month');
  chart.innerHTML = '';
  if (workHistoryMode === 'month') {
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(letter => {
      const weekday = document.createElement('span');
      weekday.className = 'work-history-weekday';
      weekday.textContent = letter;
      chart.appendChild(weekday);
    });
    const offset = (dates[0].getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) {
      const spacer = document.createElement('span');
      spacer.className = 'work-history-spacer';
      chart.appendChild(spacer);
    }
  }
  const maxSeconds = Math.max(dailyWorkGoalSeconds, ...dates.map(date => Number(stats.dailyWorkHistory?.[getLocalDateKey(date)]) || 0), 1);
  dates.forEach(date => {
    const key = getLocalDateKey(date);
    const seconds = Math.max(0, Number(stats.dailyWorkHistory?.[key]) || 0);
    const day = document.createElement('div');
    day.className = 'work-history-day';
    day.title = `${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${formatFocusDuration(seconds)}`;
    const bar = document.createElement('div');
    bar.className = 'work-history-bar';
    bar.style.height = `${seconds ? Math.max(4, seconds / maxSeconds * 100) : 0}%`;
    bar.setAttribute('aria-hidden', 'true');
    const value = document.createElement('span');
    value.className = 'work-history-day-value';
    value.textContent = seconds ? formatFocusDuration(seconds) : '—';
    const name = document.createElement('span');
    name.className = 'work-history-day-name';
    name.textContent = workHistoryMode === 'week'
      ? date.toLocaleDateString(undefined, { weekday: 'short' })
      : String(date.getDate());
    day.append(bar, value, name);
    chart.appendChild(day);
  });
}

function renderStats() {
  if (!statsWorkTimeEl) return;

  statsWorkTimeEl.textContent = formatDuration(stats.workSeconds);
  statsRestTimeEl.textContent = formatDuration(stats.restSeconds);
  statsCyclesCompletedEl.textContent = stats.cyclesCompleted;

  statsSessionsCountEl.textContent = `${stats.workCompleted} session${stats.workCompleted === 1 ? '' : 's'} done`;
  statsRestBreaksCountEl.textContent = `${stats.breaksCompleted} break${stats.breaksCompleted === 1 ? '' : 's'} taken`;
  renderDailyWorkGoal();
}

function resetStats() {
  const confirmed = window.confirm('Are you sure you want to reset your accomplishments history?');
  if (confirmed) {
    stats = {
      workSeconds: 0,
      restSeconds: 0,
      workCompleted: 0,
      breaksCompleted: 0,
      cyclesCompleted: 0,
      todayWorkDate: getLocalDateKey(),
      todayWorkSeconds: 0,
      dailyWorkHistory: {}
    };
    saveStats();
    renderStats();
  }
}

// --- Live Time Tracker Heartbeat ---
// Accurately tracks working time and resting time second by second while the timer runs
let lastHeartbeatTime = Date.now();
function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureTodayWorkStats() {
  if (!stats.dailyWorkHistory || typeof stats.dailyWorkHistory !== 'object') stats.dailyWorkHistory = {};
  const today = getLocalDateKey();
  if (stats.todayWorkDate !== today) {
    if (stats.todayWorkDate && Number(stats.todayWorkSeconds) > 0 && stats.dailyWorkHistory[stats.todayWorkDate] == null) {
      stats.dailyWorkHistory[stats.todayWorkDate] = Number(stats.todayWorkSeconds);
    }
    stats.todayWorkDate = today;
    stats.todayWorkSeconds = Number(stats.dailyWorkHistory[today]) || 0;
    return true;
  }
  if (!Number.isFinite(stats.todayWorkSeconds)) stats.todayWorkSeconds = 0;
  if (stats.dailyWorkHistory[today] == null && stats.todayWorkSeconds > 0) stats.dailyWorkHistory[today] = stats.todayWorkSeconds;
  return false;
}

function initHeartbeat() {
  setInterval(() => {
    const now = Date.now();
    const delta = (now - lastHeartbeatTime) / 1000;
    lastHeartbeatTime = now;

    if (ensureTodayWorkStats()) {
      saveStats();
      renderStats();
    }

    if (isRunning && delta > 0 && delta < 600) {
      const cur = SEGMENTS[currentSegmentIndex];
      if (cur.type === 'work') {
        stats.workSeconds += delta;
        stats.todayWorkSeconds += delta;
        stats.dailyWorkHistory[getLocalDateKey()] = (Number(stats.dailyWorkHistory[getLocalDateKey()]) || 0) + delta;
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
if (dailyFocusGoalInputEl) {
  dailyFocusGoalInputEl.addEventListener('change', () => {
    const enteredHours = Number(dailyFocusGoalInputEl.value);
    const validHours = Number.isFinite(enteredHours) && dailyFocusGoalInputEl.value !== ''
      ? enteredHours
      : dailyWorkGoalSeconds / 3600;
    const roundedHours = Math.min(12, Math.max(.5, Math.round(validHours * 2) / 2));
    dailyWorkGoalSeconds = roundedHours * 3600;
    dailyFocusGoalInputEl.value = String(roundedHours);
    localStorage.setItem(DAILY_WORK_GOAL_STORAGE_KEY, String(dailyWorkGoalSeconds));
    renderDailyWorkGoal();
  });
}
document.querySelectorAll('[data-history-mode]').forEach(button => {
  button.addEventListener('click', () => {
    workHistoryMode = button.dataset.historyMode;
    workHistoryOffset = 0;
    document.querySelectorAll('[data-history-mode]').forEach(option => {
      const active = option === button;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    renderWorkHistory();
  });
});
document.getElementById('workHistoryPrevious')?.addEventListener('click', () => {
  workHistoryOffset -= 1;
  renderWorkHistory();
});
document.getElementById('workHistoryNext')?.addEventListener('click', () => {
  if (workHistoryOffset < 0) workHistoryOffset += 1;
  renderWorkHistory();
});
if (statsBtn && statsDialog) {
  statsBtn.addEventListener('click', () => {
    statsDialog.style.removeProperty('left');
    statsDialog.style.removeProperty('top');
    statsDialog.style.removeProperty('right');
    statsDialog.style.removeProperty('bottom');
    statsDialog.style.removeProperty('transform');
    statsDialog.showModal();
  });
}
if (statsDialog) {
  const statsHeader = statsDialog.querySelector('.stats-dialog-header');
  let dragState = null;

  if (statsHeader) {
    statsHeader.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button, a')) return;
      const rect = statsDialog.getBoundingClientRect();
      dragState = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      statsDialog.style.left = `${rect.left}px`;
      statsDialog.style.top = `${rect.top}px`;
      statsDialog.style.transform = 'none';
      statsHeader.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    statsHeader.addEventListener('pointermove', event => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const rect = statsDialog.getBoundingClientRect();
      const left = Math.max(0, Math.min(window.innerWidth - rect.width, event.clientX - dragState.offsetX));
      const top = Math.max(0, Math.min(window.innerHeight - rect.height, event.clientY - dragState.offsetY));
      statsDialog.style.left = `${left}px`;
      statsDialog.style.top = `${top}px`;
    });

    const endStatsDrag = event => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      dragState = null;
      if (statsHeader.hasPointerCapture(event.pointerId)) statsHeader.releasePointerCapture(event.pointerId);
    };
    statsHeader.addEventListener('pointerup', endStatsDrag);
    statsHeader.addEventListener('pointercancel', endStatsDrag);
  }
}
if (closeStatsBtn && statsDialog) {
  closeStatsBtn.addEventListener('click', () => statsDialog.close());
}
if (statsDialog) {
  statsDialog.addEventListener('click', event => {
    if (event.target === statsDialog) statsDialog.close();
  });
}

// Theme Switcher Buttons
themePills.forEach(pill => {
  pill.addEventListener('click', () => {
    const selected = pill.getAttribute('data-theme');
    if (selected && selected !== currentTheme) {
      playClick();
      setTheme(selected);
    }
  });
});

forestModeButtons.forEach(button => {
  button.addEventListener('click', () => {
    playClick();
    setForestMode(button.getAttribute('data-forest-mode'));
  });
});

if (moreThemesToggleEl && moreThemesMenuEl) {
  const setMoreThemesMenuOpen = open => {
    moreThemesToggleEl.setAttribute('aria-expanded', String(open));
    moreThemesMenuEl.classList.toggle('hidden', !open);
  };

  moreThemesToggleEl.addEventListener('click', () => {
    const isOpen = moreThemesToggleEl.getAttribute('aria-expanded') === 'true';
    setMoreThemesMenuOpen(!isOpen);
  });

  moreThemesMenuEl.addEventListener('click', event => {
    const themeOption = event.target.closest('[data-theme]');
    if (!themeOption) return;
    playClick();
    setTheme(themeOption.getAttribute('data-theme'));
    setMoreThemesMenuOpen(false);
  });

  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.theme-more')) setMoreThemesMenuOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && moreThemesToggleEl.getAttribute('aria-expanded') === 'true') {
      setMoreThemesMenuOpen(false);
      moreThemesToggleEl.focus();
    }
  });
}

// Click on Tomato Dial to start/pause timer
const tomatoDialFaceEl = document.querySelector('.tomato-dial-face');
if (tomatoDialFaceEl) {
  tomatoDialFaceEl.addEventListener('click', () => {
    if (currentTheme === 'tomato') {
      toggleTimer();
    }
  });
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
  loadDailyWorkGoal();
  setForestMode(localStorage.getItem('pomodoro_forest_mode') || 'day');
  const savedTheme = localStorage.getItem('pomodoro_theme');
  setTheme(['zen', 'sundial', 'tomato', 'rainy', 'night', 'forest', 'winter'].includes(savedTheme) ? savedTheme : 'tomato');
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
