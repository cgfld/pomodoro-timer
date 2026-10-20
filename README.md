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
