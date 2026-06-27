// Song library. Songs are baked into the repo here, so they persist across
// sessions and devices (served from GitHub Pages).
//
// These entries were imported from Ultimate-Guitar PDFs via tools/import.mjs
// (render → visual transcription). To add more, see tools/README.md.
// Fields: id, title, source, bpm, beatsPerChord, capo (semitone shift for
// pitch matching), text (chord-over-lyrics; only chord lines are parsed).
//
// The first entry is the default loaded on startup.
window.SONGS = [
  {
    id: "hallelujah",
    title: "Hallelujah — Jeff Buckley",
    source: "https://tabs.ultimate-guitar.com/tab/jeff-buckley/hallelujah-guitar-pro-2155367",
    bpm: 102,          // ♩ = 102, 6/8 feel
    capo: 0,           // standard tuning E A D G B E, no capo
    barEighths: 6,     // 6/8 time → 6 eighth-notes per bar (for broken-chord detection)
    chordMarks: [{ b: 0, name: "C" }, { b: 6, name: "Am7" }, { b: 12, name: "C" }, { b: 18, name: "Am7" }, { b: 24, name: "C" }, { b: 30, name: "Am" }, { b: 36, name: "C" }, { b: 42, name: "Am" }, { b: 48, name: "F" }, { b: 54, name: "G" }, { b: 60, name: "C" }, { b: 66, name: "G" }, { b: 72, name: "C" }, { b: 78, name: "F" }, { b: 81, name: "G" }, { b: 84, name: "Am" }, { b: 90, name: "F" }, { b: 96, name: "G" }, { b: 102, name: "E" }, { b: 108, name: "Am" }, { b: 114, name: "C/G" }, { b: 120, name: "F" }, { b: 132, name: "Am" }, { b: 144, name: "F" }, { b: 156, name: "C" }, { b: 162, name: "G" }, { b: 168, name: "C" }, { b: 174, name: "G" }, { b: 180, name: "C" }, { b: 186, name: "Am" }, { b: 192, name: "C" }, { b: 198, name: "Am" }, { b: 204, name: "F" }, { b: 210, name: "G" }, { b: 216, name: "C" }, { b: 222, name: "G" }, { b: 228, name: "C" }, { b: 234, name: "F" }, { b: 237, name: "G" }, { b: 240, name: "Am" }, { b: 246, name: "F" }, { b: 252, name: "G" }, { b: 258, name: "E" }, { b: 264, name: "Am" }, { b: 270, name: "C/G" }, { b: 276, name: "F" }, { b: 288, name: "Am" }, { b: 300, name: "F" }, { b: 312, name: "C" }, { b: 318, name: "G" }, { b: 324, name: "C" }, { b: 330, name: "G" }, { b: 336, name: "C" }, { b: 342, name: "Am" }, { b: 348, name: "C" }, { b: 354, name: "Am" }, { b: 360, name: "F" }, { b: 366, name: "G" }, { b: 372, name: "C" }, { b: 378, name: "G" }, { b: 384, name: "C" }, { b: 390, name: "F" }, { b: 393, name: "G" }, { b: 396, name: "Am" }, { b: 402, name: "F" }, { b: 408, name: "G" }, { b: 414, name: "E" }, { b: 420, name: "Am" }, { b: 432, name: "F" }, { b: 444, name: "Am" }, { b: 456, name: "F" }, { b: 468, name: "C" }, { b: 474, name: "G" }, { b: 480, name: "C" }, { b: 486, name: "G" }, { b: 492, name: "C" }, { b: 498, name: "Am" }, { b: 504, name: "C" }, { b: 510, name: "Am" }, { b: 516, name: "F" }, { b: 522, name: "G" }, { b: 528, name: "C" }, { b: 534, name: "G" }, { b: 540, name: "C" }, { b: 546, name: "F" }, { b: 549, name: "G" }, { b: 552, name: "Am" }, { b: 558, name: "F" }, { b: 564, name: "G" }, { b: 570, name: "E" }, { b: 576, name: "Am" }, { b: 582, name: "C" }, { b: 588, name: "F" }, { b: 600, name: "Am" }, { b: 612, name: "F" }, { b: 624, name: "C" }, { b: 630, name: "G" }, { b: 636, name: "F" }, { b: 648, name: "Am" }, { b: 660, name: "F" }, { b: 672, name: "C" }, { b: 678, name: "G" }, { b: 684, name: "C" }],
    // Full song, lossless from the Guitar Pro (.gpx) file via tools/parse-gp.mjs
    // — every note, string, fret and exact timing preserved.
    // {b: eighth-note position (fractional ok), s: string 0=lowE..5=high-e, f: fret}
    notes: [
      { b: 0, s: 1, f: 3 }, { b: 1, s: 2, f: 2 }, { b: 2, s: 3, f: 0 }, { b: 3, s: 4, f: 1 }, { b: 3, s: 5, f: 3 }, { b: 4, s: 3, f: 0 }, { b: 5, s: 1, f: 2 }, { b: 6, s: 1, f: 0 },
      { b: 7, s: 2, f: 2 }, { b: 8, s: 3, f: 0 }, { b: 9, s: 4, f: 1 }, { b: 9, s: 5, f: 3 }, { b: 10, s: 3, f: 0 }, { b: 11, s: 1, f: 2 }, { b: 12, s: 1, f: 3 }, { b: 13, s: 2, f: 2 },
      { b: 14, s: 3, f: 0 }, { b: 15, s: 4, f: 1 }, { b: 15, s: 5, f: 3 }, { b: 16, s: 3, f: 0 }, { b: 17, s: 1, f: 2 }, { b: 18, s: 1, f: 0 }, { b: 19, s: 2, f: 2 }, { b: 20, s: 3, f: 0 },
      { b: 21, s: 4, f: 1 }, { b: 21, s: 5, f: 3 }, { b: 22, s: 3, f: 0 }, { b: 23, s: 2, f: 2 }, { b: 24, s: 1, f: 3 }, { b: 24, s: 3, f: 0 }, { b: 25, s: 3, f: 0 }, { b: 26, s: 3, f: 0 },
      { b: 27, s: 1, f: 3 }, { b: 28, s: 2, f: 2 }, { b: 29, s: 1, f: 2 }, { b: 29, s: 3, f: 0 }, { b: 30, s: 1, f: 0 }, { b: 30, s: 3, f: 2 }, { b: 31, s: 3, f: 2 }, { b: 32, s: 3, f: 2 },
      { b: 33, s: 1, f: 0 }, { b: 34, s: 2, f: 2 }, { b: 35, s: 1, f: 2 }, { b: 35, s: 2, f: 2 }, { b: 36, s: 1, f: 3 }, { b: 36, s: 3, f: 0 }, { b: 37, s: 3, f: 0 }, { b: 38, s: 3, f: 0 },
      { b: 39, s: 1, f: 3 }, { b: 40, s: 2, f: 2 }, { b: 41, s: 1, f: 2 }, { b: 41, s: 3, f: 0 }, { b: 42, s: 1, f: 0 }, { b: 42, s: 3, f: 2 }, { b: 43, s: 3, f: 2 }, { b: 44, s: 3, f: 2 },
      { b: 45, s: 1, f: 0 }, { b: 46, s: 2, f: 2 }, { b: 47, s: 3, f: 0 }, { b: 48, s: 0, f: 1 }, { b: 48, s: 2, f: 3 }, { b: 48, s: 3, f: 2 }, { b: 50, s: 2, f: 3 }, { b: 50, s: 3, f: 2 },
      { b: 51, s: 0, f: 1 }, { b: 52, s: 2, f: 3 }, { b: 52, s: 3, f: 2 }, { b: 53, s: 3, f: 2 }, { b: 54, s: 0, f: 3 }, { b: 54, s: 2, f: 0 }, { b: 54, s: 3, f: 2 }, { b: 56, s: 2, f: 0 },
      { b: 56, s: 3, f: 0 }, { b: 57, s: 0, f: 3 }, { b: 57, s: 3, f: 0 }, { b: 58, s: 1, f: 2 }, { b: 59, s: 2, f: 3 }, { b: 60, s: 1, f: 3 }, { b: 60, s: 3, f: 0 }, { b: 61, s: 2, f: 2 },
      { b: 62, s: 3, f: 0 }, { b: 63, s: 4, f: 1 }, { b: 64, s: 0, f: 0 }, { b: 65, s: 0, f: 1 }, { b: 66, s: 0, f: 3 }, { b: 67, s: 1, f: 2 }, { b: 68, s: 2, f: 0 }, { b: 69, s: 3, f: 0 },
      { b: 70, s: 1, f: 2 }, { b: 71, s: 2, f: 2 }, { b: 72, s: 1, f: 3 }, { b: 72, s: 3, f: 0 }, { b: 73, s: 3, f: 0 }, { b: 74, s: 3, f: 0 }, { b: 75, s: 1, f: 3 }, { b: 76, s: 2, f: 2 },
      { b: 77, s: 3, f: 0 }, { b: 78, s: 0, f: 1 }, { b: 78, s: 2, f: 3 }, { b: 78, s: 3, f: 2 }, { b: 79, s: 1, f: 3 }, { b: 80, s: 2, f: 3 }, { b: 80, s: 3, f: 2 }, { b: 81, s: 0, f: 3 },
      { b: 81, s: 3, f: 0 }, { b: 81, s: 4, f: 0 }, { b: 82, s: 2, f: 0 }, { b: 83, s: 3, f: 0 }, { b: 84, s: 1, f: 0 }, { b: 84, s: 3, f: 2 }, { b: 84, s: 4, f: 1 }, { b: 85, s: 3, f: 2 },
      { b: 85, s: 4, f: 1 }, { b: 86, s: 3, f: 2 }, { b: 86, s: 4, f: 1 }, { b: 87, s: 1, f: 0 }, { b: 88, s: 2, f: 2 }, { b: 89, s: 3, f: 2 }, { b: 89, s: 4, f: 1 }, { b: 90, s: 0, f: 1 },
      { b: 90, s: 2, f: 3 }, { b: 90, s: 3, f: 2 }, { b: 90, s: 4, f: 1 }, { b: 91, s: 3, f: 2 }, { b: 91, s: 4, f: 1 }, { b: 92, s: 3, f: 2 }, { b: 92, s: 4, f: 1 }, { b: 92.25, s: 4, f: 3 },
      { b: 93, s: 0, f: 1 }, { b: 94, s: 2, f: 3 }, { b: 95, s: 3, f: 2 }, { b: 95, s: 4, f: 1 }, { b: 96, s: 0, f: 3 }, { b: 96, s: 3, f: 0 }, { b: 96, s: 4, f: 3 }, { b: 97, s: 2, f: 0 },
      { b: 98, s: 3, f: 0 }, { b: 98, s: 4, f: 3 }, { b: 99, s: 0, f: 3 }, { b: 100, s: 2, f: 0 }, { b: 101, s: 3, f: 0 }, { b: 101, s: 4, f: 3 }, { b: 102, s: 0, f: 0 }, { b: 102, s: 4, f: 0 },
      { b: 102, s: 5, f: 0 }, { b: 103, s: 3, f: 1 }, { b: 104, s: 4, f: 0 }, { b: 104, s: 5, f: 0 }, { b: 105, s: 0, f: 0 }, { b: 106, s: 5, f: 0 }, { b: 107, s: 4, f: 3 }, { b: 108, s: 1, f: 0 },
      { b: 108, s: 4, f: 3 }, { b: 109, s: 2, f: 2 }, { b: 110, s: 3, f: 2 }, { b: 110, s: 4, f: 1 }, { b: 111, s: 1, f: 0 }, { b: 112, s: 2, f: 2 }, { b: 113, s: 3, f: 2 }, { b: 113, s: 4, f: 1 },
      { b: 114, s: 0, f: 3 }, { b: 115, s: 2, f: 2 }, { b: 116, s: 3, f: 0 }, { b: 116, s: 4, f: 1 }, { b: 117, s: 0, f: 3 }, { b: 117, s: 2, f: 2 }, { b: 119, s: 3, f: 0 }, { b: 120, s: 0, f: 1 },
      { b: 120, s: 2, f: 3 }, { b: 120, s: 3, f: 2 }, { b: 121, s: 1, f: 3 }, { b: 122, s: 2, f: 3 }, { b: 122, s: 3, f: 2 }, { b: 123, s: 0, f: 1 }, { b: 124, s: 1, f: 3 }, { b: 125, s: 2, f: 3 },
      { b: 126, s: 0, f: 1 }, { b: 127, s: 1, f: 3 }, { b: 128, s: 2, f: 3 }, { b: 129, s: 0, f: 1 }, { b: 129, s: 3, f: 2 }, { b: 130, s: 1, f: 3 }, { b: 131, s: 3, f: 0 }, { b: 132, s: 1, f: 0 },
      { b: 132, s: 2, f: 2 }, { b: 134, s: 2, f: 2 }, { b: 135, s: 1, f: 0 }, { b: 136, s: 2, f: 2 }, { b: 137, s: 3, f: 2 }, { b: 138, s: 1, f: 0 }, { b: 139, s: 2, f: 2 }, { b: 140, s: 3, f: 2 },
      { b: 141, s: 1, f: 0 }, { b: 141, s: 2, f: 2 }, { b: 143, s: 3, f: 0 }, { b: 144, s: 0, f: 1 }, { b: 144, s: 2, f: 3 }, { b: 144, s: 3, f: 2 }, { b: 145, s: 1, f: 3 }, { b: 146, s: 2, f: 3 },
      { b: 146, s: 3, f: 2 }, { b: 147, s: 0, f: 1 }, { b: 148, s: 1, f: 3 }, { b: 149, s: 2, f: 3 }, { b: 150, s: 0, f: 1 }, { b: 151, s: 1, f: 3 }, { b: 152, s: 2, f: 3 }, { b: 153, s: 0, f: 1 },
      { b: 153, s: 3, f: 2 }, { b: 154, s: 1, f: 3 }, { b: 155, s: 3, f: 0 }, { b: 156, s: 1, f: 3 }, { b: 156, s: 2, f: 2 }, { b: 158, s: 2, f: 2 }, { b: 159, s: 1, f: 3 }, { b: 160, s: 2, f: 3 },
      { b: 161, s: 2, f: 2 }, { b: 162, s: 0, f: 3 }, { b: 162, s: 2, f: 0 }, { b: 163, s: 1, f: 2 }, { b: 164, s: 2, f: 0 }, { b: 165, s: 0, f: 3 }, { b: 166, s: 1, f: 2 }, { b: 167, s: 2, f: 0 },
      { b: 168, s: 1, f: 3 }, { b: 169, s: 3, f: 0 }, { b: 170, s: 4, f: 1 }, { b: 171, s: 5, f: 3 }, { b: 172, s: 4, f: 1 }, { b: 173, s: 3, f: 0 }, { b: 174, s: 0, f: 3 }, { b: 175, s: 2, f: 0 },
      { b: 176, s: 3, f: 0 }, { b: 177, s: 4, f: 3 }, { b: 178, s: 3, f: 0 }, { b: 179, s: 2, f: 2 }, { b: 180, s: 1, f: 3 }, { b: 180, s: 2, f: 2 }, { b: 180, s: 3, f: 0 }, { b: 181, s: 2, f: 2 },
      { b: 181, s: 3, f: 0 }, { b: 182, s: 2, f: 2 }, { b: 182, s: 3, f: 0 }, { b: 183, s: 1, f: 3 }, { b: 184, s: 2, f: 2 }, { b: 185, s: 1, f: 2 }, { b: 185, s: 3, f: 0 }, { b: 186, s: 1, f: 0 },
      { b: 186, s: 2, f: 2 }, { b: 186, s: 3, f: 2 }, { b: 187, s: 2, f: 2 }, { b: 187, s: 3, f: 2 }, { b: 188, s: 2, f: 2 }, { b: 188, s: 3, f: 2 }, { b: 189, s: 1, f: 0 }, { b: 190, s: 2, f: 2 },
      { b: 191, s: 1, f: 2 }, { b: 191, s: 2, f: 2 }, { b: 192, s: 1, f: 3 }, { b: 192, s: 2, f: 2 }, { b: 192, s: 3, f: 0 }, { b: 193, s: 2, f: 2 }, { b: 193, s: 3, f: 0 }, { b: 194, s: 2, f: 2 },
      { b: 194, s: 3, f: 0 }, { b: 195, s: 1, f: 3 }, { b: 196, s: 2, f: 2 }, { b: 197, s: 1, f: 2 }, { b: 197, s: 3, f: 0 }, { b: 198, s: 1, f: 0 }, { b: 198, s: 2, f: 2 }, { b: 198, s: 3, f: 2 },
      { b: 199, s: 2, f: 2 }, { b: 199, s: 3, f: 2 }, { b: 200, s: 2, f: 2 }, { b: 200, s: 3, f: 2 }, { b: 201, s: 1, f: 0 }, { b: 202, s: 2, f: 2 }, { b: 203, s: 3, f: 0 }, { b: 204, s: 0, f: 1 },
      { b: 204, s: 2, f: 3 }, { b: 204, s: 3, f: 2 }, { b: 205, s: 1, f: 3 }, { b: 206, s: 2, f: 3 }, { b: 206, s: 3, f: 2 }, { b: 207, s: 0, f: 1 }, { b: 208, s: 2, f: 3 }, { b: 208, s: 3, f: 2 },
      { b: 209, s: 2, f: 3 }, { b: 209, s: 3, f: 2 }, { b: 210, s: 0, f: 3 }, { b: 210, s: 2, f: 0 }, { b: 210, s: 3, f: 2 }, { b: 211, s: 1, f: 2 }, { b: 212, s: 2, f: 0 }, { b: 212, s: 3, f: 0 },
      { b: 213, s: 0, f: 3 }, { b: 213, s: 3, f: 0 }, { b: 214, s: 1, f: 2 }, { b: 215, s: 2, f: 3 }, { b: 216, s: 1, f: 3 }, { b: 216, s: 3, f: 0 }, { b: 217, s: 2, f: 2 }, { b: 218, s: 3, f: 0 },
      { b: 219, s: 4, f: 1 }, { b: 220, s: 0, f: 0 }, { b: 221, s: 0, f: 1 }, { b: 222, s: 0, f: 3 }, { b: 222, s: 3, f: 0 }, { b: 223, s: 1, f: 2 }, { b: 224, s: 2, f: 0 }, { b: 225, s: 3, f: 0 },
      { b: 226, s: 1, f: 2 }, { b: 227, s: 2, f: 2 }, { b: 228, s: 1, f: 3 }, { b: 228, s: 2, f: 2 }, { b: 228, s: 3, f: 0 }, { b: 229, s: 2, f: 2 }, { b: 229, s: 3, f: 0 }, { b: 230, s: 2, f: 2 },
      { b: 230, s: 3, f: 0 }, { b: 231, s: 1, f: 3 }, { b: 232, s: 2, f: 2 }, { b: 233, s: 3, f: 0 }, { b: 234, s: 0, f: 1 }, { b: 234, s: 2, f: 3 }, { b: 234, s: 3, f: 2 }, { b: 235, s: 1, f: 3 },
      { b: 236, s: 2, f: 3 }, { b: 236, s: 3, f: 2 }, { b: 237, s: 0, f: 3 }, { b: 237, s: 3, f: 0 }, { b: 237, s: 4, f: 0 }, { b: 238, s: 2, f: 0 }, { b: 239, s: 3, f: 0 }, { b: 240, s: 1, f: 0 },
      { b: 240, s: 3, f: 2 }, { b: 240, s: 4, f: 1 }, { b: 241, s: 3, f: 2 }, { b: 241, s: 4, f: 1 }, { b: 242, s: 3, f: 2 }, { b: 242, s: 4, f: 1 }, { b: 243, s: 1, f: 0 }, { b: 244, s: 2, f: 2 },
      { b: 245, s: 3, f: 2 }, { b: 245, s: 4, f: 1 }, { b: 246, s: 0, f: 1 }, { b: 246, s: 2, f: 3 }, { b: 246, s: 3, f: 2 }, { b: 246, s: 4, f: 1 }, { b: 247, s: 3, f: 2 }, { b: 247, s: 4, f: 1 },
      { b: 248, s: 3, f: 2 }, { b: 248, s: 4, f: 1 }, { b: 248.25, s: 4, f: 3 }, { b: 249, s: 0, f: 1 }, { b: 250, s: 2, f: 3 }, { b: 251, s: 3, f: 2 }, { b: 251, s: 4, f: 1 }, { b: 252, s: 0, f: 3 },
      { b: 252, s: 3, f: 0 }, { b: 252, s: 4, f: 3 }, { b: 253, s: 2, f: 0 }, { b: 254, s: 3, f: 0 }, { b: 254, s: 4, f: 3 }, { b: 255, s: 0, f: 3 }, { b: 256, s: 2, f: 0 }, { b: 257, s: 3, f: 0 },
      { b: 257, s: 4, f: 3 }, { b: 258, s: 0, f: 0 }, { b: 258, s: 4, f: 0 }, { b: 258, s: 5, f: 0 }, { b: 259, s: 3, f: 1 }, { b: 260, s: 4, f: 0 }, { b: 260, s: 5, f: 0 }, { b: 261, s: 0, f: 0 },
      { b: 262, s: 5, f: 0 }, { b: 263, s: 4, f: 3 }, { b: 264, s: 1, f: 0 }, { b: 264, s: 4, f: 3 }, { b: 265, s: 2, f: 2 }, { b: 266, s: 3, f: 2 }, { b: 266, s: 4, f: 1 }, { b: 267, s: 1, f: 0 },
      { b: 268, s: 2, f: 2 }, { b: 269, s: 3, f: 2 }, { b: 269, s: 4, f: 1 }, { b: 270, s: 0, f: 3 }, { b: 271, s: 2, f: 2 }, { b: 272, s: 3, f: 0 }, { b: 272, s: 4, f: 1 }, { b: 273, s: 0, f: 3 },
      { b: 273, s: 2, f: 2 }, { b: 275, s: 3, f: 0 }, { b: 276, s: 0, f: 1 }, { b: 276, s: 2, f: 3 }, { b: 276, s: 3, f: 2 }, { b: 277, s: 1, f: 3 }, { b: 278, s: 2, f: 3 }, { b: 278, s: 3, f: 2 },
      { b: 279, s: 0, f: 1 }, { b: 280, s: 1, f: 3 }, { b: 281, s: 2, f: 3 }, { b: 282, s: 0, f: 1 }, { b: 283, s: 1, f: 3 }, { b: 284, s: 2, f: 3 }, { b: 285, s: 0, f: 1 }, { b: 285, s: 3, f: 2 },
      { b: 286, s: 1, f: 3 }, { b: 287, s: 3, f: 0 }, { b: 288, s: 1, f: 0 }, { b: 288, s: 2, f: 2 }, { b: 290, s: 2, f: 2 }, { b: 291, s: 1, f: 0 }, { b: 292, s: 2, f: 2 }, { b: 293, s: 3, f: 2 },
      { b: 294, s: 1, f: 0 }, { b: 295, s: 2, f: 2 }, { b: 296, s: 3, f: 2 }, { b: 297, s: 1, f: 0 }, { b: 297, s: 2, f: 2 }, { b: 299, s: 3, f: 0 }, { b: 300, s: 0, f: 1 }, { b: 300, s: 2, f: 3 },
      { b: 300, s: 3, f: 2 }, { b: 301, s: 1, f: 3 }, { b: 302, s: 2, f: 3 }, { b: 302, s: 3, f: 2 }, { b: 303, s: 0, f: 1 }, { b: 304, s: 1, f: 3 }, { b: 305, s: 2, f: 3 }, { b: 306, s: 0, f: 1 },
      { b: 307, s: 1, f: 3 }, { b: 308, s: 2, f: 3 }, { b: 309, s: 0, f: 1 }, { b: 309, s: 3, f: 2 }, { b: 310, s: 1, f: 3 }, { b: 311, s: 3, f: 0 }, { b: 312, s: 1, f: 3 }, { b: 312, s: 2, f: 2 },
      { b: 314, s: 2, f: 2 }, { b: 315, s: 1, f: 3 }, { b: 316, s: 2, f: 3 }, { b: 317, s: 2, f: 2 }, { b: 318, s: 0, f: 3 }, { b: 318, s: 2, f: 0 }, { b: 319, s: 1, f: 2 }, { b: 320, s: 2, f: 0 },
      { b: 321, s: 0, f: 3 }, { b: 322, s: 1, f: 2 }, { b: 323, s: 2, f: 0 }, { b: 324, s: 1, f: 3 }, { b: 325, s: 2, f: 2 }, { b: 326, s: 3, f: 0 }, { b: 327, s: 4, f: 1 }, { b: 327, s: 5, f: 3 },
      { b: 328, s: 3, f: 0 }, { b: 329, s: 1, f: 3 }, { b: 330, s: 0, f: 3 }, { b: 331, s: 2, f: 0 }, { b: 332, s: 3, f: 0 }, { b: 333, s: 4, f: 0 }, { b: 334, s: 3, f: 0 }, { b: 335, s: 5, f: 0 },
      { b: 336, s: 1, f: 3 }, { b: 336, s: 3, f: 0 }, { b: 336, s: 4, f: 1 }, { b: 336, s: 5, f: 3 }, { b: 337, s: 3, f: 0 }, { b: 338, s: 4, f: 1 }, { b: 338, s: 5, f: 3 }, { b: 339, s: 2, f: 2 },
      { b: 339, s: 4, f: 1 }, { b: 339, s: 5, f: 3 }, { b: 340, s: 3, f: 0 }, { b: 341, s: 4, f: 1 }, { b: 341, s: 5, f: 3 }, { b: 342, s: 1, f: 0 }, { b: 342, s: 4, f: 5 }, { b: 342, s: 5, f: 5 },
      { b: 343, s: 3, f: 5 }, { b: 344, s: 4, f: 5 }, { b: 344, s: 5, f: 5 }, { b: 345, s: 2, f: 7 }, { b: 345, s: 4, f: 5 }, { b: 345, s: 5, f: 5 }, { b: 346, s: 3, f: 5 }, { b: 347, s: 4, f: 5 },
      { b: 348, s: 1, f: 3 }, { b: 348, s: 3, f: 0 }, { b: 348, s: 4, f: 1 }, { b: 348, s: 5, f: 3 }, { b: 349, s: 3, f: 0 }, { b: 350, s: 4, f: 1 }, { b: 350, s: 5, f: 3 }, { b: 351, s: 2, f: 2 },
      { b: 351, s: 4, f: 1 }, { b: 351, s: 5, f: 3 }, { b: 352, s: 3, f: 0 }, { b: 353, s: 4, f: 1 }, { b: 353, s: 5, f: 3 }, { b: 354, s: 1, f: 0 }, { b: 354, s: 4, f: 5 }, { b: 354, s: 5, f: 5 },
      { b: 355, s: 3, f: 5 }, { b: 356, s: 4, f: 5 }, { b: 356, s: 5, f: 5 }, { b: 357, s: 2, f: 7 }, { b: 357, s: 4, f: 5 }, { b: 357, s: 5, f: 5 }, { b: 358, s: 3, f: 5 }, { b: 359, s: 4, f: 8 },
      { b: 360, s: 2, f: 3 }, { b: 360, s: 5, f: 5 }, { b: 361, s: 3, f: 5 }, { b: 362, s: 5, f: 5 }, { b: 363, s: 3, f: 5 }, { b: 363, s: 5, f: 5 }, { b: 364, s: 5, f: 3 }, { b: 365, s: 5, f: 5 },
      { b: 366, s: 0, f: 3 }, { b: 367, s: 3, f: 4 }, { b: 368, s: 5, f: 3 }, { b: 369, s: 3, f: 0 }, { b: 369, s: 5, f: 3 }, { b: 370, s: 5, f: 1 }, { b: 371, s: 5, f: 3 }, { b: 372, s: 1, f: 3 },
      { b: 373, s: 2, f: 2 }, { b: 374, s: 3, f: 0 }, { b: 375, s: 4, f: 1 }, { b: 375, s: 5, f: 3 }, { b: 376, s: 0, f: 0 }, { b: 377, s: 0, f: 1 }, { b: 378, s: 0, f: 3 }, { b: 379, s: 2, f: 0 },
      { b: 380, s: 3, f: 0 }, { b: 381, s: 4, f: 0 }, { b: 382, s: 3, f: 0 }, { b: 383, s: 5, f: 0 }, { b: 384, s: 1, f: 3 }, { b: 384, s: 3, f: 0 }, { b: 384, s: 4, f: 1 }, { b: 384, s: 5, f: 3 },
      { b: 385, s: 4, f: 1 }, { b: 385, s: 5, f: 3 }, { b: 386, s: 4, f: 1 }, { b: 386, s: 5, f: 3 }, { b: 387, s: 1, f: 3 }, { b: 388, s: 3, f: 0 }, { b: 389, s: 4, f: 1 }, { b: 389, s: 5, f: 3 },
      { b: 390, s: 2, f: 3 }, { b: 390, s: 5, f: 5 }, { b: 391, s: 3, f: 5 }, { b: 392, s: 5, f: 5 }, { b: 393, s: 2, f: 5 }, { b: 393, s: 5, f: 7 }, { b: 394, s: 3, f: 7 }, { b: 395, s: 5, f: 5 },
      { b: 396, s: 1, f: 0 }, { b: 396, s: 3, f: 5 }, { b: 396, s: 4, f: 5 }, { b: 396, s: 5, f: 8 }, { b: 397, s: 4, f: 5 }, { b: 397, s: 5, f: 8 }, { b: 398, s: 4, f: 5 }, { b: 398, s: 5, f: 8 },
      { b: 399, s: 1, f: 0 }, { b: 400, s: 3, f: 5 }, { b: 401, s: 4, f: 5 }, { b: 401, s: 5, f: 8 }, { b: 402, s: 1, f: 8 }, { b: 402, s: 3, f: 10 }, { b: 402, s: 4, f: 10 }, { b: 402, s: 5, f: 8 },
      { b: 403, s: 4, f: 10 }, { b: 403, s: 5, f: 8 }, { b: 404, s: 4, f: 10 }, { b: 404, s: 5, f: 8 }, { b: 404.25, s: 5, f: 10 }, { b: 405, s: 1, f: 8 }, { b: 406, s: 3, f: 10 }, { b: 407, s: 4, f: 10 },
      { b: 407, s: 5, f: 8 }, { b: 408, s: 1, f: 10 }, { b: 408, s: 3, f: 12 }, { b: 408, s: 4, f: 12 }, { b: 408, s: 5, f: 10 }, { b: 409, s: 4, f: 12 }, { b: 409, s: 5, f: 10 }, { b: 410, s: 4, f: 12 },
      { b: 410, s: 5, f: 10 }, { b: 411, s: 1, f: 10 }, { b: 412, s: 3, f: 12 }, { b: 413, s: 4, f: 12 }, { b: 413, s: 5, f: 10 }, { b: 414, s: 0, f: 0 }, { b: 414, s: 5, f: 12 }, { b: 415, s: 3, f: 9 },
      { b: 416, s: 4, f: 9 }, { b: 416, s: 5, f: 12 }, { b: 417, s: 2, f: 9 }, { b: 417, s: 5, f: 12 }, { b: 418, s: 3, f: 9 }, { b: 419, s: 4, f: 9 }, { b: 419, s: 5, f: 10 }, { b: 420, s: 1, f: 0 },
      { b: 420, s: 5, f: 10 }, { b: 421, s: 3, f: 9 }, { b: 422, s: 4, f: 10 }, { b: 422, s: 5, f: 8 }, { b: 423, s: 1, f: 0 }, { b: 424, s: 3, f: 9 }, { b: 425, s: 4, f: 10 }, { b: 426, s: 1, f: 0 },
      { b: 429, s: 5, f: 0 }, { b: 431, s: 5, f: 3 }, { b: 432, s: 2, f: 3 }, { b: 432, s: 5, f: 5 }, { b: 433, s: 3, f: 5 }, { b: 434, s: 5, f: 5 }, { b: 435, s: 2, f: 3 }, { b: 436, s: 3, f: 5 },
      { b: 437, s: 5, f: 5 }, { b: 438, s: 2, f: 3 }, { b: 439, s: 3, f: 5 }, { b: 440, s: 5, f: 5 }, { b: 441, s: 2, f: 3 }, { b: 441, s: 5, f: 5 }, { b: 442, s: 3, f: 5 }, { b: 443, s: 5, f: 3 },
      { b: 444, s: 1, f: 0 }, { b: 444, s: 5, f: 0 }, { b: 445, s: 3, f: 2 }, { b: 446, s: 4, f: 1 }, { b: 446, s: 5, f: 0 }, { b: 447, s: 1, f: 0 }, { b: 448, s: 3, f: 2 }, { b: 449, s: 4, f: 1 },
      { b: 450, s: 1, f: 0 }, { b: 451, s: 3, f: 2 }, { b: 452, s: 4, f: 1 }, { b: 453, s: 1, f: 0 }, { b: 453, s: 5, f: 0 }, { b: 454, s: 3, f: 2 }, { b: 455, s: 5, f: 3 }, { b: 456, s: 2, f: 3 },
      { b: 456, s: 5, f: 5 }, { b: 457, s: 3, f: 5 }, { b: 458, s: 5, f: 5 }, { b: 459, s: 2, f: 3 }, { b: 460, s: 3, f: 5 }, { b: 461, s: 5, f: 5 }, { b: 462, s: 2, f: 3 }, { b: 463, s: 3, f: 5 },
      { b: 464, s: 5, f: 5 }, { b: 465, s: 2, f: 3 }, { b: 465, s: 5, f: 5 }, { b: 466, s: 3, f: 5 }, { b: 467, s: 5, f: 3 }, { b: 468, s: 1, f: 3 }, { b: 468, s: 5, f: 0 }, { b: 469, s: 3, f: 0 },
      { b: 470, s: 5, f: 0 }, { b: 471, s: 1, f: 3 }, { b: 472, s: 5, f: 1 }, { b: 473, s: 5, f: 0 }, { b: 474, s: 0, f: 3 }, { b: 474, s: 4, f: 3 }, { b: 475, s: 2, f: 0 }, { b: 476, s: 3, f: 0 },
      { b: 477, s: 0, f: 3 }, { b: 477, s: 4, f: 3 }, { b: 478, s: 3, f: 0 }, { b: 479, s: 2, f: 0 }, { b: 480, s: 1, f: 3 }, { b: 481, s: 2, f: 2 }, { b: 482, s: 3, f: 0 }, { b: 483, s: 4, f: 1 },
      { b: 483, s: 5, f: 3 }, { b: 484, s: 3, f: 0 }, { b: 485, s: 1, f: 3 }, { b: 486, s: 0, f: 3 }, { b: 487, s: 2, f: 0 }, { b: 488, s: 3, f: 0 }, { b: 489, s: 4, f: 0 }, { b: 490, s: 3, f: 0 },
      { b: 491, s: 5, f: 0 }, { b: 492, s: 1, f: 3 }, { b: 492, s: 4, f: 1 }, { b: 492, s: 5, f: 3 }, { b: 493, s: 3, f: 0 }, { b: 494, s: 4, f: 1 }, { b: 494, s: 5, f: 3 }, { b: 495, s: 3, f: 0 },
      { b: 495, s: 4, f: 1 }, { b: 495, s: 5, f: 3 }, { b: 496, s: 3, f: 0 }, { b: 497, s: 4, f: 1 }, { b: 497, s: 5, f: 3 }, { b: 498, s: 1, f: 0 }, { b: 498, s: 4, f: 5 }, { b: 498, s: 5, f: 5 },
      { b: 499, s: 3, f: 5 }, { b: 500, s: 4, f: 5 }, { b: 500, s: 5, f: 5 }, { b: 501, s: 4, f: 5 }, { b: 501, s: 5, f: 5 }, { b: 502, s: 3, f: 5 }, { b: 503, s: 4, f: 5 }, { b: 504, s: 1, f: 3 },
      { b: 504, s: 3, f: 0 }, { b: 504, s: 4, f: 1 }, { b: 504, s: 5, f: 3 }, { b: 505, s: 3, f: 0 }, { b: 506, s: 4, f: 1 }, { b: 506, s: 5, f: 3 }, { b: 507, s: 3, f: 0 }, { b: 507, s: 4, f: 1 },
      { b: 507, s: 5, f: 3 }, { b: 508, s: 3, f: 0 }, { b: 509, s: 4, f: 1 }, { b: 509, s: 5, f: 3 }, { b: 510, s: 1, f: 0 }, { b: 510, s: 4, f: 5 }, { b: 510, s: 5, f: 5 }, { b: 511, s: 3, f: 5 },
      { b: 512, s: 4, f: 5 }, { b: 512, s: 5, f: 5 }, { b: 513, s: 4, f: 5 }, { b: 513, s: 5, f: 5 }, { b: 514, s: 3, f: 5 }, { b: 515, s: 4, f: 8 }, { b: 516, s: 2, f: 3 }, { b: 516, s: 5, f: 5 },
      { b: 517, s: 3, f: 5 }, { b: 518, s: 5, f: 5 }, { b: 519, s: 5, f: 5 }, { b: 520, s: 5, f: 3 }, { b: 521, s: 5, f: 5 }, { b: 522, s: 0, f: 3 }, { b: 523, s: 3, f: 4 }, { b: 524, s: 5, f: 3 },
      { b: 525, s: 4, f: 0 }, { b: 525, s: 5, f: 3 }, { b: 526, s: 5, f: 1 }, { b: 527, s: 5, f: 3 }, { b: 528, s: 1, f: 3 }, { b: 529, s: 2, f: 2 }, { b: 530, s: 3, f: 0 }, { b: 531, s: 4, f: 1 },
      { b: 531, s: 5, f: 3 }, { b: 532, s: 0, f: 0 }, { b: 533, s: 0, f: 1 }, { b: 534, s: 0, f: 3 }, { b: 535, s: 2, f: 0 }, { b: 536, s: 3, f: 0 }, { b: 537, s: 3, f: 0 }, { b: 537, s: 4, f: 0 },
      { b: 538, s: 3, f: 0 }, { b: 539, s: 5, f: 0 }, { b: 540, s: 1, f: 3 }, { b: 540, s: 3, f: 0 }, { b: 540, s: 4, f: 1 }, { b: 540, s: 5, f: 3 }, { b: 541, s: 4, f: 1 }, { b: 541, s: 5, f: 3 },
      { b: 542, s: 4, f: 1 }, { b: 542, s: 5, f: 3 }, { b: 544, s: 3, f: 0 }, { b: 545, s: 4, f: 1 }, { b: 545, s: 5, f: 3 }, { b: 546, s: 2, f: 3 }, { b: 546, s: 5, f: 5 }, { b: 547, s: 3, f: 5 },
      { b: 548, s: 5, f: 5 }, { b: 549, s: 5, f: 7 }, { b: 550, s: 3, f: 7 }, { b: 551, s: 5, f: 5 }, { b: 552, s: 1, f: 0 }, { b: 552, s: 3, f: 5 }, { b: 552, s: 4, f: 5 }, { b: 552, s: 5, f: 8 },
      { b: 553, s: 4, f: 5 }, { b: 553, s: 5, f: 8 }, { b: 554, s: 4, f: 5 }, { b: 554, s: 5, f: 8 }, { b: 556, s: 3, f: 5 }, { b: 557, s: 4, f: 5 }, { b: 557, s: 5, f: 8 }, { b: 558, s: 1, f: 8 },
      { b: 558, s: 3, f: 10 }, { b: 558, s: 4, f: 10 }, { b: 558, s: 5, f: 8 }, { b: 559, s: 4, f: 10 }, { b: 559, s: 5, f: 8 }, { b: 560, s: 4, f: 10 }, { b: 560, s: 5, f: 8 }, { b: 560.25, s: 5, f: 10 },
      { b: 562, s: 3, f: 10 }, { b: 563, s: 4, f: 10 }, { b: 563, s: 5, f: 8 }, { b: 564, s: 1, f: 10 }, { b: 564, s: 3, f: 12 }, { b: 564, s: 4, f: 12 }, { b: 564, s: 5, f: 10 }, { b: 565, s: 4, f: 12 },
      { b: 565, s: 5, f: 10 }, { b: 566, s: 4, f: 12 }, { b: 566, s: 5, f: 10 }, { b: 568, s: 3, f: 12 }, { b: 569, s: 4, f: 12 }, { b: 569, s: 5, f: 10 }, { b: 570, s: 0, f: 0 }, { b: 570, s: 5, f: 12 },
      { b: 571, s: 3, f: 9 }, { b: 572, s: 4, f: 9 }, { b: 572, s: 5, f: 12 }, { b: 573, s: 4, f: 9 }, { b: 573, s: 5, f: 12 }, { b: 574, s: 3, f: 9 }, { b: 575, s: 4, f: 9 }, { b: 575, s: 5, f: 10 },
      { b: 576, s: 1, f: 0 }, { b: 576, s: 5, f: 10 }, { b: 577, s: 3, f: 9 }, { b: 578, s: 4, f: 10 }, { b: 578, s: 5, f: 8 }, { b: 580, s: 3, f: 9 }, { b: 581, s: 4, f: 10 }, { b: 582, s: 1, f: 0 },
      { b: 585, s: 4, f: 1 }, { b: 585, s: 5, f: 0 }, { b: 587, s: 5, f: 3 }, { b: 588, s: 2, f: 3 }, { b: 588, s: 5, f: 5 }, { b: 589, s: 3, f: 5 }, { b: 590, s: 5, f: 5 }, { b: 592, s: 3, f: 5 },
      { b: 593, s: 5, f: 5 }, { b: 594, s: 2, f: 3 }, { b: 595, s: 3, f: 5 }, { b: 596, s: 5, f: 5 }, { b: 597, s: 5, f: 5 }, { b: 598, s: 3, f: 5 }, { b: 599, s: 5, f: 3 }, { b: 600, s: 1, f: 0 },
      { b: 600, s: 5, f: 0 }, { b: 601, s: 3, f: 2 }, { b: 602, s: 4, f: 1 }, { b: 602, s: 5, f: 0 }, { b: 604, s: 3, f: 2 }, { b: 605, s: 4, f: 1 }, { b: 606, s: 1, f: 0 }, { b: 607, s: 3, f: 2 },
      { b: 608, s: 4, f: 1 }, { b: 609, s: 4, f: 1 }, { b: 609, s: 5, f: 0 }, { b: 610, s: 3, f: 2 }, { b: 611, s: 5, f: 3 }, { b: 612, s: 2, f: 3 }, { b: 612, s: 5, f: 5 }, { b: 613, s: 3, f: 5 },
      { b: 614, s: 5, f: 5 }, { b: 616, s: 3, f: 5 }, { b: 617, s: 5, f: 5 }, { b: 618, s: 2, f: 3 }, { b: 619, s: 3, f: 5 }, { b: 620, s: 5, f: 5 }, { b: 621, s: 5, f: 5 }, { b: 622, s: 3, f: 5 },
      { b: 623, s: 5, f: 3 }, { b: 624, s: 1, f: 3 }, { b: 624, s: 5, f: 0 }, { b: 625, s: 3, f: 0 }, { b: 626, s: 5, f: 0 }, { b: 628, s: 5, f: 1 }, { b: 629, s: 5, f: 0 }, { b: 630, s: 0, f: 3 },
      { b: 630, s: 4, f: 3 }, { b: 631, s: 2, f: 0 }, { b: 632, s: 3, f: 0 }, { b: 633, s: 0, f: 0 }, { b: 633, s: 1, f: 2 }, { b: 633, s: 2, f: 2 }, { b: 633, s: 3, f: 0 }, { b: 635, s: 2, f: 2 },
      { b: 635, s: 3, f: 0 }, { b: 636, s: 0, f: 1 }, { b: 636, s: 2, f: 3 }, { b: 636, s: 3, f: 2 }, { b: 638, s: 2, f: 3 }, { b: 638, s: 3, f: 2 }, { b: 639, s: 0, f: 1 }, { b: 640, s: 1, f: 3 },
      { b: 641, s: 2, f: 3 }, { b: 642, s: 0, f: 1 }, { b: 644, s: 2, f: 3 }, { b: 645, s: 0, f: 1 }, { b: 645, s: 3, f: 2 }, { b: 646, s: 1, f: 3 }, { b: 647, s: 3, f: 0 }, { b: 648, s: 1, f: 0 },
      { b: 648, s: 2, f: 2 }, { b: 650, s: 2, f: 2 }, { b: 651, s: 1, f: 0 }, { b: 652, s: 2, f: 2 }, { b: 653, s: 3, f: 2 }, { b: 654, s: 1, f: 0 }, { b: 656, s: 3, f: 2 }, { b: 657, s: 1, f: 0 },
      { b: 657, s: 2, f: 2 }, { b: 659, s: 3, f: 0 }, { b: 660, s: 0, f: 1 }, { b: 660, s: 2, f: 3 }, { b: 660, s: 3, f: 2 }, { b: 662, s: 2, f: 3 }, { b: 662, s: 3, f: 2 }, { b: 663, s: 0, f: 1 },
      { b: 664, s: 1, f: 3 }, { b: 665, s: 2, f: 3 }, { b: 666, s: 0, f: 1 }, { b: 668, s: 2, f: 3 }, { b: 669, s: 0, f: 1 }, { b: 669, s: 3, f: 2 }, { b: 670, s: 1, f: 3 }, { b: 671, s: 3, f: 0 },
      { b: 672, s: 1, f: 3 }, { b: 672, s: 2, f: 2 }, { b: 674, s: 2, f: 2 }, { b: 675, s: 1, f: 3 }, { b: 676, s: 2, f: 3 }, { b: 677, s: 2, f: 2 }, { b: 678, s: 0, f: 3 }, { b: 678, s: 1, f: 2 },
      { b: 678, s: 2, f: 0 }, { b: 681, s: 0, f: 3 }, { b: 682, s: 1, f: 2 }, { b: 683, s: 2, f: 0 }, { b: 684, s: 1, f: 3 }, { b: 684, s: 2, f: 2 }, { b: 684, s: 3, f: 0 }, { b: 684, s: 4, f: 1 },
    ],
    text: `Intro:
C  Am7  C  Am7

Verse 1:
C                 Am
I heard there was a secret chord
C                          Am
That David played and it pleased the Lord
F            C
But you don't really care
G              C
for music, do you?
C              F     G
It goes like this, the fourth, the fifth
Am               F
The minor fall, the major lift
G           E             Am
The baffled king composing Hallelujah

Turnaround:
C/G   F   Am   F   G

Chorus:
F          Am
Hallelujah, Hallelujah
F          C        G    C
Hallelujah, Hallelujah

Verse 2:
C                  Am
Your faith was strong but you needed proof
C                      Am
You saw her bathing on the roof
F          C
Her beauty and the
G              C
moonlight overthrew ya
C            F        G
She tied you to a kitchen chair
Am                 F
She broke your throne, she cut your hair
G          E              Am
And from your lips she drew the Hallelujah

Turnaround:
C/G   F   Am   F   G

Chorus:
F          Am
Hallelujah, Hallelujah
F          C        G    C
Hallelujah, Hallelujah

Outro:
F   Am   F   C   G   C`,
  },

  {
    id: "dancing-in-the-dark",
    title: "Dancing in the Dark — Bruce Springsteen",
    source: "https://tabs.ultimate-guitar.com/tab/bruce-springsteen/dancing-in-the-dark-chords-1087212",
    bpm: 148,
    capo: 4,           // Capo 4th fret (sounds in E); matching is transposed +4
    // Strum pattern (one token per eighth note in a 4/4 bar): ↓ ↓↑ ↑↓↑
    // D = downstroke, U = upstroke, - = no strum. Source: JustinGuitar lesson.
    strum: ["D", "-", "D", "U", "-", "U", "D", "U"],
    beatsPerBar: 4,
    chordBars: 1,
    text: `Intro:
G  Em  G  Em   (2x)

Verse 1:
G              Em      G
I get up in the evening
            Em       G
and I ain't got nothing to say
            Em
I come home in the morning
G        Em        C
I go to bed feeling the same way
              Am    C
I ain't nothing but tired
          Am             G
Man, I'm just tired and bored with myself
     Em   G        Em            D
Hey there baby, I could use just a little help

Chorus:
              C
You can't start a fire
          Am   C
This gun's for hire
                Am          G
Even if we're just dancing in the dark

Verse 2:
G                 Em      G
Message keeps getting clearer
              Em                 G
Radio's on and I'm moving 'round the place
              Em
I check my look in the mirror
G        Em                      C
I wanna change my clothes, my hair, my face
              Am      C
Man, I ain't getting nowhere
        Am               G
I'm just living in a dump like this
                       Em    G
There's something happening somewhere
            Em            D
Baby, I just know that there is

Chorus:
              D
You can't start a fire
                          C
You can't start a fire without a spark
          Am   C
This gun's for hire
                Am          G
Even if we're just dancing in the dark

Bridge:
Em                    G
You sit around getting older
C                D            Em
There's a joke here somewhere and it's on me
                          G
I'll shake this world off my shoulders
C                D
Come on baby, the laugh's on me

Verse 3:
G                 Em      G
Stay on the streets of this town
        Em                  G
and they'll be carving you up alright
              Em        G
They say you gotta stay hungry
Em                       C
Hey baby, I'm just about starving tonight
              Am      C
I'm dying for some action
                          Am               G
I'm sick of sitting 'round here trying to write this book
       Em      G
I need a love reaction
              Em            D
Come on now baby, gimme just a little look

Chorus:
    D                                          C
You can't start a fire sitting 'round crying over a broken heart
          Am   C
This gun's for hire
              Am          D
Even if we're just dancing in the dark
                                                  C
You can't start a fire worrying about your little world falling apart
          Am   C
This gun's for hire
              Am      G   C
Even if we're just dancing in the dark

Outro:
              Am          G   C
Even if we're just dancing in the dark   (2x)
G
Hey baby`,
  },

  {
    id: "what-a-good-boy",
    title: "What a Good Boy — Barenaked Ladies",
    source: "https://tabs.ultimate-guitar.com/tab/barenaked-ladies/what-a-good-boy-chords-1234567",
    bpm: 97,
    capo: 0,           // chords as played without capo (G D Cadd9 Em G/F# C)
    // Strum pattern from the tab's "MAIN PATTERN" (all downstrokes): 1 2 & 4 &
    strum: ["D", "-", "D", "D", "-", "-", "D", "D"],
    beatsPerBar: 4,
    chordBars: 1,
    text: `Verse 1:
G              D            Cadd9
When I was born, they looked at me and said
Cadd9
what a good boy, what a smart boy, what a strong boy
G              D            Cadd9
And when you were born, they looked at you and said
Cadd9
what a good girl, what a smart girl, what a pretty girl

Pre-chorus:
G              D
We've got these chains that hang around our necks
Cadd9
people want to strangle us with them before we take our first breath
G              D            Cadd9
Afraid of change, afraid of staying the same
Cadd9
when temptation calls, we just look away

Chorus:
G                    D
This name is the hairshirt I wear
Cadd9                              D
and this hairshirt is woven from your brown hair
G                    D
This song is the cross that I bear
Cadd9
bear it with me, bear with me, bear with me
D
be with me tonight
G    G/F#   Em   C
I know that it isn't right
G    G/F#   Em   C
but be with me tonight

Verse 2:
G              D            Cadd9
I go to school, I write exams
Cadd9
if I pass, if I fail, if I drop out, does anyone give a damn
G              D            Cadd9
And if they do, they'll soon forget
Cadd9
'cause it won't take much for me to show my life ain't over yet
G                    Em
I wake up scared, I wake up strange
Cadd9
I wake up wondering if anything in my life is ever going to change
G                    Em
I wake up scared, I wake up strange
Cadd9
and everything around me stays the same`,
  },

  {
    id: "blackbird",
    title: "Blackbird — The Beatles (local OCR)",
    source: "https://tabs.ultimate-guitar.com/tab/the-beatles/blackbird-official-2093927",
    bpm: 93,
    capo: 0,
    barEighths: 8,
    // Best-effort from PDF OCR (mixed 3/4 & 4/4 meter) — has note errors. Replace
    // with the Guitar Pro .gpx for note-perfect accuracy (tools/parse-gp.mjs).
    // {b: eighth-note position, s: string 0=lowE..5=high-e, f: fret}
    notes: [
      { b: 0, s: 0, f: 3 }, { b: 0, s: 4, f: 0 }, { b: 1.59, s: 3, f: 0 }, { b: 3.21, s: 1, f: 0 }, { b: 3.21, s: 4, f: 1 }, { b: 4.82, s: 3, f: 0 }, { b: 6.41, s: 1, f: 2 }, { b: 6.41, s: 4, f: 3 },
      { b: 8, s: 1, f: 2 }, { b: 8, s: 1, f: 1 }, { b: 8, s: 3, f: 0 }, { b: 8, s: 4, f: 3 }, { b: 8, s: 4, f: 1 }, { b: 8, s: 4, f: 2 }, { b: 9.15, s: 3, f: 0 }, { b: 9.95, s: 4, f: 12 },
      { b: 10.75, s: 1, f: 10 }, { b: 11.56, s: 4, f: 12 }, { b: 12.36, s: 3, f: 0 }, { b: 13.59, s: 1, f: 10 }, { b: 13.59, s: 4, f: 1 }, { b: 13.59, s: 4, f: 2 }, { b: 14.76, s: 3, f: 0 }, { b: 16.4, s: 1, f: 10 },
      { b: 17.2, s: 4, f: 12 }, { b: 18, s: 0, f: 3 }, { b: 18, s: 3, f: 0 }, { b: 18, s: 4, f: 0 }, { b: 19.58, s: 3, f: 0 }, { b: 20.93, s: 1, f: 0 }, { b: 20.93, s: 4, f: 1 }, { b: 23.22, s: 3, f: 0 },
      { b: 27, s: 1, f: 2 }, { b: 27, s: 1, f: 1 }, { b: 27, s: 1, f: 0 }, { b: 27, s: 3, f: 0 }, { b: 27, s: 4, f: 3 }, { b: 27, s: 4, f: 1 }, { b: 27, s: 4, f: 2 }, { b: 28.02, s: 3, f: 0 },
      { b: 28.75, s: 4, f: 12 }, { b: 29.47, s: 1, f: 10 }, { b: 30.21, s: 4, f: 12 }, { b: 30.91, s: 3, f: 0 }, { b: 32.04, s: 1, f: 10 }, { b: 32.04, s: 4, f: 1 }, { b: 32.04, s: 4, f: 2 }, { b: 33.09, s: 3, f: 0 },
      { b: 33.83, s: 4, f: 12 }, { b: 34.57, s: 1, f: 10 }, { b: 35.28, s: 4, f: 12 }, { b: 36, s: 1, f: 3 }, { b: 36, s: 3, f: 0 }, { b: 36, s: 4, f: 5 }, { b: 37.35, s: 3, f: 0 }, { b: 38.51, s: 1, f: 4 },
      { b: 38.51, s: 5, f: 3 }, { b: 40.16, s: 3, f: 1 }, { b: 41.28, s: 1, f: 13 }, { b: 41.28, s: 4, f: 7 }, { b: 42.24, s: 3, f: 0 }, { b: 43.99, s: 1, f: 6 }, { b: 43.99, s: 5, f: 5 }, { b: 45, s: 3, f: 0 },
      { b: 45, s: 4, f: 8 }, { b: 46.09, s: 3, f: 0 }, { b: 46.8, s: 4, f: 8 }, { b: 47.51, s: 1, f: 7 }, { b: 48.23, s: 4, f: 8 }, { b: 48.98, s: 3, f: 0 }, { b: 50.05, s: 1, f: 6 }, { b: 50.05, s: 4, f: 8 },
      { b: 51.11, s: 3, f: 0 }, { b: 51.86, s: 4, f: 8 }, { b: 53.28, s: 4, f: 8 }, { b: 54, s: 1, f: 5 }, { b: 54, s: 3, f: 0 }, { b: 54.76, s: 3, f: 0 }, { b: 55.55, s: 1, f: 4 }, { b: 55.55, s: 5, f: 3 },
      { b: 56.32, s: 3, f: 0 }, { b: 57.12, s: 1, f: 3 }, { b: 57.12, s: 4, f: 5 }, { b: 57.89, s: 3, f: 0 }, { b: 58.44, s: 4, f: 13 }, { b: 58.93, s: 1, f: 3 }, { b: 59.48, s: 4, f: 13 }, { b: 60, s: 1, f: 3 },
      { b: 60, s: 3, f: 0 }, { b: 60, s: 4, f: 4 }, { b: 60.82, s: 3, f: 0 }, { b: 61.39, s: 4, f: 4 }, { b: 61.95, s: 1, f: 3 }, { b: 62.5, s: 4, f: 4 }, { b: 63.07, s: 3, f: 0 }, { b: 63.88, s: 1, f: 3 },
      { b: 63.88, s: 4, f: 3 }, { b: 65.22, s: 3, f: 0 }, { b: 66.33, s: 4, f: 3 }, { b: 66.89, s: 1, f: 2 }, { b: 67.44, s: 4, f: 3 }, { b: 68, s: 1, f: 0 }, { b: 68, s: 3, f: 0 }, { b: 68, s: 4, f: 2 },
      { b: 69.34, s: 4, f: 2 }, { b: 69.88, s: 1, f: 0 }, { b: 70.95, s: 4, f: 7 }, { b: 71.49, s: 3, f: 0 }, { b: 72.29, s: 2, f: 0 }, { b: 72.29, s: 4, f: 1 }, { b: 73.54, s: 3, f: 0 }, { b: 74.08, s: 4, f: 1 },
      { b: 74.69, s: 2, f: 0 }, { b: 75.43, s: 4, f: 1 }, { b: 76, s: 3, f: 0 }, { b: 76, s: 3, f: 2 }, { b: 76.91, s: 0, f: 3 }, { b: 76.91, s: 4, f: 0 }, { b: 77.76, s: 3, f: 0 }, { b: 78.32, s: 4, f: 11 },
      { b: 78.88, s: 0, f: 3 }, { b: 79.44, s: 4, f: 11 }, { b: 80, s: 3, f: 0 }, { b: 80, s: 5, f: 1 }, { b: 81.37, s: 1, f: 3 }, { b: 81.37, s: 4, f: 5 }, { b: 82.37, s: 3, f: 0 }, { b: 83.35, s: 1, f: 2 },
      { b: 83.35, s: 4, f: 3 }, { b: 84.34, s: 3, f: 0 }, { b: 85.35, s: 1, f: 0 }, { b: 85.35, s: 4, f: 2 }, { b: 86.35, s: 3, f: 0 }, { b: 87.02, s: 4, f: 2 }, { b: 87.67, s: 1, f: 0 }, { b: 88.35, s: 4, f: 2 },
      { b: 89, s: 2, f: 0 }, { b: 89, s: 3, f: 0 }, { b: 89, s: 4, f: 1 }, { b: 89.99, s: 3, f: 0 }, { b: 90.63, s: 4, f: 1 }, { b: 91.3, s: 2, f: 0 }, { b: 91.94, s: 4, f: 1 }, { b: 92.62, s: 3, f: 0 },
      { b: 93.59, s: 0, f: 3 }, { b: 93.59, s: 4, f: 0 }, { b: 94.58, s: 3, f: 0 }, { b: 95.24, s: 4, f: 0 }, { b: 95.88, s: 0, f: 3 }, { b: 96.55, s: 4, f: 0 }, { b: 97.22, s: 3, f: 0 }, { b: 98, s: 0, f: 3 },
      { b: 98, s: 4, f: 0 }, { b: 99.44, s: 3, f: 0 }, { b: 100.69, s: 1, f: 0 }, { b: 100.69, s: 4, f: 1 }, { b: 102.79, s: 3, f: 0 }, { b: 104.89, s: 1, f: 2 }, { b: 104.89, s: 4, f: 3 }, { b: 106, s: 1, f: 8 },
      { b: 106, s: 1, f: 2 }, { b: 106, s: 3, f: 0 }, { b: 106, s: 3, f: 4 }, { b: 106, s: 4, f: 1 }, { b: 106, s: 4, f: 3 }, { b: 107.24, s: 1, f: 1 }, { b: 107.24, s: 4, f: 1 }, { b: 107.24, s: 4, f: 2 },
      { b: 108.13, s: 3, f: 0 }, { b: 109.37, s: 1, f: 10 }, { b: 110.63, s: 3, f: 0 }, { b: 111.62, s: 1, f: 1 }, { b: 111.62, s: 1, f: 0 }, { b: 111.62, s: 4, f: 1 }, { b: 111.62, s: 4, f: 7 }, { b: 112.51, s: 3, f: 0 },
      { b: 113.12, s: 4, f: 12 }, { b: 113.74, s: 1, f: 11 }, { b: 114.37, s: 4, f: 12 }, { b: 115, s: 1, f: 3 }, { b: 115, s: 3, f: 0 }, { b: 115, s: 4, f: 5 }, { b: 116.37, s: 3, f: 0 }, { b: 117.72, s: 1, f: 4 },
      { b: 117.72, s: 5, f: 3 }, { b: 119.29, s: 3, f: 0 }, { b: 120.27, s: 1, f: 5 }, { b: 121.26, s: 3, f: 0 }, { b: 122.97, s: 1, f: 13 }, { b: 122.97, s: 5, f: 5 }, { b: 124, s: 3, f: 0 }, { b: 124, s: 4, f: 8 },
      { b: 125.08, s: 3, f: 0 }, { b: 125.79, s: 4, f: 8 }, { b: 129.04, s: 1, f: 6 }, { b: 129.04, s: 4, f: 8 }, { b: 130.12, s: 3, f: 0 }, { b: 130.83, s: 4, f: 8 }, { b: 131.58, s: 1, f: 6 }, { b: 132.28, s: 4, f: 8 },
      { b: 133, s: 3, f: 0 }, { b: 133, s: 5, f: 1 }, { b: 133.37, s: 2, f: 3 }, { b: 134.33, s: 1, f: 8 }, { b: 134.33, s: 4, f: 1 }, { b: 134.33, s: 4, f: 0 }, { b: 134.97, s: 3, f: 10 }, { b: 135.65, s: 4, f: 8 },
      { b: 136.31, s: 3, f: 0 }, { b: 136.99, s: 1, f: 5 }, { b: 136.99, s: 4, f: 6 }, { b: 137.65, s: 3, f: 0 }, { b: 138.31, s: 1, f: 3 }, { b: 138.31, s: 4, f: 5 }, { b: 139, s: 1, f: 1 }, { b: 139, s: 3, f: 0 },
      { b: 139, s: 4, f: 3 }, { b: 139.73, s: 3, f: 0 }, { b: 140.19, s: 4, f: 3 }, { b: 140.66, s: 1, f: 1 }, { b: 141.17, s: 4, f: 3 }, { b: 141.63, s: 3, f: 0 }, { b: 142.37, s: 1, f: 3 }, { b: 142.37, s: 4, f: 5 },
      { b: 143.07, s: 3, f: 10 }, { b: 143.56, s: 4, f: 5 }, { b: 144.02, s: 1, f: 3 }, { b: 144.51, s: 4, f: 5 }, { b: 145, s: 3, f: 0 }, { b: 145, s: 5, f: 13 }, { b: 145.75, s: 1, f: 8 }, { b: 145.75, s: 4, f: 1 },
      { b: 146.46, s: 3, f: 0 }, { b: 147.24, s: 4, f: 8 }, { b: 147.98, s: 3, f: 10 }, { b: 148.75, s: 1, f: 5 }, { b: 149.49, s: 3, f: 0 }, { b: 150.25, s: 1, f: 3 }, { b: 150.25, s: 4, f: 5 }, { b: 151, s: 3, f: 0 },
      { b: 151.72, s: 1, f: 1 }, { b: 151.72, s: 4, f: 3 }, { b: 152.51, s: 3, f: 10 }, { b: 153.06, s: 4, f: 3 }, { b: 153.57, s: 1, f: 1 }, { b: 154.1, s: 4, f: 3 }, { b: 154.65, s: 3, f: 0 }, { b: 155.43, s: 1, f: 0 },
      { b: 155.43, s: 4, f: 2 }, { b: 156.22, s: 3, f: 0 }, { b: 156.76, s: 4, f: 2 }, { b: 157.3, s: 1, f: 0 }, { b: 158.09, s: 4, f: 2 }, { b: 159, s: 3, f: 0 }, { b: 159, s: 3, f: 2 }, { b: 160.16, s: 2, f: 11 },
      { b: 160.16, s: 4, f: 1 }, { b: 161.19, s: 3, f: 0 }, { b: 161.83, s: 4, f: 1 }, { b: 162.54, s: 2, f: 0 }, { b: 163.5, s: 4, f: 1 }, { b: 165, s: 3, f: 0 }, { b: 165, s: 3, f: 3 }, { b: 165.93, s: 0, f: 3 },
      { b: 165.93, s: 4, f: 0 }, { b: 166.92, s: 3, f: 0 }, { b: 167.9, s: 1, f: 11 }, { b: 167.9, s: 4, f: 1 }, { b: 168.91, s: 3, f: 0 }, { b: 169.9, s: 1, f: 2 }, { b: 169.9, s: 4, f: 4 }, { b: 171, s: 1, f: 2 },
      { b: 171, s: 3, f: 0 }, { b: 171, s: 3, f: 4 }, { b: 171, s: 4, f: 3 }, { b: 171, s: 4, f: 13 }, { b: 172.01, s: 1, f: 1 }, { b: 172.01, s: 4, f: 1 }, { b: 172.01, s: 4, f: 2 }, { b: 172.92, s: 3, f: 0 },
      { b: 173.56, s: 4, f: 12 }, { b: 174.2, s: 1, f: 10 }, { b: 174.85, s: 4, f: 12 }, { b: 175.49, s: 3, f: 0 }, { b: 176.51, s: 1, f: 1 }, { b: 176.51, s: 1, f: 0 }, { b: 176.51, s: 4, f: 1 }, { b: 176.51, s: 4, f: 2 },
      { b: 177.42, s: 3, f: 11 }, { b: 177.89, s: 4, f: 1 }, { b: 178.71, s: 1, f: 10 }, { b: 179.36, s: 4, f: 12 }, { b: 180, s: 1, f: 3 }, { b: 180, s: 3, f: 0 }, { b: 180, s: 4, f: 5 }, { b: 181.01, s: 3, f: 0 },
      { b: 181.99, s: 1, f: 4 }, { b: 181.99, s: 5, f: 3 }, { b: 182.99, s: 3, f: 0 }, { b: 184.01, s: 1, f: 5 }, { b: 185, s: 3, f: 0 }, { b: 186, s: 1, f: 13 }, { b: 186, s: 5, f: 5 }, { b: 187, s: 3, f: 0 },
      { b: 187, s: 5, f: 8 }, { b: 187.54, s: 4, f: 3 }, { b: 188.23, s: 3, f: 10 }, { b: 188.72, s: 4, f: 8 }, { b: 189.67, s: 4, f: 3 }, { b: 190.13, s: 3, f: 0 }, { b: 190.86, s: 1, f: 11 }, { b: 190.86, s: 4, f: 8 },
      { b: 191.56, s: 3, f: 0 }, { b: 192.04, s: 4, f: 8 }, { b: 192.51, s: 1, f: 6 }, { b: 192.99, s: 4, f: 8 }, { b: 193.46, s: 3, f: 0 }, { b: 194, s: 1, f: 5 }, { b: 194, s: 5, f: 3 }, { b: 194.71, s: 3, f: 0 },
      { b: 195.42, s: 1, f: 4 }, { b: 195.42, s: 5, f: 3 }, { b: 196.1, s: 3, f: 0 }, { b: 196.82, s: 1, f: 3 }, { b: 196.82, s: 4, f: 5 }, { b: 197.53, s: 3, f: 0 }, { b: 197.99, s: 4, f: 5 }, { b: 198.47, s: 1, f: 3 },
      { b: 198.92, s: 4, f: 5 }, { b: 199.4, s: 3, f: 0 }, { b: 200, s: 1, f: 3 }, { b: 200, s: 4, f: 4 }, { b: 200.76, s: 3, f: 0 }, { b: 201.27, s: 4, f: 4 }, { b: 201.77, s: 1, f: 3 }, { b: 202.28, s: 4, f: 4 },
      { b: 202.79, s: 3, f: 0 }, { b: 203.56, s: 1, f: 2 }, { b: 203.56, s: 4, f: 3 }, { b: 204.3, s: 3, f: 0 }, { b: 204.82, s: 4, f: 3 }, { b: 205.31, s: 1, f: 2 }, { b: 205.83, s: 4, f: 3 }, { b: 206.32, s: 3, f: 0 },
      { b: 207, s: 1, f: 0 }, { b: 207, s: 4, f: 2 }, { b: 207.85, s: 3, f: 0 }, { b: 208.39, s: 4, f: 2 }, { b: 208.97, s: 1, f: 11 }, { b: 209.51, s: 4, f: 2 }, { b: 210.09, s: 3, f: 0 }, { b: 210.9, s: 2, f: 0 },
      { b: 210.9, s: 4, f: 1 }, { b: 211.75, s: 3, f: 0 }, { b: 212.3, s: 4, f: 1 }, { b: 212.87, s: 2, f: 0 }, { b: 213.42, s: 4, f: 1 }, { b: 214, s: 0, f: 3 }, { b: 214, s: 3, f: 0 }, { b: 214, s: 4, f: 0 },
      { b: 215.34, s: 3, f: 0 }, { b: 216.27, s: 4, f: 0 }, { b: 217.19, s: 0, f: 3 }, { b: 218.12, s: 4, f: 0 }, { b: 219, s: 3, f: 0 }, { b: 219, s: 3, f: 4 }, { b: 219.96, s: 1, f: 8 }, { b: 219.96, s: 4, f: 1 },
      { b: 220.75, s: 3, f: 0 }, { b: 221.64, s: 1, f: 7 }, { b: 221.64, s: 4, f: 8 }, { b: 222.52, s: 3, f: 0 }, { b: 224.26, s: 3, f: 0 }, { b: 225.13, s: 1, f: 3 }, { b: 225.13, s: 4, f: 5 }, { b: 226, s: 1, f: 1 },
      { b: 226, s: 3, f: 0 }, { b: 226, s: 4, f: 3 }, { b: 226.95, s: 3, f: 0 }, { b: 227.6, s: 4, f: 3 }, { b: 228.21, s: 1, f: 1 }, { b: 228.89, s: 4, f: 2 }, { b: 229.54, s: 3, f: 0 }, { b: 230.48, s: 1, f: 3 },
      { b: 230.48, s: 4, f: 5 }, { b: 231.44, s: 3, f: 0 }, { b: 232.09, s: 4, f: 5 }, { b: 232.7, s: 1, f: 3 }, { b: 233.37, s: 4, f: 5 }, { b: 234, s: 1, f: 8 }, { b: 234, s: 3, f: 0 }, { b: 234, s: 4, f: 1 },
      { b: 234, s: 4, f: 0 }, { b: 234.99, s: 3, f: 0 }, { b: 235.97, s: 4, f: 8 }, { b: 236.99, s: 3, f: 0 }, { b: 238, s: 1, f: 5 }, { b: 238, s: 4, f: 13 }, { b: 238.99, s: 3, f: 0 }, { b: 240, s: 1, f: 3 },
      { b: 240, s: 4, f: 5 }, { b: 241, s: 1, f: 1 }, { b: 241, s: 1, f: 0 }, { b: 241, s: 3, f: 0 }, { b: 241, s: 4, f: 1 }, { b: 241, s: 4, f: 2 }, { b: 242.02, s: 3, f: 0 }, { b: 242.02, s: 4, f: 11 },
      { b: 242.02, s: 4, f: 2 }, { b: 243.03, s: 3, f: 1 }, { b: 243.03, s: 4, f: 1 }, { b: 243.03, s: 4, f: 2 }, { b: 243.72, s: 1, f: 10 }, { b: 244.8, s: 1, f: 1 }, { b: 244.8, s: 1, f: 3 }, { b: 244.8, s: 3, f: 0 },
      { b: 245.46, s: 4, f: 12 }, { b: 246.44, s: 1, f: 10 }, { b: 246.44, s: 4, f: 1 }, { b: 247.7, s: 1, f: 1 }, { b: 247.7, s: 1, f: 0 }, { b: 247.7, s: 3, f: 0 }, { b: 247.7, s: 4, f: 11 }, { b: 247.7, s: 4, f: 2 },
      { b: 248.85, s: 3, f: 10 }, { b: 248.85, s: 4, f: 1 }, { b: 248.85, s: 4, f: 2 }, { b: 250.08, s: 3, f: 0 }, { b: 250.08, s: 4, f: 1 }, { b: 250.08, s: 4, f: 2 }, { b: 251, s: 1, f: 1 }, { b: 251, s: 3, f: 3 },
      { b: 251, s: 4, f: 1 }, { b: 251, s: 4, f: 2 }, { b: 252.08, s: 1, f: 1 }, { b: 252.08, s: 1, f: 0 }, { b: 252.08, s: 1, f: 3 }, { b: 252.08, s: 3, f: 10 }, { b: 252.08, s: 4, f: 1 }, { b: 252.08, s: 4, f: 2 },
      { b: 253, s: 1, f: 1 }, { b: 253, s: 1, f: 0 }, { b: 253, s: 3, f: 1 }, { b: 253, s: 4, f: 1 }, { b: 253, s: 4, f: 2 }, { b: 253.95, s: 1, f: 1 }, { b: 253.95, s: 3, f: 1 }, { b: 253.95, s: 3, f: 0 },
      { b: 253.95, s: 4, f: 1 }, { b: 253.95, s: 4, f: 2 }, { b: 254.95, s: 1, f: 1 }, { b: 254.95, s: 1, f: 0 }, { b: 254.95, s: 3, f: 0 }, { b: 254.95, s: 4, f: 1 }, { b: 254.95, s: 4, f: 2 }, { b: 255.99, s: 1, f: 1 },
      { b: 255.99, s: 1, f: 0 }, { b: 255.99, s: 4, f: 1 }, { b: 255.99, s: 4, f: 2 }, { b: 256.89, s: 1, f: 10 }, { b: 256.89, s: 4, f: 1 }, { b: 256.89, s: 4, f: 2 }, { b: 257.87, s: 1, f: 1 }, { b: 257.87, s: 1, f: 0 },
      { b: 257.87, s: 3, f: 0 }, { b: 257.87, s: 4, f: 1 }, { b: 257.87, s: 4, f: 2 }, { b: 258.98, s: 1, f: 1 }, { b: 258.98, s: 3, f: 0 }, { b: 258.98, s: 4, f: 1 }, { b: 258.98, s: 4, f: 9 }, { b: 259.82, s: 1, f: 1 },
      { b: 259.82, s: 3, f: 0 }, { b: 259.82, s: 4, f: 1 }, { b: 259.82, s: 4, f: 2 }, { b: 260.87, s: 1, f: 1 }, { b: 260.87, s: 3, f: 0 }, { b: 260.87, s: 4, f: 1 }, { b: 260.87, s: 4, f: 2 }, { b: 262, s: 1, f: 1 },
      { b: 262, s: 1, f: 0 }, { b: 262, s: 3, f: 0 }, { b: 262, s: 3, f: 1 }, { b: 262, s: 4, f: 1 }, { b: 262, s: 4, f: 2 }, { b: 262.38, s: 1, f: 0 }, { b: 262.38, s: 4, f: 2 }, { b: 263.35, s: 3, f: 10 },
      { b: 263.35, s: 4, f: 1 }, { b: 263.35, s: 4, f: 2 }, { b: 264.5, s: 1, f: 1 }, { b: 264.5, s: 4, f: 1 }, { b: 264.5, s: 4, f: 2 }, { b: 265.55, s: 3, f: 0 }, { b: 266.74, s: 1, f: 1 }, { b: 266.74, s: 1, f: 0 },
      { b: 266.74, s: 4, f: 1 }, { b: 266.74, s: 4, f: 2 }, { b: 267.8, s: 3, f: 0 }, { b: 267.8, s: 4, f: 11 }, { b: 267.8, s: 4, f: 2 }, { b: 269, s: 1, f: 1 }, { b: 269, s: 1, f: 0 }, { b: 269, s: 3, f: 0 },
      { b: 269, s: 3, f: 1 }, { b: 269, s: 4, f: 1 }, { b: 269, s: 4, f: 2 }, { b: 272, s: 1, f: 1 }, { b: 272, s: 1, f: 3 }, { b: 272, s: 3, f: 11 }, { b: 272, s: 3, f: 0 }, { b: 272, s: 4, f: 1 },
      { b: 272, s: 4, f: 2 }, { b: 275, s: 0, f: 3 }, { b: 275, s: 1, f: 1 }, { b: 275, s: 1, f: 0 }, { b: 275, s: 4, f: 1 }, { b: 275, s: 4, f: 2 }, { b: 275, s: 4, f: 0 }, { b: 275.76, s: 3, f: 0 },
      { b: 276.51, s: 1, f: 0 }, { b: 276.51, s: 4, f: 1 }, { b: 277.3, s: 3, f: 0 }, { b: 278.04, s: 1, f: 2 }, { b: 278.04, s: 4, f: 3 }, { b: 278.8, s: 3, f: 0 }, { b: 279.56, s: 1, f: 3 }, { b: 279.56, s: 4, f: 5 },
      { b: 280.33, s: 3, f: 0 }, { b: 281, s: 1, f: 2 }, { b: 281, s: 4, f: 3 }, { b: 281.7, s: 3, f: 0 }, { b: 282.42, s: 1, f: 0 }, { b: 282.42, s: 4, f: 2 }, { b: 283.14, s: 3, f: 0 }, { b: 283.83, s: 2, f: 0 },
      { b: 283.83, s: 4, f: 1 }, { b: 284.55, s: 3, f: 0 }, { b: 284.99, s: 4, f: 1 }, { b: 285.5, s: 2, f: 0 }, { b: 285.95, s: 4, f: 1 }, { b: 286.46, s: 3, f: 0 }, { b: 287, s: 0, f: 3 }, { b: 287, s: 4, f: 0 },
      { b: 287, s: 5, f: 4 }, { b: 287, s: 5, f: 3 }, { b: 288.45, s: 3, f: 0 }, { b: 289.7, s: 1, f: 0 }, { b: 289.7, s: 4, f: 1 }, { b: 291.8, s: 3, f: 0 }, { b: 293.91, s: 1, f: 2 }, { b: 293.91, s: 4, f: 3 },
      { b: 295, s: 1, f: 2 }, { b: 295, s: 1, f: 1 }, { b: 295, s: 3, f: 0 }, { b: 295, s: 4, f: 13 }, { b: 295, s: 4, f: 1 }, { b: 295, s: 4, f: 2 }, { b: 296.02, s: 3, f: 0 }, { b: 296.57, s: 4, f: 1 },
      { b: 297.47, s: 1, f: 11 }, { b: 298.21, s: 4, f: 12 }, { b: 298.91, s: 3, f: 0 }, { b: 300.04, s: 1, f: 10 }, { b: 300.04, s: 4, f: 1 }, { b: 300.04, s: 4, f: 2 }, { b: 301.09, s: 3, f: 0 }, { b: 301.83, s: 4, f: 12 },
      { b: 302.57, s: 1, f: 10 }, { b: 304, s: 3, f: 0 }, { b: 304, s: 5, f: 14 }, { b: 304.61, s: 1, f: 3 }, { b: 304.61, s: 4, f: 5 }, { b: 305.87, s: 3, f: 0 }, { b: 306.95, s: 1, f: 4 }, { b: 306.95, s: 5, f: 3 },
      { b: 308.49, s: 3, f: 0 }, { b: 309.54, s: 1, f: 13 }, { b: 310.43, s: 3, f: 0 }, { b: 312.06, s: 1, f: 6 }, { b: 312.06, s: 5, f: 5 }, { b: 313, s: 3, f: 0 }, { b: 313, s: 5, f: 1 }, { b: 313.69, s: 4, f: 8 },
      { b: 314.69, s: 3, f: 0 }, { b: 315.35, s: 4, f: 8 }, { b: 316.01, s: 1, f: 7 }, { b: 316.67, s: 4, f: 8 }, { b: 317.36, s: 3, f: 0 }, { b: 318.34, s: 4, f: 8 }, { b: 318.34, s: 5, f: 1 }, { b: 319.33, s: 3, f: 0 },
      { b: 320.02, s: 4, f: 8 }, { b: 320.68, s: 1, f: 6 }, { b: 321.34, s: 4, f: 8 }, { b: 322, s: 1, f: 5 }, { b: 322, s: 3, f: 0 }, { b: 322, s: 5, f: 2 }, { b: 322.77, s: 3, f: 0 }, { b: 323.56, s: 1, f: 4 },
      { b: 323.56, s: 5, f: 3 }, { b: 325.13, s: 1, f: 3 }, { b: 325.13, s: 4, f: 5 }, { b: 325.9, s: 3, f: 0 }, { b: 326.44, s: 4, f: 5 }, { b: 326.97, s: 1, f: 3 }, { b: 327.48, s: 4, f: 5 }, { b: 328, s: 1, f: 3 },
      { b: 328, s: 3, f: 0 }, { b: 328, s: 4, f: 4 }, { b: 328.9, s: 3, f: 0 }, { b: 329.49, s: 4, f: 4 }, { b: 330.09, s: 1, f: 3 }, { b: 331.31, s: 3, f: 0 }, { b: 332.21, s: 1, f: 2 }, { b: 332.21, s: 4, f: 1 },
      { b: 333.58, s: 3, f: 0 }, { b: 334.19, s: 4, f: 1 }, { b: 334.79, s: 1, f: 2 }, { b: 335.38, s: 4, f: 3 }, { b: 336, s: 1, f: 0 }, { b: 336, s: 3, f: 0 }, { b: 336, s: 4, f: 2 }, { b: 336.82, s: 3, f: 0 },
      { b: 337.95, s: 1, f: 0 }, { b: 339.54, s: 3, f: 0 }, { b: 340.35, s: 2, f: 0 }, { b: 340.35, s: 4, f: 1 }, { b: 341.58, s: 3, f: 0 }, { b: 342.11, s: 4, f: 1 }, { b: 342.71, s: 2, f: 0 }, { b: 343.44, s: 4, f: 1 },
      { b: 344, s: 2, f: 4 }, { b: 344, s: 3, f: 0 }, { b: 344, s: 3, f: 2 }, { b: 344.93, s: 0, f: 3 }, { b: 344.93, s: 4, f: 0 }, { b: 345.76, s: 3, f: 0 }, { b: 346.33, s: 4, f: 0 }, { b: 346.88, s: 0, f: 3 },
      { b: 347.43, s: 4, f: 0 }, { b: 348, s: 3, f: 0 }, { b: 348, s: 3, f: 4 }, { b: 350, s: 2, f: 5 }, { b: 351.07, s: 1, f: 2 }, { b: 351.07, s: 4, f: 5 }, { b: 352.24, s: 3, f: 0 }, { b: 353.29, s: 4, f: 3 },
      { b: 354.19, s: 3, f: 0 }, { b: 356.26, s: 1, f: 0 }, { b: 356.26, s: 4, f: 2 }, { b: 357.16, s: 3, f: 0 }, { b: 357.77, s: 4, f: 2 }, { b: 358.39, s: 1, f: 0 }, { b: 359.37, s: 4, f: 2 }, { b: 360, s: 2, f: 0 },
      { b: 360, s: 3, f: 0 }, { b: 360, s: 4, f: 1 }, { b: 361.15, s: 3, f: 0 }, { b: 361.74, s: 4, f: 1 }, { b: 362.37, s: 2, f: 0 }, { b: 363.08, s: 4, f: 1 }, { b: 363.7, s: 3, f: 0 }, { b: 364.62, s: 0, f: 3 },
      { b: 364.62, s: 4, f: 0 }, { b: 365.54, s: 3, f: 0 }, { b: 366.15, s: 4, f: 0 }, { b: 366.77, s: 0, f: 3 }, { b: 367.39, s: 4, f: 0 }, { b: 368, s: 1, f: 3 }, { b: 368, s: 3, f: 0 }, { b: 368, s: 4, f: 5 },
      { b: 369.21, s: 3, f: 11 }, { b: 370.24, s: 1, f: 2 }, { b: 370.24, s: 4, f: 3 }, { b: 371.17, s: 3, f: 0 }, { b: 373.23, s: 1, f: 0 }, { b: 373.23, s: 4, f: 2 }, { b: 374.16, s: 3, f: 0 }, { b: 374.79, s: 4, f: 2 },
      { b: 375.41, s: 1, f: 0 }, { b: 376.38, s: 4, f: 2 }, { b: 377, s: 2, f: 0 }, { b: 377, s: 3, f: 0 }, { b: 377, s: 4, f: 1 }, { b: 379.83, s: 3, f: 0 }, { b: 381.7, s: 4, f: 1 }, { b: 383.59, s: 2, f: 0 },
      { b: 385.46, s: 4, f: 1 }, { b: 387.35, s: 3, f: 0 }, { b: 390.18, s: 0, f: 3 }, { b: 390.18, s: 2, f: 0 }, { b: 390.18, s: 3, f: 0 }, { b: 393, s: 1, f: 2 }, { b: 393, s: 2, f: 0 }, { b: 393, s: 3, f: 0 },
      { b: 393, s: 4, f: 0 }, { b: 393, s: 5, f: 1 }, { b: 402, s: 0, f: 3 }, { b: 402, s: 1, f: 2 }, { b: 402, s: 2, f: 0 }, { b: 402, s: 2, f: 3 }, { b: 402, s: 3, f: 4 }, { b: 402, s: 3, f: 0 },
      { b: 402, s: 3, f: 3 }, { b: 402, s: 4, f: 0 },
    ],
    text: `G  C  D  Em  Am7`,
  },
];
