#!/usr/bin/env node
// import-ug-chords.mjs — import CHORD songs from Ultimate Guitar via the
// already-logged-in Chrome (CDP on :9222). For artists/songs that have no
// note-level Guitar Pro tab (indie / piano singer-songwriters), UG chord charts
// are the best available source. Chord pages are NOT Cloudflare-gated, so this
// is fully automated. The app's TabParser turns the chart text into a playable
// chord-strum timeline (Chords mode) with diagrams.
//
// Usage (Chrome must be running with --remote-debugging-port=9222, logged in):
//   node import-ug-chords.mjs "Villagers - Nothing Arrived" "Owl City - Fireflies"
//   node import-ug-chords.mjs --artist "Vienna Teng"        # ALL of an artist's songs
//   node import-ug-chords.mjs --dry ...                     # preview, don't write
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_FILE = path.join(__dirname, "..", "js", "songs.js");
const DEFAULT_STRUM = ["D", "-", "D", "U", "-", "U", "D", "U"];

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const ARTIST_MODE = argv.includes("--artist");
const rest = argv.filter((a) => a !== "--dry" && a !== "--artist");

const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/&/g, "and").replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => new Set(norm(s).split(" ").filter(Boolean));
const overlap = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(A.size, B.size); };
const slug = (s) => norm(s).replace(/ /g, "-");

// clean UG [ch]/[tab] markup into TabParser-friendly chords-above-lyrics text
function cleanChart(raw) {
  return raw
    .replace(/\[tab\]|\[\/tab\]/g, "")
    .replace(/\[ch\]([^\[]*)\[\/ch\]/g, "$1")
    .replace(/\[\/?[a-z0-9]+\]/gi, "")              // strip any other bb tags / section headers
    .split("\n").map((l) => l.replace(/\|/g, " ").replace(/\s+$/, "")).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

async function main() {
  const b = await chromium.connectOverCDP("http://localhost:9222").catch(() => null);
  if (!b) { console.error("Can't reach Chrome on :9222 — is the logged-in browser running?"); process.exit(1); }
  const pg = b.contexts()[0].pages()[0];
  pg.setDefaultTimeout(45000);

  const goto = async (u) => { try { await pg.goto(u, { waitUntil: "domcontentloaded", timeout: 45000 }); } catch {} await pg.waitForTimeout(1800); };
  const results = async () => pg.evaluate(() => {
    const r = (window.UGAPP && window.UGAPP.store && window.UGAPP.store.page && window.UGAPP.store.page.data && window.UGAPP.store.page.data.results) || [];
    return r.map((x) => ({ song: x.song_name, artist: x.artist_name, type: x.type || x.type_name, url: x.tab_url, votes: x.votes || x.rating_count || 0, rating: x.rating || 0 }));
  });

  // build the work list: [{artist, title}] — explicit songs or an artist's full catalog
  let want = [];
  if (ARTIST_MODE) {
    const artist = rest.join(" ");
    await goto("https://www.ultimate-guitar.com/search.php?search_type=title&value=" + encodeURIComponent(artist));
    const rs = await results();
    const byArtist = rs.filter((x) => /chord/i.test(x.type) && overlap(x.artist, artist) >= 0.6);
    const seen = new Set();
    for (const x of byArtist) { const k = norm(x.song); if (!seen.has(k)) { seen.add(k); want.push({ artist: x.artist, title: x.song }); } }
    console.log(`Found ${want.length} chord songs for "${artist}": ${want.map((w) => w.title).join(", ")}`);
  } else {
    want = rest.map((line) => { const [a, t] = line.includes(" - ") ? line.split(/\s+-\s+/) : ["", line]; return { artist: a.trim(), title: t.trim() }; });
  }

  let src = fs.readFileSync(SONGS_FILE, "utf8");
  const existingIds = new Set([...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
  const done = [];
  const entryLit = (e) => `  {
    id: ${JSON.stringify(e.id)},
    title: ${JSON.stringify(e.title)},
    source: ${JSON.stringify(e.source)},
    bpm: ${e.bpm},
    capo: ${e.capo},
    strum: ${JSON.stringify(DEFAULT_STRUM)},
    beatsPerBar: 4,
    chordBars: 1,
    text: ${JSON.stringify(e.text)},
  },`;
  const appendEntry = (e) => { const close = src.lastIndexOf("];"); src = src.slice(0, close) + entryLit(e) + "\n" + src.slice(close); fs.writeFileSync(SONGS_FILE, src); };

  for (const { artist, title } of want) {
    const label = (artist ? artist + " - " : "") + title;
    try {
      await goto("https://www.ultimate-guitar.com/search.php?search_type=title&value=" + encodeURIComponent((title + " " + artist).trim()));
      const rs = await results();
      const cand = rs.filter((x) => /chord/i.test(x.type) && overlap(x.song, title) >= 0.6 && (!artist || overlap(x.artist, artist) >= 0.4))
        .sort((a, c) => (c.rating * Math.log10(c.votes + 10)) - (a.rating * Math.log10(a.votes + 10)));
      if (!cand.length) { console.log(`✗ ${label} — no chord tab`); continue; }
      await goto(cand[0].url);
      const data = await pg.evaluate(() => {
        const d = window.UGAPP.store.page.data, tv = d.tab_view || {}, tab = d.tab || {};
        return {
          song: tab.song_name, artist: tab.artist_name,
          capo: typeof tab.capo === "number" ? tab.capo : 0,
          bpm: (tv.strummings && tv.strummings[0] && tv.strummings[0].bpm) || 0,
          content: (tv.wiki_tab && tv.wiki_tab.content) || "",
          url: window.location.href,
        };
      });
      const text = cleanChart(data.content);
      const chordTokens = (text.match(/\[?[A-G][#b]?(m|maj|min|dim|aug|sus|add|°)?\d*(\/[A-G][#b]?)?/g) || []);
      if (text.length < 40 || chordTokens.length < 4) { console.log(`✗ ${label} — chart too sparse`); continue; }
      let id = slug((data.song || title) + " " + (data.artist || artist));
      let n = 2; while (existingIds.has(id)) id = slug(data.song || title) + "-" + n++;
      existingIds.add(id);
      const bpm = data.bpm && data.bpm >= 40 && data.bpm <= 220 ? data.bpm : 100;
      const entry = { id, title: (data.song || title) + " — " + (data.artist || artist), source: data.url, bpm, capo: data.capo || 0, text };
      if (!DRY) appendEntry(entry);                    // crash-safe incremental write
      done.push({ label, id, bpm, capo: entry.capo, chords: chordTokens.length });
      console.log(`✓ ${label} → ${id}  (bpm ${bpm}, capo ${entry.capo}, ~${chordTokens.length} chord tokens)`);
    } catch (e) { console.log(`✗ ${label} — ${e.message.split("\n")[0]}`); }
  }
  await b.close();
  console.log(`\n${done.length}/${want.length} chord songs imported${DRY ? " (dry run — not written)" : " and written to songs.js"}.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
