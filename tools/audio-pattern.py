#!/usr/bin/env python
# audio-pattern.py <audio> <out.json> [beats_per_bar=4] [slots_per_bar=8]
# Learn the RECURRING breakup pattern from a real recording (NOT full transcription):
# beat-track -> onset rhythm -> fold onsets into bar-relative slots -> keep slots that
# recur -> classify each as bass/treble (register) and its strongest pitch class (chroma).
# Output is a compact template the chord-arpeggiator stamps over the known chords.
import sys, json, numpy as np, librosa

audio = sys.argv[1]
out = sys.argv[2]
BPB = int(sys.argv[3]) if len(sys.argv) > 3 else 4
SLOTS = int(sys.argv[4]) if len(sys.argv) > 4 else 8

y, sr = librosa.load(audio, sr=22050, mono=True)
yh, yp = librosa.effects.hpss(y)                      # harmonic (pitched) vs percussive
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
tempo = float(np.atleast_1d(tempo)[0])
if len(beats) < 2:
    beats = np.arange(0, librosa.get_duration(y=y, sr=sr), 60.0 / max(tempo, 40))
bar = float(np.median(np.diff(beats))) * BPB
b0 = float(beats[0])

onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time", backtrack=True)
cent = librosa.feature.spectral_centroid(y=yh, sr=sr)[0]
chroma = librosa.feature.chroma_cqt(y=yh, sr=sr)
ctimes = librosa.times_like(cent, sr=sr)
cmed = float(np.median(cent))

slot_hits = {s: {"bass": 0, "treble": 0, "pcs": np.zeros(12)} for s in range(SLOTS)}
nbars = max(1.0, (onsets[-1] - b0) / bar) if len(onsets) else 1.0
for t in onsets:
    phase = ((t - b0) % bar) / bar                    # 0..1 within the bar
    s = int(round(phase * SLOTS)) % SLOTS
    fi = int(np.argmin(np.abs(ctimes - t)))
    reg = "bass" if cent[fi] < cmed else "treble"
    slot_hits[s][reg] += 1
    slot_hits[s]["pcs"] += chroma[:, fi]

template = []
for s in range(SLOTS):
    h = slot_hits[s]
    n = h["bass"] + h["treble"]
    if n >= nbars * 0.30:                             # recurs in >=30% of bars
        reg = "bass" if h["bass"] >= h["treble"] else "treble"
        pc = int(np.argmax(h["pcs"])) if h["pcs"].sum() > 0 else -1
        template.append({"slot": s, "reg": reg, "pc": pc, "n": int(n)})

json.dump({"tempo": round(tempo, 1), "bar_sec": round(bar, 3), "bars_analyzed": round(nbars, 1),
           "beats_per_bar": BPB, "slots_per_bar": SLOTS, "onsets": len(onsets), "template": template},
          open(out, "w"), indent=0)
print(f"tempo~{tempo:.0f} bars~{nbars:.0f} onsets={len(onsets)} -> {len(template)} recurring slots")
print("template:", [(t["slot"], t["reg"]) for t in template])
