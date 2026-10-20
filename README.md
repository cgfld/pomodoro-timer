# ⏳ Pomodoro Timer with Segmented Lights

A modern Pomodoro timer application featuring visual segment indicator lights for tracking focus and rest intervals across full cycles.

## 🌟 Visual Segment Lights

The timer displays an interactive 8-stage light strip representing the complete Pomodoro cycle:

- 🟢 **Work Intervals (25 minutes)**: Vibrant Green glowing lights for deep focus sessions (Segments 1, 3, 5, 7).
- 🟠 **Short Rest Intervals (5 minutes)**: Warm Orange glowing lights for quick rejuvenation (Segments 2, 4, 6).
- 🟡 **Final Long Rest Interval (20 minutes)**: Brilliant Golden Yellow glowing light to recharge after finishing all 4 work sessions (Segment 8).

### Light States
- **Active**: Vivid luminous glow and gentle breathing pulse matching the segment color.
- **Completed**: Filled indicator marking finished stages in the cycle.
- **Upcoming**: Distinct tinted border and dot previewing what's ahead.
- **Interactive**: Click any segment light to jump directly to that part of the cycle.

---

## 🚀 How to Run

You can open the app directly in any web browser:

```bash
open index.html
```

Or start a local web server:

```bash
python3 -m http.server 8000
```
Then visit [http://localhost:8000](http://localhost:8000).

---

## 🎨 Customizable UI Themes

You can switch between 3 hand-crafted visual skins at any time using the theme bar below the header:

1. ✨ **Modern Dark (Default)**:
   - Sleek cyber-glow aesthetic with translucent glassmorphic surfaces, dynamic segment neon lighting, and serene ambient backdrops.
   - Modern synthesized chord chimes for break and work transitions.

2. 📻 **Vintage Wooden Radio**:
   - Inspired by 1940s-1950s vacuum-tube cathedral/tabletop radios.
   - Dark polished walnut wood grain cabinet, beveled brass trim, and speaker grille slats.
   - **Vacuum Tube Indicators**: The segment lights transform into glowing glass vacuum tubes with warm tungsten filaments and green "Magic Eye" cathode-ray tuning tubes.
   - **Analog Radio Tuning Dial**: An illuminated amber dial face with radio frequency calibration marks (kHz / MHz) and warm glowing Nixie-style numerals.
   - **Bakelite Rotary Knobs**: Tactile fluted bakelite buttons with spun-brass center caps.
   - **Broadcast Chimes**: Authentic 1940s NBC-style mellow broadcast chime tones.

3. 🍅 **Classic Kitchen Tomato**:
   - The quintessential mechanical Pomodoro timer invented by Francesco Cirillo.
   - **Functional Rotating Mechanical Dial**: The calibrated timer dial physically twists clockwise to 25 minutes (for focus) or 5 minutes (for rest) with a spring ratchet sound, and continuously unwinds counter-clockwise toward 0 as time ticks down!
   - **Plump 3D Tomato Body**: Glossy ripe red tomato shell with curved specular highlights and depth shadows.
   - **Leafy Green Stem Crown**: Vibrant green calyx and pedicel perched proudly at the top of the timer.
   - **Calibrated Minute Dial**: Crisp circular timer face with a red pointer marker and 0–55 minute calibration tick ring.
   - **Cherry Tomato & Seed Lights**: Round indicator dots with fresh leaf accents.
   - **Mechanical Sounds**: Subtle clockwork ticking per second and a dual-strike mechanical kitchen timer "Ding... DING!" alert sound.

*Theme selections are saved automatically in `localStorage` and persist across browser reloads.*

---

## 🛠 Features

- **Segmented Visual Lights**: 8 distinct stages with Green (Work), Orange (Short Rest), and Yellow (Long Rest).
- **Dynamic Color Theme**: The circular timer ring, button accents, and ambient background glow dynamically synchronize with the current segment's light color.
- **Web Audio Chimes**: Built-in harmonic chimes generated with the Web Audio API (no external sound files required):
  - *Rest Bell*: A warm, peaceful chord signaling the end of focus work.
  - *Focus Bell*: A crisp alert chime signaling it's time to get back to work.
- **Desktop Notifications**: Optional browser notifications alert you when an interval completes even if the tab is in the background.
- **Keyboard Shortcuts**:
  - `Space`: Start / Pause
  - `R`: Reset current interval
  - `S` or `→`: Skip to next segment
- **Accomplishments & Time Tracking Dashboard**:
  - 🟢 **Time Spent Working**: Live tracking of focused work duration.
  - 🟠 **Time Spent Resting**: Live tracking of short breaks and long breaks.
  - 🔄 **Completed Full Cycles**: Tracks every completed 8-segment cycle.
  - ⚖️ **Work vs. Rest Balance Bar**: Visual ratio showing your productivity balance.
  - 💾 **Persistent & Resettable**: Saved in `localStorage` across reloads, with a 1-click Reset button.
