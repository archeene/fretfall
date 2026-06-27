#!/usr/bin/env node
// parse-tab-pdf.mjs — LOCAL Optical Tablature Recognition for UG tab PDFs.
//
// Fully local, no external calls. Works for any UG individual-note tab PDF
// (the font is consistent across all of them):
//   1. render the PDF to high-res images (pdf-parse)
//   2. detect the 6 string lines per system (deterministic → correct strings)
//   3. remove staff lines + barlines, segment each digit glyph
//   4. read each glyph's value with tesseract.js (local WASM OCR) — non-digits
//      (>, ties, the TAB clef) return empty and self-filter
//   5. merge two-digit frets, group simultaneous notes into columns
//   6. infer each bar's meter from its width, assign x-proportional timing
//
// Usage: node parse-tab-pdf.mjs "/path/song.pdf" > notes.json
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
const sharp = require("sharp");
const { createWorker } = require("tesseract.js");
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pdfPath = process.argv[2];
if (!pdfPath) { console.error("usage: node parse-tab-pdf.mjs <file.pdf>"); process.exit(1); }
const OUT = process.argv[3] || pdfPath.replace(/\.pdf$/i, "") + ".otr.json";

async function pages(pdf) {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(pdf)) });
  const shot = await parser.getScreenshot({ scale: 6.0 });
  return shot.pages.map((p) => Buffer.from(p.data));
}

// detect tab systems on a page → array of {top,bot}
async function systemsOf(png) {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const rows = [];
  for (let y = 0; y < H; y++) { let d = 0; for (let x = 0; x < W; x++) if (data[y * W + x] < 140) d++; if (d / W > 0.45) rows.push(y); }
  const groups = []; let s = rows[0], p = rows[0];
  for (const y of rows.slice(1)) { if (y - p > 150) { groups.push([s, p]); s = y; } p = y; }
  if (s !== undefined) groups.push([s, p]);
  return { data, W, H, systems: groups.filter((g) => g[1] - g[0] > 180) };
}

function segmentSystem(data, W, H, top, bot) {
  const ink = (x, y) => (x >= 0 && x < W && y >= 0 && y < H && data[y * W + x] < 140);
  // 6 lines within [top-100, bot+100]
  const region = [Math.max(0, top - 110), Math.min(H, bot + 110)];
  const dark = [];
  for (let y = region[0]; y < region[1]; y++) { let d = 0; for (let x = 0; x < W; x++) if (data[y * W + x] < 140) d++; dark.push([y, d / W]); }
  const lr = dark.filter((r) => r[1] > 0.45).map((r) => r[0]);
  const lines = []; let s = lr[0], p = lr[0];
  for (const y of lr.slice(1)) { if (y - p > 8) { lines.push(Math.round((s + p) / 2)); s = y; } p = y; }
  if (s !== undefined) lines.push(Math.round((s + p) / 2));
  const six = lines.slice(0, 6); if (six.length < 6) return null;
  const spacing = (six[5] - six[0]) / 5;
  const yTop = Math.round(six[0] - spacing * 0.85), yBot = Math.round(six[5] + spacing * 0.85);
  // barlines: x columns with near-full vertical ink across the staff
  const bars = [];
  for (let x = 0; x < W; x++) { let c = 0; for (let y = six[0]; y <= six[5]; y++) if (ink(x, y)) c++; if (c > (six[5] - six[0]) * 0.85) bars.push(x); }
  const barX = []; { let bs = bars[0], bp = bars[0]; for (const x of bars.slice(1)) { if (x - bp > 6) { barX.push(Math.round((bs + bp) / 2)); bs = x; } bp = x; } if (bs !== undefined) barX.push(Math.round((bs + bp) / 2)); }
  // glyph mask (remove staff + barlines)
  const mask = new Uint8Array(W * H);
  for (let y = yTop; y <= yBot; y++) { let x = 0; while (x < W) { if (!ink(x, y)) { x++; continue; } let x2 = x; while (x2 < W && ink(x2, y)) x2++; const len = x2 - x;
    for (let xx = x; xx < x2; xx++) { let yu = y; while (ink(xx, yu - 1)) yu--; let yd = y; while (ink(xx, yd + 1)) yd++; const vl = yd - yu + 1;
      const isStaff = (len >= 40 && vl <= 3); let xl = xx; while (ink(xl - 1, y)) xl--; let xr = xx; while (ink(xr + 1, y)) xr++; const isBar = (vl >= spacing * 3.5 && (xr - xl + 1) <= 3);
      if (!isStaff && !isBar) mask[y * W + xx] = 1; } x = x2; } }
  // connected components
  const lab = new Int32Array(W * H); const comps = []; const stk = [];
  for (let y = yTop; y <= yBot; y++) for (let x = 0; x < W; x++) { if (mask[y * W + x] && !lab[y * W + x]) {
    let a = { minx: x, maxx: x, miny: y, maxy: y, cnt: 0 }; stk.push(x, y); lab[y * W + x] = 1;
    while (stk.length) { const cy = stk.pop(), cx = stk.pop(); a.cnt++; if (cx < a.minx) a.minx = cx; if (cx > a.maxx) a.maxx = cx; if (cy < a.miny) a.miny = cy; if (cy > a.maxy) a.maxy = cy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && nx < W && ny >= yTop && ny <= yBot && mask[ny * W + nx] && !lab[ny * W + nx]) { lab[ny * W + nx] = 1; stk.push(nx, ny); } } }
    comps.push(a); } }
  const glyphs = comps.filter((c) => { const w = c.maxx - c.minx + 1, h = c.maxy - c.miny + 1; return c.cnt >= 20 && h >= spacing * 0.5 && h <= spacing * 1.6 && w >= 4 && w <= spacing * 1.3; })
    .map((c) => { const xc = (c.minx + c.maxx) / 2, yc = (c.miny + c.maxy) / 2; let str = 0, bd = 1e9; for (let i = 0; i < 6; i++) { const d = Math.abs(six[i] - yc); if (d < bd) { bd = d; str = i; } } return { ...c, xc, yc, str }; })
    .sort((a, b) => a.xc - b.xc);
  return { six, spacing, yTop, yBot, barX: barX.filter((x) => x > 5 && x < W - 5), glyphs };
}

