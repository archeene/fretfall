#!/usr/bin/env python
# audio-transcribe.py <audio> <chords.json> <out.json>
# Song-long chord-constrained transcription (captures section variation):
#  - recognize the chord per beat from the audio, constrained to THIS song's chords
#  - for every onset, pick the strongest tone of the active chord + its register
# Output: ordered notes [{t, pc, h, c}] following the real recording.
import sys, json, numpy as np, librosa
from scipy.ndimage import median_filter

audio, chordsf, out = sys.argv[1], sys.argv[2], sys.argv[3]
uniq = json.load(open(chordsf))["unique"]

y, sr = librosa.load(audio, sr=22050, mono=True)
yh, _ = librosa.effects.hpss(y)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="frames")
tempo = float(np.atleast_1d(tempo)[0])
chroma = librosa.feature.chroma_cqt(y=yh, sr=sr)
chrt = librosa.times_like(chroma, sr=sr)
if len(beats) < 2:
    beats = np.arange(0, chroma.shape[1], max(1, int(sr * 0.5 / 512)))
btimes = librosa.frames_to_time(beats, sr=sr)

# per-beat chord = best cosine match of beat-chroma to each known chord's pc mask
bchroma = librosa.util.sync(chroma, beats, aggregate=np.median)
bc = bchroma / (np.linalg.norm(bchroma, axis=0, keepdims=True) + 1e-9)
masks = []
for c in uniq:
    m = np.zeros(12)
    for pc in c["pcs"]:
        m[pc] = 1.0
    masks.append(m / (np.linalg.norm(m) + 1e-9))
masks = np.array(masks)
beatchord = np.argmax(masks @ bc, axis=0)
if len(beatchord) >= 3:
    beatchord = median_filter(beatchord, size=3)        # de-flicker

onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time", backtrack=True)
cent = librosa.feature.spectral_centroid(y=yh, sr=sr)[0]
ctimes = librosa.times_like(cent, sr=sr)
order = np.argsort(cent); rank = np.empty_like(order, dtype=float); rank[order] = np.arange(len(cent)) / max(1, len(cent) - 1)

notes = []
for t in onsets:
    bi = max(0, min(len(beatchord) - 1, int(np.searchsorted(btimes, t) - 1)))
    ci = int(beatchord[bi]); chord = uniq[ci]
    fi = int(np.argmin(np.abs(chrt - t)))
    cv = chroma[:, fi]
    best_pc = max(chord["pcs"], key=lambda p: cv[p])    # strongest sounding chord tone
    hi = int(np.argmin(np.abs(ctimes - t)))
    notes.append({"t": round(float(t), 3), "pc": int(best_pc), "h": round(float(rank[hi]), 3), "c": ci})

json.dump({"tempo": round(tempo, 1), "notes": notes,
           "chords_used": int(len(set(beatchord.tolist())))}, open(out, "w"))
print(f"tempo~{tempo:.0f} beats={len(beats)} onsets={len(onsets)} notes={len(notes)} chords_used={len(set(beatchord.tolist()))}/{len(uniq)}")
