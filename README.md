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

You can switch themes at any time using the theme bar below the header, with additional options in **more**:

1. 🪴 **Zen Garden**:
   - Calm moss, stone, and warm sand colors with a quiet garden atmosphere.
   - Soft, gentle chimes for work and break transitions.

2. 🕹️ **8-Bit Retro**:
   - Available under **more → 8-bit retro**, with a pixel-inspired arcade palette, skyline, sharp edges, and chunky shadows.
   - Monospaced scanline timer display with bright HUD accents and square segment lights.
   - Retro synthesized sound effects for timer controls and transitions.

3. 🍅 **Classic Kitchen Tomato (Default)**:
   - The quintessential mechanical Pomodoro timer invented by Francesco Cirillo.
   - **Functional Rotating Mechanical Dial**: The calibrated timer dial physically twists clockwise to 25 minutes (for focus) or 5 minutes (for rest) with a spring ratchet sound, and continuously unwinds counter-clockwise toward 0 as time ticks down!
   - **Plump 3D Tomato Body**: Glossy ripe red tomato shell with curved specular highlights and depth shadows.
   - **Leafy Green Stem Crown**: Vibrant green calyx and pedicel perched proudly at the top of the timer.
   - **Calibrated Minute Dial**: Crisp circular timer face with a red pointer marker and 0–55 minute calibration tick ring.
   - **Cherry Tomato & Seed Lights**: Round indicator dots with fresh leaf accents.
   - **Mechanical Sounds**: Subtle clockwork ticking per second and a dual-strike mechanical kitchen timer "Ding... DING!" alert sound.

4. 🌌 **Northern Lights**:
   - An outdoor moonlit winter clearing, framed by snow-covered firs, distant peaks, and a soft aurora.
   - A midnight-blue Northern Lights clock face with drifting aurora, falling snow, and a miniature snowy forest along the lower edge.
   - Gentle falling snow and cool alpine colors pair with a soft bell chime at interval changes.

5. 🌙 **Night Sky**:
   - The moon in the landscape and timer face waxes from new to full at the interval midpoint, then wanes back to new as the timer reaches zero.
   - A miniature night landscape with stars, mountain ridges, pines, and occasional animated comets sits inside the clock face.

6. 🌲 **Forest Retreat**:
   - A tiny forest, rolling hills, and winding creek fill the clock face in both day and night modes.

7. 🌧️ **Rainy Day**:
   - Misty hills, pines, a winding stream, and gentle animated rain miniature the rainy landscape inside the clock face.

8. ⌛ **Hourglass**:
   - Available under **more → hourglass**, with warm parchment, a wooden frame, and translucent glass.
   - Sand drains into the lower chamber as the interval progresses. The falling stream pauses with the timer, with the time remaining displayed below the glass.

9. ♛ **Chronometer**:
   - Available under **more → chronometer**, with a deep green watch dial, fluted gold bezel, and champagne hour markers.
   - Minute and second hands start at the interval's duration (25, 5, or 20 minutes) and count down counterclockwise to zero, with a small digital countdown window below the center.

10. ☉ **Astronomical Clock**:
    - Available under **more → astronomical clock**, with a medieval blue-and-gold dial, Roman numerals, and a zodiac ring.
    - Sun and moon hands count down counterclockwise from the interval duration, like the chronometer. An outer progress ring drains as the interval runs, while the zodiac ring slowly turns.
    - The digital countdown sits below the dial, and the daily goal bar matches the brass-colored work lights.

*Tomato opens as the default theme on your first visit. After you switch themes, the app restores your saved theme on future visits.*

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

## Tomodo accounts and Plus

The `feature/tomodo-plus` branch includes the Free/Plus UI and a Cloudflare backend using Supabase authentication/storage and Stripe-hosted subscriptions. Plus is $3/month or $24/year. Supabase is connected in production, including email/password sign-in, email links, and password recovery. Stripe billing remains unconfigured and disabled.

```sh
npm ci
npm run dev
```

Open `http://localhost:8788/` for the app or `http://localhost:8788/?review=plus` for a local UI-only Plus preview. The review switch never grants server-side paid access. Without configured services, the free timer still works and sign-in/checkout remain unavailable.

- [Backend setup guide](docs/BACKEND-SETUP.md): create Supabase/Stripe accounts, apply the database migration, configure secrets, and deploy to the existing Cloudflare Worker.
- [Product rollout](docs/PLUS-ROLLOUT.md): plan split and review instructions.
- Run `npm test` for automated checks and `npm run build` to create deployable assets in `dist/`.

Deploy only the built assets and compiled backend. Secret keys belong in Cloudflare secrets or the ignored `.dev.vars` file, never frontend code or Git.
