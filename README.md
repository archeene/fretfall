# 🎸 FretFall — Guitar Trainer (v1)

A Guitar Hero–style, play-along guitar learning app. Load chords/tabs, watch them
fall toward the hit line, and strum along — your microphone is listened to in real
time and scored for accuracy.

## Run it (playable from the desktop)

**Linux / macOS / WSL:**
```bash
./start.sh
```

**Windows:** double-click `FretFall.bat`.

Either way it serves the app on `http://localhost:8753` and opens your browser.
(Running on `localhost` is required so the browser will grant microphone access —
opening `index.html` directly as a `file://` will block the mic.)

## How to play

1. The bundled sample song ("Dancing in the Dark") is pre-loaded — just hit **Play**.
2. Click **🎤 Enable Mic** and allow microphone access.
3. Strum each chord as its block crosses the glowing hit line.
   Green = good hit, red = missed. Build your combo for more points.
4. **Load Tab** to paste your own chords (copy from an Ultimate-Guitar *chords*
   page). Chord lines such as `G   D   Em   C` are detected automatically.
5. Tune the feel with the **BPM** and **Beats/chord** sliders.
   Spacebar toggles play/pause.

## Two play modes

- **Chords** — chord blocks fall; the right panel shows the fret diagram for each
  distinct chord currently on screen (each chord shown once).
- **Notes** — individual picked notes fall in 6 string-lanes (E A D G B e) with
  fret numbers, transcribed from a tab; the panel lists which string/fret to play.
  The **Chords/Notes** button appears for songs that include a note track
  (e.g. the Hallelujah intro picking).

## What v1 does

- Parses Ultimate-Guitar–style chord-over-lyrics text into a timed chord chart.
- Renders a neon, multi-lane falling-notes highway on an HTML canvas.
- Detects pitch from the mic (autocorrelation) and scores hits when the note you
  play belongs to the current chord.

## Known v1 limitations / next iterations

- Timing is derived from BPM + beats-per-chord (uniform), since plain text tabs
  carry no real timing. A Guitar Pro (`.gp5`) importer would give exact rhythm.
- Detection is monophonic (best with single notes / clearly strummed roots);
  full polyphonic chord recognition is a future upgrade.
- No backing-track audio playback yet — you play to the metronome of the highway.
- Pasting from a URL requires copying the text (sites block cross-origin fetch).

## Project layout

```
index.html        UI shell
styles.css        neon dark theme
js/songs.js       bundled sample songs
js/tabParser.js   chord-text parser + chord→pitch-class expansion
js/pitch.js       mic pitch detection (autocorrelation)
js/app.js         game loop, rendering, scoring
start.sh          desktop launcher (serves on localhost, opens browser)
FretFall.bat      Windows launcher
```
