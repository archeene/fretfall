#!/usr/bin/env python
# piano-arrange.py <piano.mid> <stem.wav> <out.json> [bpmHint]
# Reduce a REAL piano transcription (ByteDance high-res model output) to a solo-guitar
# arrangement, per the arranger literature (Hori IO-HMM / Song2Guitar / fingerstyle
# practice): MELODY = skyline top voice (kept 100%), BASS = lowest note on strong
# beats/chord changes, INNER voices only in melody gaps, <=3 notes per onset.
# Output: transcribe format {tempo, notes:[{b, m:[bass?,inner?,melody?]}]} in BEAT space
# (m[0] maps to low strings in chord-apply, later entries prefer high strings).
import sys, json, numpy as np, librosa, mido

midf, stemf, outf = sys.argv[1], sys.argv[2], sys.argv[3]
HINT = float(sys.argv[4]) if len(sys.argv) > 4 else 100.0

# --- piano notes (seconds; transcription MIDI is performance-time) ---
mid = mido.MidiFile(midf)
tempo = 500000
notes = []                                             # (onset_sec, dur_sec, pitch, vel)
for tr in mid.tracks:
    t, on = 0, {}
    for msg in tr:
        t += msg.time
        if msg.type == "set_tempo": tempo = msg.tempo
        sec = mido.tick2second(t, mid.ticks_per_beat, tempo)
        if msg.type == "note_on" and msg.velocity > 0:
            on[msg.note] = (sec, msg.velocity)
        elif msg.type in ("note_off", "note_on"):
            if msg.note in on:
                s, v = on.pop(msg.note)
                notes.append((s, sec - s, msg.note, v))
notes.sort()
if len(notes) < 40:
    print(f"too few piano notes ({len(notes)})"); sys.exit(2)

# --- beat grid from the audio stem ---
y, sr = librosa.load(stemf, sr=22050, mono=True)
bpm_det, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=HINT, units="frames")
bt = librosa.frames_to_time(beats, sr=sr)
bpm = 60.0 / float(np.median(np.diff(bt)))
def to_beat(sec):                                      # seconds -> fractional beat index
    i = np.searchsorted(bt, sec)
    if i <= 0: return (sec - bt[0]) / (bt[1] - bt[0])
    if i >= len(bt): return (len(bt) - 1) + (sec - bt[-1]) / (bt[-1] - bt[-2])
    return (i - 1) + (sec - bt[i - 1]) / (bt[i] - bt[i - 1])

# --- group into eighth-note slots ---
slots = {}                                             # slot(b*2 int) -> list of notes
for s, d, p, v in notes:
    k = round(to_beat(s) * 2)                          # nearest eighth
    slots.setdefault(k, []).append((p, v, d))

keys = sorted(slots)
# median velocity for salience filtering
allv = np.median([v for k in keys for _, v, _ in slots[k]])

# --- voice extraction ---
out = []
prev_mel = None
for k in keys:
    grp = sorted(slots[k], key=lambda x: x[0])         # by pitch
    pitches = [p for p, _, _ in grp]
    # melody: skyline top voice, but only if salient (vel or continuity)
    mel = None
    top_p, top_v, top_d = grp[-1]
    if top_p >= 55 and (top_v >= 0.75 * allv or (prev_mel and abs(top_p - prev_mel) <= 5)):
        mel = top_p
        prev_mel = mel
    # bass: lowest, on integer beats or when it moves
    bass = None
    if pitches[0] < 55 and (k % 2 == 0 or not out or (out and out[-1]["m"] and pitches[0] != out[-1]["m"][0])):
        bass = pitches[0]
    # inner: strongest remaining mid voice, only if slot is sparse in melody
    inner = None
    mids = [(p, v) for p, v, _ in grp if p not in (mel, bass) and 48 <= p <= 76]
    if mids and mel is None:                           # fill only in melody gaps
        inner = max(mids, key=lambda x: x[1])[0]
    m = []
    if bass is not None:
        b = bass
        while b < 40: b += 12
        while b > 57: b -= 12
        m.append(int(b))
    if inner is not None:
        i2 = inner
        while i2 > 74: i2 -= 12
        while i2 < 50: i2 += 12
        if i2 not in m: m.append(int(i2))
    if mel is not None:
        mm = mel
        while mm > 79: mm -= 12
        while mm < 52: mm += 12
        if mm not in m: m.append(int(mm))
    if m:
        out.append({"b": round(k / 2.0, 3), "m": m})

json.dump({"tempo": round(bpm, 1), "notes": out}, open(outf, "w"))
mel_n = sum(1 for o in out for _ in [0] if len(o["m"]) > 0)
print(f"bpm {bpm:.0f} | {len(notes)} piano notes -> {len(out)} guitar onsets "
      f"({sum(len(o['m']) for o in out)} notes) | span {out[-1]['b']-out[0]['b']:.0f} beats")
