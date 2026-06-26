# FretFall — automated PDF import

Add any Ultimate-Guitar PDF (tab **or** chords) to the playable song library, fully
automatically. UG PDFs are pure graphics with no text layer, so the chords/notes are
read off the rendered page by **Claude vision** — no manual transcription.

## One-time setup

```bash
cd tools
npm install            # installs @anthropic-ai/sdk, pdf-parse, sharp
```

You need an Anthropic API key: https://console.anthropic.com → API keys.

## Import a song (`extract.mjs`) — the automatic path

```bash
ANTHROPIC_API_KEY=sk-ant-...  node extract.mjs "/path/to/song.pdf"
# or scan the whole Guitar downloads folder:
ANTHROPIC_API_KEY=sk-ant-...  node extract.mjs
```

What it does, end to end:
1. Renders the PDF and detects each tab **system** (or falls back to whole pages for
   chord-over-lyrics PDFs).
2. Sends every system image to **Claude** (`claude-opus-4-8`, structured output), which
   returns notes (`string`/`fret`/position) or chords + tempo/capo/time-signature.
3. Assembles a song with **proper timing** — note positions map to eighth-note slots
   from the time signature; chords map to an ordered sequence.
4. Inserts the finished song object into `../js/songs.js` (as the new default).

Optional overrides (env vars): `SONG_ID`, `SONG_TITLE`, `SONG_SOURCE`, `GUITAR_DIR`.

Then commit & push — GitHub Pages redeploys in ~30s and the song is in the dropdown.

### Cost & accuracy
A few cents per song (one vision call per tab system). It reads UG's clean,
computer-rendered notation well; spot-check a new song in the app and tweak the BPM
slider for feel. For odd chord voicings the diagram falls back gracefully.

## Manual staging fallback (`import.mjs`)

If you'd rather transcribe by hand (no API key), `node import.mjs` just renders pages
to PNGs under `tools/staging/<song>/` for you to read and hand-enter into `js/songs.js`.

> `tools/staging/` and `tools/node_modules/` are gitignored.

## Song format (what gets written to `js/songs.js`)

```js
{
  id, title, source,
  bpm, beatsPerChord, capo,         // capo shifts mic-matching by N semitones
  notes: [ {b, s, f} ],             // tab: b=eighth-note index, s=string 0..5 (low E..high e), f=fret
  text: `Gm  C  D ...`,             // chords: chord lines (only chords are parsed)
}
```
