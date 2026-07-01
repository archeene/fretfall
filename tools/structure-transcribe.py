#!/usr/bin/env python
# structure-transcribe.py <stem.wav> <chords.json> <out.json> <beatsPerBar> [bpmHint]
# STRUCTURE-AWARE synthesis (skill Step 3): a song is a few repeating themes, not
# per-onset variation. Bars are clustered into section types by their harmonic
# fingerprint; each cluster gets ONE accompaniment template derived from ALL its
# bars (median-vote = denoise); the template stores chord-tone ROLES (interval vs
# chord root + octave), so the same shape instantiates over each bar's actual
# chord — exactly how real accompaniment repeats. Output is in BEAT space.
import sys, json, numpy as np, librosa
from collections import Counter
from scipy.ndimage import median_filter
from scipy.cluster.hierarchy import linkage, fcluster

stem, chordsf, outf = sys.argv[1], sys.argv[2], sys.argv[3]
BPB = int(sys.argv[4]) if len(sys.argv) > 4 else 4
HINT = float(sys.argv[5]) if len(sys.argv) > 5 else 120.0
uniq = json.load(open(chordsf))["unique"]
roots = [c["pcs"][0] for c in uniq]                      # TabParser pcs are root-first

y, sr = librosa.load(stem, sr=22050, mono=True)
yh, _ = librosa.effects.hpss(y)

tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=HINT, units="frames")
btimes = librosa.frames_to_time(beats, sr=sr)
if len(btimes) < BPB * 8:
    print("too few beats"); sys.exit(2)
bpm = 60.0 / float(np.median(np.diff(btimes)))

# --- per-beat chord (constrained to the song's own chords) ---
chroma = librosa.feature.chroma_cqt(y=yh, sr=sr)
bchroma = librosa.util.sync(chroma, beats, aggregate=np.median)
bc = bchroma / (np.linalg.norm(bchroma, axis=0, keepdims=True) + 1e-9)
masks = np.array([[1.0 if pc in c["pcs"] else 0.0 for pc in range(12)] for c in uniq])
masks = masks / (np.linalg.norm(masks, axis=1, keepdims=True) + 1e-9)
beatchord = median_filter(np.argmax(masks @ bc, axis=0), size=3)
nb = min(len(btimes) - 1, bc.shape[1])

# --- downbeat offset: chord changes align with bar starts ---
def changes(off):
    idx = range(off, nb - BPB, BPB)
    return sum(1 for i in idx if i > 0 and beatchord[i] != beatchord[i - 1])
off = max(range(BPB), key=changes)
nbars = (nb - off) // BPB
bars = [list(range(off + b * BPB, off + (b + 1) * BPB)) for b in range(nbars)]

# --- cluster bars into section types by harmonic fingerprint ---
X = np.array([bc[:, b].T.flatten() for b in bars])
X = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9)
k = int(np.clip(nbars // 10, 3, 7))
labels = fcluster(linkage(X, method="average", metric="cosine"), k, criterion="maxclust")

# --- onset strength per eighth slot (2 per beat) ---
oenv = librosa.onset.onset_strength(y=y, sr=sr)
otimes = librosa.times_like(oenv, sr=sr)
def slot_strength(t0, t1):
    m = (otimes >= t0) & (otimes < t1)
    return float(oenv[m].max()) if m.any() else 0.0
S8 = np.zeros((nbars, BPB * 2))
slot_t = np.zeros((nbars, BPB * 2))
for bi, bb in enumerate(bars):
    for j, beat in enumerate(bb):
        t0, t1 = btimes[beat], btimes[beat + 1]
        mid = (t0 + t1) / 2
        S8[bi, j * 2], S8[bi, j * 2 + 1] = slot_strength(t0, mid), slot_strength(mid, t1)
        slot_t[bi, j * 2], slot_t[bi, j * 2 + 1] = t0, mid

# --- spectral octave location (as audio-transcribe, but median-voted per cluster) ---
NFFT = 4096
SP = np.abs(librosa.stft(yh, n_fft=NFFT))
freqs = librosa.fft_frequencies(sr=sr, n_fft=NFFT)
st = librosa.times_like(SP, sr=sr)
def tone_energy(spec, midi):
    f0 = 440.0 * 2 ** ((midi - 69) / 12.0); e = 0.0
    for h in (1, 2, 3):
        f = f0 * h
        m = (freqs >= f * 0.972) & (freqs <= f * 1.028)
        if m.any(): e += float(spec[m].max()) / h
    return e
def best_octave(spec, pcs, lo, hi):
    bm, be = -1, -1.0
    for pc in pcs:
        m = lo + ((pc - lo) % 12)
        while m <= hi:
            e = tone_energy(spec, m)
            if e > be: be, bm = e, m
            m += 12
    return bm

# --- one template per cluster: attack slots + (interval, octave) role per slot ---
templates = {}
for lab in sorted(set(labels)):
    idx = [i for i in range(nbars) if labels[i] == lab]
    mean_s = S8[idx].mean(axis=0)
    thr = 0.45 * mean_s.max()
    attacks = [j for j in range(BPB * 2) if mean_s[j] >= thr]
    if 0 not in attacks: attacks.insert(0, 0)
    slots = {}
    for j in attacks:
        ivs, octs = [], []
        for i in idx:
            beat = bars[i][j // 2]
            ci = int(beatchord[min(beat, nb - 1)])
            spec = SP[:, int(np.argmin(np.abs(st - slot_t[i, j])))]
            m = best_octave(spec, uniq[ci]["pcs"], 55, 84)
            if m > 0:
                ivs.append((m - roots[ci]) % 12); octs.append(m)
        if ivs:
            iv = Counter(ivs).most_common(1)[0][0]
            slots[j] = (iv, int(np.median(octs)))
    templates[lab] = slots

# --- emit: every bar plays its cluster's template over its own chords ---
notes = []
for i in range(nbars):
    tpl = templates[labels[i]]
    bar_beat = off + i * BPB                            # absolute beat index of bar start
    for j, (iv, oct_t) in sorted(tpl.items()):
        beat = bars[i][j // 2]
        ci = int(beatchord[min(beat, nb - 1)])
        root = roots[ci]
        pc = (root + iv) % 12
        m = pc + 12 * round((oct_t - pc) / 12)          # octave nearest the learned register
        while m > 76: m -= 12                           # keep within first ~12 frets (playable)
        while m < 50: m += 12
        ev = []
        if j == 0 or (j == BPB and BPB >= 4):           # bass root on the strong beats
            bass = 40 + ((root - 40) % 12)
            if bass < 45: bass += 0                     # keep in E2..D#3
            ev.append(int(bass))
        if m not in ev: ev.append(m)
        if ev:
            notes.append({"b": round(bar_beat + j / 2.0, 3), "m": ev})

# --- fidelity score: emitted pc should be energetic in the real chroma ---
hits = tot = 0
for n in notes:
    bt = int(n["b"])
    if bt >= nb: continue
    col = bc[:, bt]
    for m in n["m"]:
        tot += 1
        if col[m % 12] >= np.median(col): hits += 1
fid = hits / tot if tot else 0.0

json.dump({"tempo": round(bpm, 1), "notes": notes, "fidelity": round(fid, 3),
           "sections": "".join(chr(64 + int(l)) for l in labels)}, open(outf, "w"))
print(f"bpm {bpm:.0f} | {nbars} bars x {BPB} beats | {len(set(labels))} section types "
      f"| {len(notes)} onsets | fidelity {fid:.2f} | form {''.join(chr(64 + int(l)) for l in labels[:48])}")
