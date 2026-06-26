# FretFall — PDF import system

Add any Ultimate-Guitar PDF (either **tab** or **chords** format) to the playable
song library. Both UG formats export as **pure graphics with no text layer**, so
the chords can't be scraped automatically — they have to be read off the rendered
page. This tool automates everything except that read.

## The workflow

1. **Download** the song's PDF from Ultimate-Guitar (tab *or* chords — both work)
   and drop it in your Guitar downloads folder
   (auto-detected: `…/Downloads/Guitar`).

2. **Stage it** — renders pages to PNGs + extracts metadata:
   ```bash
   cd tools
   npm install        # first time only (installs pdf-parse)
   npm run import                      # scan the whole Guitar folder
   # or: node import.mjs "/path/to/one.pdf"
   ```
   This writes `tools/staging/<song>/page1.png …` and a `meta.json`
   (detected format, page count, and any title/artist/tuning/tempo text).

3. **Transcribe** the page images into a song entry in `../js/songs.js`:
   ```js
   {
     id: "song-id",
     title: "Song — Artist",
     source: "https://tabs.ultimate-guitar.com/…",
     bpm: 100,            // from the tempo marking, or your best feel
     beatsPerChord: 4,    // how long each chord lasts (tune to taste)
     capo: 0,             // capo fret if the PDF lists one (matching shifts +capo)
     text: `Verse:
   G        D        Em       C
   lyric line here for readability`,
   }
   ```
   Only the **chord lines** in `text` are parsed; lyrics/section labels are ignored.
   When playing with a **capo**, keep the written chord names — set `capo` and the
   app transposes the mic-matching for you.

4. **Deploy** — commit & push; GitHub Pages redeploys in ~30s and the song shows
   up in the dropdown at https://archeene.github.io/fretfall/ permanently.

> In practice you just say *"import the new PDFs"* and the staging + transcription
> + push happens for you. `tools/staging/` and `tools/node_modules/` are gitignored.
