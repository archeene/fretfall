#!/usr/bin/env node
// extract.mjs — fully automated PDF → playable song importer.
//
// Pipeline: render the UG PDF → detect each tab system → send every system to
// Claude (vision) which returns structured notes/chords + timing → assemble a
// song object → insert it into ../js/songs.js.
//
// Works for BOTH UG formats:
//   • tab/notes PDFs  → individual notes (string/fret/timing) for Notes mode
//   • chords PDFs     → ordered chords (+ capo/tempo) for Chords mode
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-...  node extract.mjs "/path/song.pdf"
//   ANTHROPIC_API_KEY=sk-ant-...  node extract.mjs            # scan Guitar folder
// Options (env): SONG_ID, SONG_TITLE, SONG_SOURCE to override auto-detected values.

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import Anthropic from "@anthropic-ai/sdk";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
const sharp = require("sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_FILE = path.join(__dirname, "..", "js", "songs.js");
const MODEL = "claude-opus-4-8";

// ---- string tuning (low E = index 0 … high e = index 5) ----
const STRING_INDEX = { E: 0, A: 1, D: 2, G: 3, B: 4, e: 5 };

// ---------- locate PDFs ----------
function findGuitarDir() {
  if (process.env.GUITAR_DIR) return process.env.GUITAR_DIR;
  const cands = [];
  if (fs.existsSync("/mnt/c/Users")) {
    for (const u of fs.readdirSync("/mnt/c/Users")) cands.push(`/mnt/c/Users/${u}/Downloads/Guitar`);
  }
  cands.push(path.join(os.homedir(), "Downloads", "Guitar"));
  return cands.find((d) => fs.existsSync(d)) || null;
}

function slugify(name) {
  return name.toLowerCase().replace(/\.pdf$/i, "").replace(/by .*$/i, "")
    .replace(/tab|chords/gi, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

// ---------- render + detect tab systems ----------
async function renderAndCrop(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const meta = (await parser.getText()).text || "";
  const shot = await parser.getScreenshot({ scale: 5.0 });
  const crops = [];
  for (const page of shot.pages) {
    const png = Buffer.from(page.data);
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    // rows that are mostly dark = staff lines / text rows
    const staffRows = [];
    for (let y = 0; y < H; y++) {
      let d = 0;
      for (let x = 0; x < W; x++) if (data[y * W + x] < 150) d++;
      if (d / W > 0.5) staffRows.push(y);
    }
    // group rows into systems (gap < 130px = same system)
    const systems = [];
    let s = staffRows[0], prev = staffRows[0];
    for (const y of staffRows.slice(1)) {
      if (y - prev > 130) { systems.push([s, prev]); s = y; }
      prev = y;
    }
    if (s !== undefined) systems.push([s, prev]);
    const real = systems.filter((b) => b[1] - b[0] > 150);
    if (real.length === 0) {
      // No tab staff on this page (e.g. a chord-over-lyrics PDF): send the whole page.
      const out = await sharp(png).resize({ width: 1600 }).png().toBuffer();
      crops.push(out.toString("base64"));
    } else {
      for (const [top, bot] of real) {
        const y0 = Math.max(0, top - 80), y1 = Math.min(H, bot + 30);
        const out = await sharp(png).extract({ left: 0, top: y0, width: W, height: y1 - y0 })
          .resize({ width: 2000 }).png().toBuffer();
        crops.push(out.toString("base64"));
      }
    }
  }
  return { crops, meta };
}

// ---------- Claude vision: read one system ----------
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    format: { type: "string", enum: ["tab", "chords", "unknown"] },
    tempo: { type: ["integer", "null"] },
    timeSignature: { type: ["string", "null"] },
    tuning: { type: ["string", "null"] },
    capo: { type: ["integer", "null"] },
    chordSequence: { type: "array", items: { type: "string" } },
    measures: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          measureNumber: { type: ["integer", "null"] },
          chordLabel: { type: ["string", "null"] },
          notes: {
            type: "array",
            items: {
              type: "object", additionalProperties: false,
              properties: {
                position: { type: "number" },
                string: { type: "string", enum: ["E", "A", "D", "G", "B", "e"] },
                fret: { type: "integer" },
              },
              required: ["position", "string", "fret"],
            },
          },
        },
        required: ["measureNumber", "chordLabel", "notes"],
      },
    },
  },
  required: ["format", "tempo", "timeSignature", "tuning", "capo", "chordSequence", "measures"],
};

