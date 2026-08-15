# Andante Live Piano

Andante Live Piano is a focused browser practice environment for MusicXML scores and real MIDI piano input. The first vertical slice renders sheet music with OpenSheetMusicDisplay, listens for Web MIDI note events, and advances in Wait Mode only when the expected note or chord has been played.

## Local Development

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm run typecheck
npm test
npm run build
```

## MusicXML

Bundled scores live under `public/scores/<song-id>/`:

```text
public/scores/single-heartbeat/
  metadata.json
  score.musicxml
  score.mxl
```

MusicXML remains the source of truth for expected notes. Local `.musicxml`, `.xml`, and `.mxl` files can be opened in the browser without uploading them.

## Playback Samples

The default playback instrument is a local web-optimized Salamander Grand Piano MP3 subset in:

```text
public/audio/salamander/
```

The app intentionally ignores the score's General MIDI instrument assignment for default playback and uses this acoustic piano sample set instead. Attribution is included beside the samples.

## MIDI

Web MIDI permission is requested only when the user chooses `Connect MIDI`. The app supports browsers without Web MIDI, permission denial, and device disconnection. The on-screen keyboard also sends normalized simulated note events into the same practice engine for development without a Roland LX708 connected.

## GitHub Pages

The Vite base path is configured for:

```text
/Andante-Live-Piano/
```

The workflow in `.github/workflows/deploy.yml` runs type checking, tests, production build, and deploys `dist` to GitHub Pages on pushes to `main`.

One-time repository setting: in GitHub, open **Settings -> Pages -> Build and deployment**, then set **Source** to **GitHub Actions**.
