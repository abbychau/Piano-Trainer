# Piano Trainer

Piano Trainer is a browser-based sheet-reading trainer with two modes:

- Pitch training
- Rhythm training

It is built with React + Vite, renders notation with VexFlow, and includes local progress tracking.

## What's New

### Platform and tooling improvements

- Migrated from webpack to Vite for faster startup and rebuilds.
- Migrated tests from Karma/Jasmine to Vitest.
- Simplified modern build/test workflow.

### Pitch training improvements

- Treble and bass chord-size range controls now allow `0` (manual difficulty mode).
- Added independent note-range controls:
  - Treble note range
  - Bass note range
- Added top training HUD with:
  - Average reaction time
  - Coins
  - Last reward
- Added combo + coins reward system with persistence.
- Added optional metronome in pitch mode with:
  - Beat interval control
  - Timing-window bonus reward
  - Optional subdivision click (different sound between beats)
- Added optional reference-note playback for each new prompt:
  - Toggle on/off
  - Adjustable volume
  - Brighter piano-like synthesized timbre

### UX and compatibility fixes

- Fixed boolean prop warning for `hidden` in React.
- Added `mobile-web-app-capable` meta tag.
- Updated dev pipeline to handle JSX-in-`.js` source files correctly.

## Pitch Training Setup (MIDI)

If you want to use a digital piano via MIDI:

1. Use a browser with Web MIDI support (Chrome/Chromium recommended).
2. Connect your MIDI keyboard before starting the training.
3. In app settings, enable MIDI and choose the input device.

If MIDI is unavailable, you can still practice using the on-screen keyboard.

## Tech Stack

- React 16
- Vite 5
- Vitest
- VexFlow
- Chartist
- Freezer.js

## License

MIT. Forked from [Piano Trainer By Phlippotto](https://github.com/philippotto/piano-trainer)