const PROMPT = `You are reading ONE horizontal system (row) from an Ultimate-Guitar PDF.

If it is guitar TABLATURE (six horizontal lines with fret numbers):
- The six lines top-to-bottom are strings: e (1st, highest), B, G, D, A, E (6th, lowest).
- Report "format": "tab".
- For EACH measure (between vertical barlines), list every fret number as a note:
  - "string": one of E A D G B e  (E = lowest 6th string, e = highest 1st string)
  - "fret": the integer printed on that string line
  - "position": where the note sits horizontally within ITS measure, 0.0 at the
    left barline to 1.0 at the right barline. Read left-to-right; stacked numbers
    in the same column share the same position.
  - "measureNumber": the small measure number printed above the staff, if visible.
  - "chordLabel": the chord name printed above this measure, if any (else null).

If it is CHORDS over lyrics (chord names sitting above lyric text, NOT a tab staff):
- Report "format": "chords", leave "measures": [], and fill "chordSequence" with the
  chord names in reading order (left-to-right, top-to-bottom). Ignore the lyrics.

Also report, only if clearly visible on THIS system (else null): "tempo" (BPM number),
"timeSignature" (e.g. "6/8"), "tuning" (e.g. "E A D G B E"), "capo" (fret number).
Be precise. Do not invent notes that aren't printed.`;

async function readSystem(client, b64) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: "high" },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
        { type: "text", text: PROMPT },
      ],
    }],
  });
  const text = res.content.find((b) => b.type === "text")?.text || "{}";
  return JSON.parse(text);
}

// small concurrency pool
async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); }
      catch (e) { console.error(`  system ${idx + 1} failed: ${e.message}`); out[idx] = null; }
    }
  }));
  return out;
}

// ---------- assemble a song from per-system results ----------
function assemble(results, slug) {
  const ok = results.filter(Boolean);
  const meta = {};
  for (const r of ok) {
    if (r.tempo && !meta.tempo) meta.tempo = r.tempo;
    if (r.timeSignature && !meta.timeSignature) meta.timeSignature = r.timeSignature;
    if (r.capo != null && meta.capo == null) meta.capo = r.capo;
  }
  const isTab = ok.filter((r) => r.format === "tab").length >= ok.filter((r) => r.format === "chords").length
    && ok.some((r) => r.measures && r.measures.length);

  const song = {
    id: process.env.SONG_ID || slug,
    title: process.env.SONG_TITLE || slug,
    source: process.env.SONG_SOURCE || "",
    bpm: meta.tempo || 100,
    beatsPerChord: 4,
    capo: meta.capo || 0,
  };

  // eighth-notes per measure from the time signature (default 6/8 → 6)
  let eighthsPerMeasure = 6;
  if (meta.timeSignature && /^\d+\s*\/\s*\d+$/.test(meta.timeSignature)) {
    const [num, den] = meta.timeSignature.split("/").map((x) => parseInt(x, 10));
    eighthsPerMeasure = Math.round(num * (8 / den));
  }

  if (isTab) {
    const notes = [];
    let measureCursor = 0;       // running global measure index when numbers absent
    let lastMeasureNum = null;
    for (const r of ok) {
      if (!r.measures) continue;
      for (const m of r.measures) {
        const mNum = (m.measureNumber != null) ? m.measureNumber : ++measureCursor;
        if (m.measureNumber != null) measureCursor = m.measureNumber;
        const base = (mNum - 1) * eighthsPerMeasure;
        for (const note of m.notes || []) {
          const s = STRING_INDEX[note.string];
          if (s === undefined) continue;
          const slot = Math.round((note.position || 0) * eighthsPerMeasure);
          notes.push({ b: base + Math.max(0, Math.min(eighthsPerMeasure - 1, slot)), s, f: note.fret });
        }
        lastMeasureNum = mNum;
      }
    }
    notes.sort((a, b) => a.b - b.b || a.s - b.s);
    song.notes = notes;
    song.beatsPerChord = 3;
    // also keep a simple chord text from chordLabels for Chords-mode fallback
    const chords = [];
    for (const r of ok) for (const m of r.measures || []) if (m.chordLabel) chords.push(m.chordLabel);
    song.text = chords.length ? chords.join("  ") : "(tab)";
  } else {
    // chords format
    const chords = [];
    for (const r of ok) chords.push(...(r.chordSequence || []));
    song.text = chords.join("  ");
  }
  return song;
}

