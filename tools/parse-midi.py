#!/usr/bin/env python
# parse-midi.py <file.mid> <out.json> [track_name_regex]
# Parse a real MIDI into the transcribe format {tempo, notes:[{t, m:[midi,...]}]}.
# Optional regex selects which named tracks to keep (e.g. "melody|guitar|bas");
# drums and empty tracks are always skipped. Default: melody + guitar + bass.
import sys, json, re, mido
from collections import defaultdict

mid = mido.MidiFile(sys.argv[1])
out_path = sys.argv[2]
want = re.compile(sys.argv[3] if len(sys.argv) > 3 else r"melody|guitar|bas", re.I)
# tempo map: (abs_tick, tempo_us_per_beat) across all tracks — handles tempo changes
tmap = []
for tr in mid.tracks:
    at = 0
    for msg in tr:
        at += msg.time
        if msg.type == "set_tempo":
            tmap.append((at, msg.tempo))
tmap.sort()
if not tmap or tmap[0][0] > 0:
    tmap.insert(0, (0, 500000))

def tick2sec(target):
    sec, last, cur = 0.0, 0, tmap[0][1]
    for tk, tp in tmap:
        if tk >= target:
            break
        sec += mido.tick2second(tk - last, mid.ticks_per_beat, cur)
        last, cur = tk, tp
    return sec + mido.tick2second(target - last, mid.ticks_per_beat, cur)

# which track indices to keep (by track name; never drums/channel 9)
keep = set()
for i, tr in enumerate(mid.tracks):
    name = next((msg.name for msg in tr if msg.type == "track_name"), "")
    if want.search(name) and not re.search(r"drum", name, re.I):
        keep.add(i)
if not keep:                                   # no names matched -> any pitched, non-drum track
    keep = {i for i, tr in enumerate(mid.tracks)
            if any(m.type == "note_on" and m.velocity > 0 and m.channel != 9 for m in tr)}

# walk each kept track, converting tick->sec via the tempo map
notes = []
for i in keep:
    abs_tick, on = 0, {}
    for msg in mid.tracks[i]:
        abs_tick += msg.time
        if msg.type == "note_on" and msg.velocity > 0 and msg.channel != 9:
            on[msg.note] = tick2sec(abs_tick)
        elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
            if msg.note in on:
                notes.append((on.pop(msg.note), msg.note))
# effective bpm from total beats / total seconds
_end = max((sum(m.time for m in tr) for tr in mid.tracks), default=0)
_es = tick2sec(_end) or 1
bpm = round((_end / mid.ticks_per_beat) / (_es / 60.0), 1)

groups = defaultdict(set)
for t, n in notes:
    groups[round(t, 2)].add(n)
out = [{"t": round(t, 3), "m": sorted(ms)} for t, ms in sorted(groups.items())]
json.dump({"tempo": bpm, "notes": out}, open(out_path, "w"))
kept_names = [next((m.name for m in mid.tracks[i] if m.type=="track_name"), str(i)).strip() for i in sorted(keep)]
print(f"bpm {bpm} | kept {kept_names} | {len(notes)} notes | {len(out)} onsets | "
      f"span {(max(t for t,_ in notes)-min(t for t,_ in notes)):.0f}s | range {min(n for _,n in notes)}-{max(n for _,n in notes)}")
