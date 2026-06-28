#!/usr/bin/env python
# audio-transcribe.py <audio> <chords.json> <out.json> [isolate]
# Song-long chord-constrained transcription with REAL OCTAVES and a 2-voice
# (bass + top) texture:
#  - recognise the chord per beat from the audio (constrained to the song's chords)
#  - for every onset, find the strongest chord tone and LOCATE ITS REAL OCTAVE from
#    the spectrum (no centroid guess), separately for a low (bass/thumb) and a high
#    (melody/fingers) register -> two actual MIDI pitches per pluck.
# Robust because we only octave-search KNOWN pitch classes (no open multi-pitch).
import sys, json, numpy as np, librosa
from scipy.ndimage import median_filter

audio, chordsf, out = sys.argv[1], sys.argv[2], sys.argv[3]
uniq = json.load(open(chordsf))["unique"]

y, sr = librosa.load(audio, sr=22050, mono=True)
if len(sys.argv) > 4 and sys.argv[4] == "isolate":          # light vocal reduction if no Demucs stem
    S_full, phase = librosa.magphase(librosa.stft(y))
    S_filt = np.minimum(S_full, librosa.decompose.nn_filter(
        S_full, aggregate=np.median, metric="cosine", width=int(librosa.time_to_frames(2, sr=sr))))
    y = librosa.istft(librosa.util.softmask(S_filt, 10 * (S_full - S_filt), power=2) * S_full * phase)
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
masks = np.array([[1.0 if pc in c["pcs"] else 0.0 for pc in range(12)] for c in uniq])
masks = masks / (np.linalg.norm(masks, axis=1, keepdims=True) + 1e-9)
beatchord = np.argmax(masks @ bc, axis=0)
if len(beatchord) >= 3:
    beatchord = median_filter(beatchord, size=3)

# high-resolution magnitude spectrum for octave location
NFFT = 4096
S = np.abs(librosa.stft(yh, n_fft=NFFT))
freqs = librosa.fft_frequencies(sr=sr, n_fft=NFFT)
st = librosa.times_like(S, sr=sr)

def tone_energy(spec, midi):
    """harmonic-sum energy of a specific MIDI pitch (fundamental + 2nd + 3rd)."""
    f0 = 440.0 * 2 ** ((midi - 69) / 12.0)
    e = 0.0
    for h in (1, 2, 3):
        f = f0 * h
        lo, hi = f * 0.972, f * 1.028
        idx = (freqs >= lo) & (freqs <= hi)
        if idx.any():
            e += float(spec[idx].max()) / h      # weight harmonics down
    return e

def best_octave(spec, pcs, lo_midi, hi_midi):
    """strongest (midi) among the chord's pitch classes within a register."""
    best_m, best_e = -1, -1.0
    for pc in pcs:
        m = lo_midi + ((pc - lo_midi) % 12)
        while m <= hi_midi:
            e = tone_energy(spec, m)
            if e > best_e:
                best_e, best_m = e, m
            m += 12
    return best_m, best_e

onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time", backtrack=True)
notes = []
for t in onsets:
    bi = max(0, min(len(beatchord) - 1, int(np.searchsorted(btimes, t) - 1)))
    ci = int(beatchord[bi]); pcs = uniq[ci]["pcs"]
    spec = S[:, int(np.argmin(np.abs(st - t)))]
    bass, be = best_octave(spec, pcs, 40, 55)     # E2..G3  (thumb / bass)
    top, te = best_octave(spec, pcs, 55, 84)      # G3..C6  (fingers / melody)
    midis = []
    if bass > 0 and be > 0: midis.append(bass)
    if top > 0 and te > 0 and top != bass: midis.append(top)
    if midis:
        notes.append({"t": round(float(t), 3), "m": midis, "c": ci})

json.dump({"tempo": round(tempo, 1), "notes": notes,
           "chords_used": int(len(set(beatchord.tolist())))}, open(out, "w"))
print(f"tempo~{tempo:.0f} onsets={len(onsets)} notes={sum(len(n['m']) for n in notes)} (2-voice) chords_used={len(set(beatchord.tolist()))}/{len(uniq)}")
