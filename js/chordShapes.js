// chordShapes.js
// Fingering shapes for drawing chord diagrams. Each shape is 6 entries, low E
// string -> high E string: -1 = muted (x), 0 = open (o), n = fret pressed.
// `base` is the lowest fret the diagram window starts at (1 for open chords).
(function () {
  const S = (frets, base = 1) => ({ frets, base });

  const SHAPES = {
    // open major
    "C": S([-1, 3, 2, 0, 1, 0]),
    "A": S([-1, 0, 2, 2, 2, 0]),
    "G": S([3, 2, 0, 0, 0, 3]),
    "E": S([0, 2, 2, 1, 0, 0]),
    "D": S([-1, -1, 0, 2, 3, 2]),
    // open minor
    "Am": S([-1, 0, 2, 2, 1, 0]),
    "Em": S([0, 2, 2, 0, 0, 0]),
    "Dm": S([-1, -1, 0, 2, 3, 1]),
    // 7ths
    "A7": S([-1, 0, 2, 0, 2, 0]),
    "E7": S([0, 2, 0, 1, 0, 0]),
    "D7": S([-1, -1, 0, 2, 1, 2]),
    "G7": S([3, 2, 0, 0, 0, 1]),
    "C7": S([-1, 3, 2, 3, 1, 0]),
    "B7": S([-1, 2, 1, 2, 0, 2]),
    "Am7": S([-1, 0, 2, 0, 1, 0]),
    "Em7": S([0, 2, 2, 0, 3, 0]),
    "Dm7": S([-1, -1, 0, 2, 1, 1]),
    // maj7
    "Cmaj7": S([-1, 3, 2, 0, 0, 0]),
    "Fmaj7": S([-1, -1, 3, 2, 1, 0]),
    "Gmaj7": S([3, 2, 0, 0, 0, 2]),
    "Amaj7": S([-1, 0, 2, 1, 2, 0]),
    // sus / add
    "Dsus4": S([-1, -1, 0, 2, 3, 3]),
    "Dsus2": S([-1, -1, 0, 2, 3, 0]),
    "Asus4": S([-1, 0, 2, 2, 3, 0]),
    "Asus2": S([-1, 0, 2, 2, 0, 0]),
    "Esus4": S([0, 2, 2, 2, 0, 0]),
    "A7sus4": S([-1, 0, 2, 0, 3, 0]),
    "Cadd9": S([-1, 3, 2, 0, 3, 0]),
    "Gadd9": S([3, 2, 0, 2, 0, 3]),
    // barre chords (base shown to the left)
    "F": S([1, 3, 3, 2, 1, 1]),
    "Fm": S([1, 3, 3, 1, 1, 1]),
    "B": S([-1, 2, 4, 4, 4, 2]),
    "Bm": S([-1, 2, 4, 4, 3, 2]),
    "Bb": S([-1, 1, 3, 3, 3, 1]),
    "F#": S([2, 4, 4, 3, 2, 2]),
    "F#m": S([2, 4, 4, 2, 2, 2]),
    "C#m": S([-1, 4, 6, 6, 5, 4], 4),
    "G#m": S([4, 6, 6, 4, 4, 4], 4),
    "Abm": S([4, 6, 6, 4, 4, 4], 4),
    "Cm": S([-1, 3, 5, 5, 4, 3], 3),
    "Gm": S([3, 5, 5, 3, 3, 3], 3),
    // slash chords
    "C/G": S([3, 3, 2, 0, 1, 0]),
    "G/B": S([-1, 2, 0, 0, 0, 3]),
    "D/F#": S([2, -1, 0, 2, 3, 2]),
    "Am/G": S([3, 0, 2, 2, 1, 0]),
  };

  const NOTE_INDEX = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
    "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

  // Resolve a chord name to a drawable shape, simplifying when needed so the
  // panel always shows *something* sensible for unknown extensions.
  function getChordShape(name) {
    if (SHAPES[name]) return SHAPES[name];

    const noSlash = name.split("/")[0];
    if (SHAPES[noSlash]) return SHAPES[noSlash];

    const m = noSlash.match(/^([A-G][#b]?)(.*)$/);
    if (!m) return null;
    const root = m[1];
    const q = m[2].toLowerCase();
    const minor = /^(m|min)(?!aj)/.test(q) || q.startsWith("dim");

    // progressive fallbacks: root+m7 -> root+m -> root ; root+7/maj7 -> root
    const tries = [];
    if (minor) { tries.push(root + "m7", root + "m", root); }
    else { tries.push(root + "maj7", root + "7", root); }
    for (const t of tries) if (SHAPES[t]) return SHAPES[t];

    return null;
  }

  window.ChordShapes = { getChordShape, NOTE_INDEX };
})();
