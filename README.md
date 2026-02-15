# Pajama Workout

A 5-minute daily workout timer you can do in your pajamas. No equipment, no excuses.

## Features

- Curated bodyweight workouts (strength, stretch, yoga, mixed)
- Adjustable session length (0.5x - 3x multiplier) and separate rest multiplier
- Voice announcements (exercise names + optional detailed hints during rest)
- Ambient background drone for focus
- Custom workout builder
- Workout history with streak tracking and weekly heatmap
- Google Drive sync across devices (history, custom workouts, settings)
- Installable PWA with offline support
- Wake lock keeps screen on during workouts

## Getting started

No build step required. Serve the project root with any static file server:

```
npx serve .
```

Or just open `index.html` in a browser.

## Running tests

```
node --test 'tests/*.test.js'
```

Tests run automatically on every push and pull request via GitHub Actions.

## Tech stack

- Vanilla JS (no frameworks, no bundler)
- CSS custom properties for theming
- Web Speech API for TTS
- Web Audio API for beep cues
- Service worker for offline caching
- Google Identity Services + Drive API for cloud sync

## License

All rights reserved. See [LICENSE](LICENSE) for details.
