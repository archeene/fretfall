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
    beatsPerChord: 3,
    capo: 0,           // standard tuning E A D G B E, no capo
    // Individual-note picking transcribed from the tab PDF (Intro: C Am7 C Am7).
    // {b: eighth-note index, s: string 0=lowE..5=high-e, f: fret}
    notes: [
      // m1 (C):  A3 D2 G0 [e3+B1] G0 A2
      { b: 0, s: 1, f: 3 }, { b: 1, s: 2, f: 2 }, { b: 2, s: 3, f: 0 },
      { b: 3, s: 5, f: 3 }, { b: 3, s: 4, f: 1 }, { b: 4, s: 3, f: 0 }, { b: 5, s: 1, f: 2 },
      // m2 (Am7): A0 D2 G0 [e3+B1] G0 A2
      { b: 6, s: 1, f: 0 }, { b: 7, s: 2, f: 2 }, { b: 8, s: 3, f: 0 },
      { b: 9, s: 5, f: 3 }, { b: 9, s: 4, f: 1 }, { b: 10, s: 3, f: 0 }, { b: 11, s: 1, f: 2 },
      // m3 (C):  A3 D2 G0 [e3+B1] G0 A2
      { b: 12, s: 1, f: 3 }, { b: 13, s: 2, f: 2 }, { b: 14, s: 3, f: 0 },
      { b: 15, s: 5, f: 3 }, { b: 15, s: 4, f: 1 }, { b: 16, s: 3, f: 0 }, { b: 17, s: 1, f: 2 },
      // m4 (Am7): A0 D2 G0 [e3+B1] G0 A2
      { b: 18, s: 1, f: 0 }, { b: 19, s: 2, f: 2 }, { b: 20, s: 3, f: 0 },
      { b: 21, s: 5, f: 3 }, { b: 21, s: 4, f: 1 }, { b: 22, s: 3, f: 0 }, { b: 23, s: 1, f: 2 },
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
    beatsPerChord: 4,
    capo: 4,           // Capo 4th fret (sounds in E); matching is transposed +4
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
];
