#!/usr/bin/env python
# ensemble-midi.py <out.mid> <in1.mid> <in2.mid> [in3.mid ...] [--min N]
# Vote across transcriber outputs: keep a note if >=N sources (default 2) have the
# same pitch within 60ms. Timing/velocity from the strongest source occurrence.
import sys, mido

argv = sys.argv[1:]
minv = 2
if "--min" in argv:
    i = argv.index("--min"); minv = int(argv[i + 1]); argv = argv[:i] + argv[i + 2:]
outf, ins = argv[0], argv[1:]

def load(path):
    mid = mido.MidiFile(path)
    notes = []
    for tr in mid.tracks:
        t, on = 0, {}
        for m in tr:
            t += m.time
            sec = mido.tick2second(t, mid.ticks_per_beat, 500000)
            if m.type == "note_on" and m.velocity > 0:
                on[m.note] = (sec, m.velocity)
            elif m.type in ("note_off", "note_on") and m.note in on:
                s, v = on.pop(m.note)
                notes.append((s, sec - s, m.note, v))
    return sorted(notes)

sources = [load(p) for p in ins]
# vote: for each note in each source, count agreeing sources
merged = []
for si, notes in enumerate(sources):
    for s, d, p, v in notes:
        votes = 1
        for sj, other in enumerate(sources):
            if sj == si: continue
            for s2, d2, p2, v2 in other:
                if abs(s2 - s) <= 0.06 and p2 == p: votes += 1; break
                if s2 > s + 0.06: break
        if votes >= minv:
            merged.append((s, d, p, v))
# dedupe (same pitch within 40ms keeps strongest)
merged.sort()
out = []
for s, d, p, v in merged:
    if out and out[-1][2] == p and s - out[-1][0] < 0.04:
        if v > out[-1][3]: out[-1] = (s, d, p, v)
        continue
    out.append((s, d, p, v))

mid = mido.MidiFile(); tr = mido.MidiTrack(); mid.tracks.append(tr)
events = []
for s, d, p, v in out:
    events.append((s, "note_on", p, max(1, min(127, int(v)))))
    events.append((s + max(0.05, d), "note_off", p, 0))
events.sort()
tpb = mid.ticks_per_beat
last = 0
for t, kind, p, v in events:
    tick = int(mido.second2tick(t, tpb, 500000))
    tr.append(mido.Message(kind, note=p, velocity=v, time=max(0, tick - last)))
    last = tick
mid.save(outf)
print(f"{len(out)} ensemble notes from {[len(s) for s in sources]} (min {minv} votes)")
