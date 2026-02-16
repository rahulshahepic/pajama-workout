# Pajama Workout

A progressive web app for guided bodyweight workouts you can do in your pajamas. No equipment, no gym, no excuses.

## User Guide

### First Launch

On your first visit you'll see a quick setup wizard with two options:

- **Guided & Relaxed** — longer sessions (1.5x), more rest between exercises, and voice cues that explain each move as you go.
- **Quick & Focused** — standard timing, no voice explanations. Just a timer and exercise names.

Pick whichever feels right — you can change everything later in Settings.

### Choosing a Workout

The home screen shows all available workouts sorted by duration. Tap any card to see the exercise list, then tap **START** when ready. There's a 10-second countdown before the first exercise begins.

Built-in workouts:

| Workout | Duration | Focus |
|---------|----------|-------|
| Pajama Workout | ~10 min | Full body + stretch |
| Quick Five | ~5 min | Strength, no stretches |
| Keyboard Warrior | ~1 min | Neck, shoulders, wrists |
| Morning Flow | ~10 min | Sun salutation yoga |
| Wind-Down Yoga | ~12 min | Restorative floor poses |
| Rotator Cuff Rescue | ~10 min | Shoulder stretches |
| Lower Back & Hips | ~10 min | Posterior chain mobility |

### Settings

Tap the gear icon (top-right of the home screen) to open Settings:

| Setting | Default | What it does |
|---------|---------|-------------|
| Session Length | 1x | Scales all exercise durations (0.5x – 3x) |
| Rest Duration | 1x | Scales rest periods independently (0.5x – 3x) |
| Weekly Goal | 3x/wk | Non-binding target shown on the home screen |
| Announce exercises | Off | Reads exercise names aloud via text-to-speech |
| Read exercise details during rest | Off | Reads form cues during rest periods (extends rest if needed) |
| Ambient drone | Off | Quiet background pad sound during workouts |

You can also adjust the session multiplier per-workout using the +/- buttons on the Ready screen without changing your global default.

### Custom Workouts

Tap the **+** button (bottom-right) to build a custom workout. Add exercises, rest periods, stretches, or yoga poses, set durations, and save. Custom workouts appear alongside the built-ins and can be edited or deleted.

### Sharing & Importing

Custom workouts can be shared via a URL. On the Ready screen, tap **SHARE** to copy a link. Anyone who opens that link will have the workout imported automatically.

### Exercise Swapping

On the Ready screen, exercises marked with a swap icon can be tapped to choose an alternative (e.g., swap Push-ups for Incline Push-ups).

### Sync

Sign in with Google in Settings to sync your history, custom workouts, and settings across devices via Google Drive.

---

## Architecture

### Tech Stack

- **Vanilla JavaScript** — no framework, no build step, no bundler
- **PWA** — service worker for offline caching, manifest for install
- **Web Speech API** — text-to-speech for exercise announcements
- **Web Audio API** — beep cues and ambient drone (oscillator-based)
- **Google Identity Services** — token-based OAuth for Drive sync

### Project Structure

```
├── index.html              # Single HTML file — all screens defined here
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (network-first, cache fallback)
├── css/
│   └── styles.css          # All styling (CSS custom properties for theming)
├── js/
│   ├── config.js           # Workouts, categories, themes, sounds, substitutions
│   ├── app.js              # Main app logic (~1680 lines IIFE)
│   ├── history.js          # Workout history storage & streak tracking
│   └── sync.js             # Google Drive sync
├── icons/                  # SVG icons for PWA
├── tests/                  # Node.js unit tests (node --test)
└── .github/workflows/
    ├── test.yml            # Runs tests on PRs and pushes to main
    └── deploy.yml          # Deploys to GitHub Pages on push to main
```

### Key Concepts

**Screens** — The app has four screens managed via CSS `display` toggling and the browser History API: Picker (home), Timer (workout), History, and Builder. The onboarding wizard overlays on first launch.

**Phases** — Every workout is an array of phases, each with a `name`, `type` (work/rest/stretch/yoga), `duration` (seconds), and `hint` (form cue). The timer walks through them sequentially.

**Settings** — Stored in `localStorage` under `pajama-settings`. Loaded on init, saved on every change. The sync system merges settings by `_syncedAt` timestamp (newer wins).

**Theming** — Each phase type has a color scheme (bg, accent, glow, progress). Transitions are CSS-animated. The theme switches on every phase change.

**Multipliers** — Two layers: global defaults (from Settings) and per-session overrides (adjustable on the Ready screen). Rest and exercise durations scale independently.

### localStorage Keys

| Key | Contents |
|-----|----------|
| `pajama-settings` | User settings (multipliers, audio, weekly goal) |
| `pajama-onboarding-done` | Flag — onboarding wizard completed |
| `pajama-workout-history` | Array of completed workout entries |
| `pajama-custom-workouts` | User-created workouts |
| `pajama-skip-counts` | Per-exercise skip counter |
| `pajama-hidden-exercises` | Exercises hidden after frequent skipping |

---

## Development

### Getting Started

No build step required. Serve the project root with any static file server:

```bash
npx serve .
```

Or just open `index.html` in a browser.

### Running Tests

```bash
node --test 'tests/*.test.js'
```

Tests use the Node.js built-in test runner (no dependencies). They cover pure utility functions exported from `app.js`, `config.js`, `history.js`, and `sync.js`. Tests also run automatically on every push and pull request via GitHub Actions.

### Adding a Workout

Edit `js/config.js` and add a new entry to the `WORKOUTS` object. Follow the existing pattern:

```js
"my-workout": {
  id: "my-workout",
  title: "My Workout",
  category: "strength",    // strength | mobility | yoga | quick | custom
  subtitle: "Short description",
  description: "Longer description",
  phases: [
    { name: "Squats", type: "work", duration: 40, hint: "Form cues here" },
    { name: "Rest",   type: "rest", duration: 20, hint: "Catch your breath" },
    // ...
  ],
}
```

### Cache Busting / Versioning

The service worker names its cache using `APP_VERSION` from `config.js`. When the version changes, the old cache is purged and all assets are re-fetched.

**You don't need to bump `APP_VERSION` manually.** The deploy workflow automatically stamps it with the git commit SHA before uploading to GitHub Pages. The integer value in `config.js` is only used for local development — if you're testing service worker behavior locally, bump it by hand.

### Deployment

Pushing to `main` triggers two GitHub Actions:

1. **Tests** (`test.yml`) — runs all tests against Node 22.
2. **Deploy** (`deploy.yml`) — stamps `APP_VERSION` with the git SHA, then uploads to GitHub Pages.

No build step. The deploy artifact is the raw source tree with the version patched in.

## License

All rights reserved. See [LICENSE](LICENSE) for details.
