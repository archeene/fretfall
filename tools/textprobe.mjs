import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// find pdfjs
let pdfjsPath = null;
for (const p of ["pdfjs-dist/legacy/build/pdf.mjs","pdfjs-dist/build/pdf.mjs","pdfjs-dist/legacy/build/pdf.js","pdfjs-dist"]) {
  try { require.resolve(p); pdfjsPath=p; break; } catch(e){}
}
console.log("pdfjs module:", pdfjsPath);
const pdfjs = await import(pdfjsPath);
const data = new Uint8Array(fs.readFileSync("/mnt/c/Users/PRIME/Downloads/Guitar/OFFICIAL BLACKBIRD TABS by The Beatles @ Ultimate-Guitar.Com.pdf"));
const doc = await pdfjs.getDocument({ data }).promise;
console.log("pages:", doc.numPages);
const page = await doc.getPage(1);
const tc = await page.getTextContent();
console.log("text items on page 1:", tc.items.length);
// show a sample of items with positions (str, x, y)
const items = tc.items.filter(it => it.str.trim()).slice(0, 30).map(it => ({ s: it.str, x: Math.round(it.transform[4]), y: Math.round(it.transform[5]) }));
console.log(JSON.stringify(items));
// how many items are pure digits?
const digits = tc.items.filter(it => /^\d+$/.test(it.str.trim()));
console.log("pure-digit text items on page 1:", digits.length);
