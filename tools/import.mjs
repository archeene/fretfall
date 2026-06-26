#!/usr/bin/env node
// import.mjs — stage Ultimate-Guitar PDFs for import into the FretFall library.
//
// Why this exists: UG exports BOTH "tab" and "chords" PDFs as pure graphics
// (no text layer), so the chords can't be scraped by code alone — they have to
// be read from the rendered page. This tool does the mechanical half:
//   1. finds new PDFs in your Guitar downloads folder
//   2. renders each page to a PNG (so the chords can be read)
//   3. pulls out whatever metadata text exists (title/artist/tuning/tempo)
//   4. writes everything to tools/staging/<slug>/
//
// Then the chords are transcribed from the PNGs into js/songs.js (see README).
//
// Usage:
//   node tools/import.mjs                 # scan the default Guitar folder
//   node tools/import.mjs "/path/file.pdf"   # stage one specific PDF
//   GUITAR_DIR=/some/dir node tools/import.mjs

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STAGING = path.join(__dirname, "staging");

// --- locate the Guitar downloads folder ---
function findGuitarDir() {
  if (process.env.GUITAR_DIR) return process.env.GUITAR_DIR;
  const candidates = [];
  // WSL: Windows user Downloads
  const winUsers = "/mnt/c/Users";
  if (fs.existsSync(winUsers)) {
    for (const u of fs.readdirSync(winUsers)) {
      candidates.push(path.join(winUsers, u, "Downloads", "Guitar"));
    }
  }
  candidates.push(path.join(os.homedir(), "Downloads", "Guitar"));
  return candidates.find((d) => fs.existsSync(d)) || null;
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/by .*$/i, "")           // drop "by Artist @ Ultimate-Guitar..."
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function guessFormat(name, text) {
  const n = name.toLowerCase();
  if (n.includes("chord")) return "chords";
  if (n.includes("tab")) return "tab";
  return /tuning|capo/i.test(text) ? "chords" : "unknown";
}

async function stagePdf(pdfPath) {
  const base = path.basename(pdfPath);
  const slug = slugify(base);
  const outDir = path.join(STAGING, slug);
  fs.mkdirSync(outDir, { recursive: true });

  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });

  // metadata text (title/artist/tuning/tempo if any text layer exists)
  const textRes = await parser.getText();
  const text = textRes.text || "";

  // render every page to PNG
  const shot = await parser.getScreenshot({ scale: 3.0 });
  shot.pages.forEach((p, i) => {
    fs.writeFileSync(path.join(outDir, `page${i + 1}.png`), Buffer.from(p.data));
  });

  const meta = {
    sourceFile: pdfPath,
    slug,
    format: guessFormat(base, text),
    pages: shot.pages.length,
    extractedText: text.trim(),
  };
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
  return meta;
}

async function main() {
  fs.mkdirSync(STAGING, { recursive: true });
  const arg = process.argv[2];

  let pdfs = [];
  if (arg) {
    pdfs = [arg];
  } else {
    const dir = findGuitarDir();
    if (!dir) {
      console.error("Could not find a Guitar downloads folder. Set GUITAR_DIR=...");
      process.exit(1);
    }
    console.log(`Scanning: ${dir}`);
    pdfs = fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .map((f) => path.join(dir, f));
  }

  if (!pdfs.length) { console.log("No PDFs found."); return; }

  const results = [];
  for (const p of pdfs) {
    try {
      const meta = await stagePdf(p);
      results.push(meta);
      console.log(`\n✓ Staged: ${meta.slug}  [${meta.format}, ${meta.pages} pages]`);
      console.log(`  images: tools/staging/${meta.slug}/page*.png`);
      if (meta.extractedText) {
        const firstLines = meta.extractedText.split("\n").filter(Boolean).slice(0, 4).join(" | ");
        console.log(`  metadata: ${firstLines}`);
      }
    } catch (e) {
      console.error(`\n✗ Failed: ${p}\n  ${e.message}`);
    }
  }

  console.log(`\nStaged ${results.length} PDF(s). Next: transcribe the page images`);
  console.log("into a song entry in js/songs.js (see tools/README.md).");
}

main();
