# Enhancement Plan

## 1. Settings Panel + Account Management

**Goal**: Move sign-in/sign-out/account info behind a settings icon. Show a subtle "last synced" reminder instead.

### UI
- Add a **gear icon** (or person silhouette) button in the **top-right corner** of the picker screen, fixed position, small and unobtrusive (e.g. 32×32, `rgba(255,255,255,0.3)`, brightens on hover).
- Tapping the icon opens a **settings drawer/modal** that slides up from the bottom (mobile-friendly sheet pattern). Contains:
  - **Account section**: signed-in email, SIGN OUT button. If not signed in: SIGN IN button.
  - **Workout multiplier** (see §2).
  - **TTS toggle** (see §3).
  - Future: custom workouts slot.
- **Replace the SYNC button** on the picker screen with just a small status line under the streak banner:
  - Signed in: `"Last synced 3 min ago · user@gmail.com"` (dim, 11px)
  - Not signed in: `"Tap ⚙ to enable sync"` (dim, 11px)
- The SYNC *action* (actual data sync) happens **automatically on page load** if signed in, and **after every completed workout**. No manual sync button needed — it already does both of these. The settings panel can have a "Sync now" option for manual trigger if desired.

### Implementation
- New DOM: `<button id="btn-settings">` (gear SVG icon) + `<div id="settings-panel">` (the sheet).
- CSS: `.settings-panel` — fixed bottom sheet, `transform: translateY(100%)` → `translateY(0)` on `.open`. Backdrop overlay.
- JS: `showSettings()` / `hideSettings()` in app.js. Wire the gear button.
- Move all SyncManager sign-in/sign-out UI logic into the settings panel.
- Add a `lastSyncedAt` timestamp to localStorage (set it after successful sync in `syncAndUpdateUI()`). Display it on picker screen as relative time ("2 min ago", "1 hr ago", "yesterday").

### Files touched
- `index.html` — add gear button + settings panel markup
- `css/styles.css` — settings panel styles, gear icon, status line
- `js/app.js` — settings open/close, move sync UI into panel, add last-synced display

---

## 2. Workout Duration Multiplier

**Goal**: Scale every phase duration by a multiplier (e.g. 1.5× makes a 40s exercise → 60s). Persisted in localStorage, configurable in settings.

### UI (inside settings panel)
- **Slider** with label: `"Session length: 1.5×"`
- Range: **0.5× to 3×**, step 0.25
- **Snap points** at: 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3
- Slider has visible tick marks at snap points. Thumb snaps to nearest when released (CSS + JS).
- Default: **1×**
- The picker screen workout cards should reflect the multiplied total time (e.g. "5 min" becomes "7:30" at 1.5×). Update dynamically when multiplier changes.

### Data model
- Store in localStorage: key `"pajama-settings"`, value `{ multiplier: 1.5, tts: false }` (single settings object for all user prefs).
- On workout start: multiply every phase's `duration` by the multiplier, round to nearest integer second.
- **History**: add `multiplier` field to the recorded entry (default `1` for old entries). This way history shows what multiplier was used.

### Implementation
- New: `loadSettings()` / `saveSettings()` helpers in app.js (or a small settings.js if it gets big — but probably just app.js is fine).
- `selectWorkout(id)`: when building the phases array, apply `Math.round(phase.duration * multiplier)` to each phase.
- `buildPicker()`: compute displayed total time using current multiplier.
- `recordWorkout()`: include `multiplier` in the history entry.
- Slider wiring: `<input type="range">` with snap logic on `input`/`change` events.

### Files touched
- `index.html` — slider markup inside settings panel
- `css/styles.css` — slider styling, tick marks
- `js/app.js` — loadSettings, slider wiring, apply multiplier to phases, update picker cards
- `js/history.js` — accept `multiplier` in normaliseEntry (default 1)

---

## 3. TTS (Text-to-Speech) Announcements

**Goal**: Use `speechSynthesis` to announce what's coming up, so the user doesn't have to look at the screen.

### What gets spoken
- **On phase start**: `"{Exercise name}"` — e.g. "Squats", "Rest", "Hamstring stretch"
- **At 3 seconds before phase end**: `"Next: {next exercise name}"` — e.g. "Next: Push-ups"
- **On workout done**: `"Workout complete"`
- **During countdown**: `"Get ready"` at start of countdown
- Keep it minimal. Do NOT read hints or descriptions.

### UI (inside settings panel)
- **Toggle switch**: `"Voice cues: ON/OFF"`
- Stored in `pajama-settings.tts` (boolean, default `false`).

### Implementation
- New function `speak(text)`:
  ```js
  function speak(text) {
    if (!settings.tts || !window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;  // slightly faster than default
    u.volume = 0.8;
    speechSynthesis.speak(u);
  }
  ```
- Call `speak()` at the right moments in the tick/phase-advance logic in app.js.
- Cancel any in-progress speech when user manually skips or resets: `speechSynthesis.cancel()`.

### Files touched
- `index.html` — toggle markup inside settings panel
- `css/styles.css` — toggle switch styling
- `js/app.js` — speak() helper, call sites in tick/advance/done/countdown

---

## 4. Better Exercise Descriptions

**Goal**: Richer `hint` text for each phase in every workout, so the user knows what to do without prior knowledge.

### Approach
- Update the `hint` field on each phase in `config.js`.
- Currently hints are brief ("Keep your core tight"). Expand to 1-2 sentences with form cues — e.g. `"Stand with feet shoulder-width apart. Lower until thighs are parallel, push through heels."` for squats.
- **Rest phases**: Add a hint like `"Shake it out, grab water"` or `"Catch your breath"`.
- **Stretch phases**: Already have decent hints — flesh out any that are terse.
- These are display-only (shown below the timer). TTS does NOT read them (per §3).
- Consider adding a `description` field to the workout object itself (shown on the picker card as a second line under the subtitle). Keep it to ~15 words max.

### Files touched
- `js/config.js` — update hint strings on all phases, add optional `description` to workouts

---

## Implementation Order

1. **Settings panel** (§1) — builds the container that §2 and §3 plug into
2. **Exercise descriptions** (§4) — pure data, no dependencies, could be done in parallel with §1
3. **Workout multiplier** (§2) — needs settings panel
4. **TTS** (§3) — needs settings panel, simplest feature

Steps 1 + 4 (data) can be done in parallel. Then 2, then 3.

---

## Future: Custom Workouts (NOT implementing now)

The architecture should accommodate this later:
- A published JSON schema on the GitHub Pages site describing the workout format (phases array, types, durations, hints).
- Users point an LLM at the spec + their goals → LLM outputs a conforming JSON blob.
- User pastes the JSON into a "Custom workouts" section in settings.
- App validates against the schema, stores in `pajama-settings.customWorkouts[]`, and merges them into the WORKOUTS object at runtime.
- The `config.js` WORKOUTS structure is already clean enough to support this — each workout is a self-contained object with id, title, subtitle, phases.
