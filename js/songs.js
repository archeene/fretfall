// Song library. Songs are baked into the repo here, so they persist across
// sessions and devices (served from GitHub Pages). To add a song, append an
// entry below. `text` is chord-over-lyrics format; only the chord lines matter
// to the parser, lyrics are kept for readability.
//
// The first entry is the default loaded on startup.
window.SONGS = [
  {
    id: "hallelujah",
    title: "Hallelujah — Jeff Buckley / Leonard Cohen",
    source: "https://tabs.ultimate-guitar.com/tab/jeff-buckley/hallelujah-guitar-pro-2155367",
    bpm: 84,
    beatsPerChord: 3,
    text: `Verse 1:
C                 Am
I heard there was a secret chord
C                          Am
That David played and it pleased the Lord
F            G          C        G
But you don't really care for music, do you?
C              F     G
It goes like this, the fourth, the fifth
Am               F
The minor fall, the major lift
G           E7            Am
The baffled king composing Hallelujah

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
F           G            C       G
Her beauty and the moonlight overthrew ya
C            F        G
She tied you to a kitchen chair
Am                 F
She broke your throne, she cut your hair
G          E7              Am
And from your lips she drew the Hallelujah

Chorus:
F          Am
Hallelujah, Hallelujah
F          C        G    C
Hallelujah, Hallelujah`,
  },

  {
    id: "dancing-in-the-dark",
    title: "Dancing in the Dark — Bruce Springsteen (sample)",
    bpm: 148,
    beatsPerChord: 4,
    text: `Verse:
B                                  E
I get up in the evening, and I ain't got nothing to say
B                                       E
I come home in the morning, I go to bed feeling the same way
F#                         E
I ain't nothing but tired, man I'm just tired and bored with myself
B                          E              F#            B
Hey there baby, I could use just a little help

Chorus:
B           E      F#        B
You can't start a fire, you can't start a fire without a spark
B              E             F#               B
This gun's for hire, even if we're just dancing in the dark`,
  },

  {
    id: "wonderwall",
    title: "Wonderwall — Oasis (sample)",
    bpm: 87,
    beatsPerChord: 2,
    text: `Verse:
Em7          G
Today is gonna be the day
D                  A7sus4
That they're gonna throw it back to you
Em7              G
By now you should've somehow
D                A7sus4
Realized what you gotta do

Chorus:
C       D        Em
And all the roads we have to walk are winding
C        D            Em
And all the lights that lead us there are blinding`,
  },
];
