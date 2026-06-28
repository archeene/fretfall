#!/usr/bin/env python
# audio-pattern.py <audio> <out.json> [beats_per_bar=4] [slots_per_bar=8] [thresh=0.30]
# Learn the RECURRING breakup pattern from a real recording (NOT full transcription):
# beat-track -> onset rhythm -> fold onsets into bar-relative slots -> per slot record how
# often it recurs, its onset STRENGTH, and a continuous pitch HEIGHT (0=low..1=high) so the
# arpeggiator can follow the real up/down contour. Output = compact template.
import sys, json, numpy as np, librosa

audio = sys.argv[1]; out = sys.argv[2]
BPB = int(sys.argv[3]) if len(sys.argv) > 3 else 4
SLOTS = int(sys.argv[4]) if len(sys.argv) > 4 else 8
THRESH = float(sys.argv[5]) if len(sys.argv) > 5 else 0.30

y, sr = librosa.load(audio, sr=22050, mono=True)
yh, _ = librosa.effects.hpss(y)                       # keep harmonic (pitched) content
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
tempo = float(np.atleast_1d(tempo)[0])
if len(beats) < 2:
    beats = np.arange(0, librosa.get_duration(y=y, sr=sr), 60.0 / max(tempo, 40))
bar = float(np.median(np.diff(beats))) * BPB
b0 = float(beats[0])

env = librosa.onset.onset_strength(y=y, sr=sr)
onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time", backtrack=True)
ostrength = librosa.onset.onset_detect(y=y, sr=sr, units="frames", backtrack=True)
cent = librosa.feature.spectral_centroid(y=yh, sr=sr)[0]
ctimes = librosa.times_like(cent, sr=sr)
# pitch height = percentile rank of the spectral centroid (robust 0..1 register)
order = np.argsort(cent); rank = np.empty_like(order, dtype=float); rank[order] = np.arange(len(cent)) / max(1, len(cent) - 1)

slots = {s: {"heights": [], "strength": 0.0, "n": 0} for s in range(SLOTS)}
nbars = max(1.0, (onsets[-1] - b0) / bar) if len(onsets) else 1.0
for t in onsets:
    s = int(round((((t - b0) % bar) / bar) * SLOTS)) % SLOTS
    fi = int(np.argmin(np.abs(ctimes - t)))
    slots[s]["heights"].append(float(rank[fi]))
    slots[s]["strength"] += float(env[min(fi, len(env) - 1)])
    slots[s]["n"] += 1

template = []
for s in range(SLOTS):
    h = slots[s]
    if h["n"] >= nbars * THRESH:
        template.append({"slot": s, "height": round(float(np.median(h["heights"])), 3),
                         "strength": round(h["strength"] / max(1, h["n"]), 3), "n": h["n"]})

json.dump({"tempo": round(tempo, 1), "bar_sec": round(bar, 3), "bars_analyzed": round(nbars, 1),
           "beats_per_bar": BPB, "slots_per_bar": SLOTS, "onsets": len(onsets), "template": template},
          open(out, "w"), indent=0)
print(f"tempo~{tempo:.0f} bars~{nbars:.0f} onsets={len(onsets)} -> {len(template)} slots")
print("contour:", [(t["slot"], round(t["height"], 2)) for t in template])