// ---------- insert into js/songs.js ----------
function songToLiteral(song) {
  const j = JSON.stringify(song, null, 2)
    .replace(/^(\s*)"([a-zA-Z0-9_]+)":/gm, "$1$2:"); // unquote keys
  return j;
}
function insertSong(song) {
  let src = fs.readFileSync(SONGS_FILE, "utf8");
  if (src.includes(`id: "${song.id}"`)) {
    console.log(`! Song id "${song.id}" already in songs.js — not inserting (edit manually).`);
    return false;
  }
  const marker = "window.SONGS = [\n";
  const idx = src.indexOf(marker);
  if (idx < 0) { console.log("! Could not find window.SONGS array."); return false; }
  const at = idx + marker.length;
  const literal = songToLiteral(song).replace(/\n/g, "\n  ");
  src = src.slice(0, at) + "  " + literal + ",\n" + src.slice(at);
  fs.writeFileSync(SONGS_FILE, src);
  return true;
}

// ---------- main ----------
async function main() {
  const DRY = !!process.env.DRY_RUN;
  if (!DRY && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) in the environment first.");
    process.exit(1);
  }
  const client = DRY ? null : new Anthropic();

  let pdfs = [];
  const arg = process.argv[2];
  if (arg) pdfs = [arg];
  else {
    const dir = findGuitarDir();
    if (!dir) { console.error("No Guitar folder found. Set GUITAR_DIR=..."); process.exit(1); }
    pdfs = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).map((f) => path.join(dir, f));
  }
  if (!pdfs.length) { console.log("No PDFs found."); return; }

  for (const pdf of pdfs) {
    const slug = slugify(path.basename(pdf));
    console.log(`\n▶ ${path.basename(pdf)}  (id: ${slug})`);
    const { crops } = await renderAndCrop(pdf);
    console.log(`  ${crops.length} systems → reading with ${MODEL} ...`);
    if (DRY) { console.log(`  [DRY_RUN] rendered ${crops.length} systems (avg ${Math.round(crops.reduce((a,c)=>a+c.length,0)/crops.length/1024)}KB b64); skipping API.`); continue; }
    const results = await mapPool(crops, 4, (b64, i) => {
      process.stdout.write(`  · system ${i + 1}/${crops.length}\r`);
      return readSystem(client, b64);
    });
    const song = assemble(results, slug);
    const noteCount = song.notes ? song.notes.length : 0;
    const chordCount = (song.text.match(/\S+/g) || []).length;
    console.log(`\n  format: ${song.notes ? "tab/notes" : "chords"} | bpm ${song.bpm} | capo ${song.capo} | ${noteCount} notes, ${chordCount} chord tokens`);
    if (insertSong(song)) console.log(`  ✓ inserted "${song.id}" into js/songs.js`);
  }
  console.log("\nDone. Commit & push to deploy.");
}

export { assemble, songToLiteral, STRING_INDEX };

// Run main() only when invoked directly, not when imported for testing.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