async function main() {
  const worker = await createWorker("eng", 1, { langPath: path.join(__dirname, "tessdata"), cacheMethod: "none", gzip: true });
  await worker.setParameters({ tessedit_char_whitelist: "0123456789", tessedit_pageseg_mode: "10" });
  const pngs = await pages(pdfPath);
  // collect all measures across the whole song (in order), each with notes + width
  const measures = [];   // {eighthsHint, cols:[{x, notes:[{str,fret}]}]}
  let totalGlyphs = 0, ocrEmpty = 0;
  for (let pi = 0; pi < pngs.length; pi++) {
    const { data, W, H, systems } = await systemsOf(pngs[pi]);
    for (const [top, bot] of systems) {
      const sys = segmentSystem(data, W, H, top, bot);
      if (!sys) continue;
      // OCR each glyph
      for (const g of sys.glyphs) {
        totalGlyphs++;
        const pad = 8, l = Math.max(0, g.minx - pad), t = Math.max(0, g.miny - pad);
        let w = (g.maxx - g.minx + 1) + 2 * pad, h = (g.maxy - g.miny + 1) + 2 * pad;
        if (l + w > W) w = W - l; if (t + h > H) h = H - t;
        const crop = await sharp(pngs[pi]).extract({ left: l, top: t, width: w, height: h }).resize({ height: 64, fit: "contain", background: "#fff" }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: "#fff" }).png().toBuffer();
        const { data: { text } } = await worker.recognize(crop);
        g.v = (text.match(/\d/g) || []).join("");
        if (!g.v) ocrEmpty++;
      }
      const digits = sys.glyphs.filter((g) => g.v);
      // merge two-digit frets: same string, x-gap < spacing
      const merged = [];
      for (const g of digits) {
        const prev = merged[merged.length - 1];
        if (prev && prev.str === g.str && g.minx - prev.maxx < sys.spacing * 0.9) { prev.v += g.v; prev.maxx = g.maxx; prev.xc = (prev.minx + g.maxx) / 2; }
        else merged.push({ ...g });
      }
      // split into measures by barlines
      const cuts = [sys.yTop !== undefined ? -1 : -1, ...sys.barX, W + 1];
      const bounds = [0, ...sys.barX, W];
      for (let bi = 0; bi < bounds.length - 1; bi++) {
        const x0 = bounds[bi], x1 = bounds[bi + 1];
        const inBar = merged.filter((g) => g.xc > x0 && g.xc <= x1);
        if (!inBar.length) continue;
        // group into columns by x
        const cols = [];
        for (const g of inBar.sort((a, b) => a.xc - b.xc)) {
          const c = cols[cols.length - 1];
          if (c && g.xc - c.x < sys.spacing * 0.7) { c.notes.push({ str: g.str, fret: +g.v }); c.x = (c.x + g.xc) / 2; }
          else cols.push({ x: g.xc, notes: [{ str: g.str, fret: +g.v }] });
        }
        measures.push({ width: x1 - x0, cols });
      }
    }
  }
  await worker.terminate();
  // infer meter from bar widths
  const widths = measures.map((m) => m.width).sort((a, b) => a - b);
  const median = widths[Math.floor(widths.length / 2)] || 1;
  const k = 8 / median;   // eighths per pixel (median bar ≈ 4/4)
  // assemble notes (b in eighths, absolute)
  let cum = 0; const notes = [];
  for (const m of measures) {
    let me = Math.round(m.width * k); me = Math.max(2, Math.min(16, Math.round(me / 1) ));   // eighths this bar
    const xs = m.cols.map((c) => c.x); const minX = Math.min(...xs), maxX = Math.max(...xs, minX + 1);
    for (const col of m.cols) {
      const frac = (col.x - minX) / (maxX - minX + 1e-6);
      const b = +(cum + frac * me).toFixed(2);
      for (const n of col.notes) { const s = 5 - n.str; if (s < 0 || s > 5 || !(n.fret >= 0 && n.fret <= 24)) continue; notes.push({ b, s, f: n.fret }); }
    }
    cum += me;
  }
  notes.sort((a, b) => a.b - b.b || a.s - b.s);
  fs.writeFileSync(OUT, JSON.stringify({ glyphs: totalGlyphs, ocrEmpty, measures: measures.length, notes }, null, 0));
  console.error(`done: ${totalGlyphs} glyphs (${ocrEmpty} non-digit), ${measures.length} bars, ${notes.length} notes -> ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
