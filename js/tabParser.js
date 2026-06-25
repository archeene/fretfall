// tabParser.js
// Parses Ultimate-Guitar style chord/tab text into an ordered list of chords,
// then expands chords into musical "note tones" (pitch classes) for matching.

(function () {
  const NOTE_INDEX = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
    "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  const PC_NAME = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  // A chord token: root + accidental + the rest (quality / extensions).
  // Examples matched: G, Em, A7sus4, C#m7, F#, Bbmaj7, Dadd9, G/B
  const CHORD_RE = /^([A-G])([#b]?)((?:m(?!aj)|min|maj|dim|aug|sus|add|°|\+|\d|7|9|11|13|\/|[A-G][#b]?)*)$/;

  function isChordToken(tok) {
    if (!tok || tok.length > 12) return false;
    return CHORD_RE.test(tok);
  }

  // A line is a "chord line" if (almost) every whitespace-separated token is a chord.
  function looksLikeChordLine(line) {
    const toks = line.trim().split(/\s+/).filter(Boolean);
    if (toks.length === 0) return false;
    const chords = toks.filter(isChordToken);
    return chords.length === toks.length && chords.length >= 1;
  }

  // Expand a chord name into the set of pitch classes a player would sound.
  function chordToPitchClasses(name) {
    // strip a slash bass; keep both root and bass as acceptable tones
    const parts = name.split("/");
    const main = parts[0];
    const m = main.match(/^([A-G][#b]?)(.*)$/);
    if (!m) return [];
    const root = NOTE_INDEX[m[1]];
    if (root === undefined) return [];
    const quality = m[2].toLowerCase();

    let third = 4, fifth = 7; // default major triad
    if (/^(m|min)(?!aj)/.test(quality) || quality.startsWith("dim")) third = 3;
    if (quality.startsWith("dim")) fifth = 6;
    if (quality.startsWith("aug") || quality.startsWith("+")) fifth = 8;
    if (quality.startsWith("sus2")) third = 2;
    if (quality.startsWith("sus4") || quality === "sus") third = 5;

    const pcs = new Set([root, (root + third) % 12, (root + fifth) % 12]);
    if (/7/.test(quality)) pcs.add((root + (quality.includes("maj7") ? 11 : 10)) % 12);

    // bass note from slash, if present and valid
    if (parts[1]) {
      const bm = parts[1].match(/^([A-G][#b]?)/);
      if (bm && NOTE_INDEX[bm[1]] !== undefined) pcs.add(NOTE_INDEX[bm[1]]);
    }
    return [...pcs];
  }

  // Parse full text -> { chords: [{name, pcs, root}], title }
  function parseTab(text) {
    const lines = text.split(/\r?\n/);
    const chords = [];
    for (const line of lines) {
      if (!looksLikeChordLine(line)) continue;
      for (const tok of line.trim().split(/\s+/)) {
        const pcs = chordToPitchClasses(tok);
        if (pcs.length === 0) continue;
        const rootMatch = tok.match(/^([A-G][#b]?)/);
        chords.push({
          name: tok,
          pcs,
          root: rootMatch ? NOTE_INDEX[rootMatch[1]] : pcs[0],
        });
      }
    }
    return { chords };
  }

  function pcName(pc) { return PC_NAME[((pc % 12) + 12) % 12]; }

  window.TabParser = { parseTab, chordToPitchClasses, isChordToken, pcName, PC_NAME };
})();
