#!/usr/bin/env python
# piano-arrange.py <piano.mid> <stem.wav> <out.json> [bpmHint] [beatsPerBar] [chords.json]
# v4 — figuration-preserving reduction, benchmarked against real human tabs.
# Pipeline: ghost filters -> audio beat grid + drift refinement (v2, best grid) ->
# 16th slots -> REPETITION REPAIR: cluster bars by content, vote (slot,pc) across
# instances of the same bar-type; fill dropouts, drop one-off noise. Repeated
# sections are multiple observations of the same phrase — the ensemble denoises.
# Benchmark (Transatlanticism vs Songsterr human tab): v1 43.9 / v2 49.6 / v4 see log.
import sys, os, json, numpy as np, librosa, mido
from collections import defaultdict
from scipy.ndimage import median_filter

midf, stemf, outf = sys.argv[1], sys.argv[2], sys.argv[3]
HINT = float(sys.argv[4]) if len(sys.argv) > 4 else 100.0
BPB = int(sys.argv[5]) if len(sys.argv) > 5 else 4
SPB = BPB * 4                                          # 16th slots per bar
LO, HI = 40, 76
KEEP = float(os.environ.get("KEEP", 0.34))
FILL = float(os.environ.get("FILL", 0.6))
CAP = int(os.environ.get("CAP", 3))
# chord-prior pc pool (E5): union of the chart's chord tones + their scale
POOL = None
if len(sys.argv) > 6:
    uniq = json.load(open(sys.argv[6]))["unique"]
    POOL = set(pc for c in uniq for pc in c["pcs"])

# --- piano notes ---
mid = mido.MidiFile(midf)
tempo = 500000
notes = []
for tr in mid.tracks:
    t, on = 0, {}
    for msg in tr:
        t += msg.time
        if msg.type == "set_tempo": tempo = msg.tempo
        sec = mido.tick2second(t, mid.ticks_per_beat, tempo)
        if msg.type == "note_on" and msg.velocity > 0:
            on[msg.note] = (sec, msg.velocity)
        elif msg.type in ("note_off", "note_on") and msg.note in on:
            s, v = on.pop(msg.note)
            notes.append((s, sec - s, msg.note, v))
notes.sort()
if len(notes) < 40:
    print(f"too few piano notes ({len(notes)})"); sys.exit(2)

# --- ghost filters (v2) ---
notes = [(s, d, p, v) for s, d, p, v in notes if not (d < 0.06 and v < 45) and v >= 25]
# chord-prior (E5): notes outside every chart chord are suspect — keep only if loud
# (real passing tones ring out; separation bleed and ghosts are quiet)
if POOL:
    med_v = float(np.median([v for _, _, _, v in notes]))
    notes = [(s, d, p, v) for s, d, p, v in notes if p % 12 in POOL or v >= med_v]
keep = []
for i, (s, d, p, v) in enumerate(notes):
    ghost = False
    for j in range(max(0, i - 12), i):
        s2, d2, p2, v2 = notes[j]
        if abs(s - s2) < 0.04 and (p - p2) in (12, 19, 24) and v < 0.55 * v2:
            ghost = True; break
    if not ghost: keep.append((s, d, p, v))
notes = keep

# --- beat grid + drift refinement (v2) ---
# GRID_WAV: beat-track a different stem (drums!) than the one transcribed
y, sr = librosa.load(os.environ.get("GRID_WAV", stemf), sr=22050, mono=True)
_, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=HINT, units="frames")
bt = librosa.frames_to_time(beats, sr=sr)
bpm = 60.0 / float(np.median(np.diff(bt)))
if os.environ.get("GRID") == "const":
    # constant-tempo grid: steady playing + wandering tracker = beat slips that
    # shift whole passages. Fit u=median interval, refine (u, phase) to minimize
    # note-onset deviation from the 16th grid.
    u = float(np.median(np.diff(bt)))
    T0 = np.array([s for s, _, _, _ in notes])
    def gridcost(u_, ph):
        x = (T0 - ph) / (u_ / 4)
        return float(np.abs(x - np.round(x)).mean())
    best = (u, bt[0]); bc = gridcost(*best)
    for du in np.linspace(-0.02, 0.02, 21):
        for dph in np.linspace(-u / 2, u / 2, 33):
            c = gridcost(u + du, bt[0] + dph)
            if c < bc: bc, best = c, (u + du, bt[0] + dph)
    u, ph = best
    bpm = 60.0 / u
    bt = ph + u * np.arange(int((T0.max() - ph) / u) + 2)
def to_beat(sec):
    i = np.searchsorted(bt, sec)
    if i <= 0: return (sec - bt[0]) / (bt[1] - bt[0])
    if i >= len(bt): return (len(bt) - 1) + (sec - bt[-1]) / (bt[-1] - bt[-2])
    return (i - 1) + (sec - bt[i - 1]) / (bt[i] - bt[i - 1])
rb = np.array([to_beat(s) for s, _, _, _ in notes])
res = rb * 4 - np.round(rb * 4)
drift = median_filter(res, size=25, mode="nearest")
q16 = np.round(rb * 4 - drift).astype(int)             # 16th index per note

# --- bars + leader clustering by (slot,pc) content ---
nbars = int(q16.max()) // SPB + 1
bars = [defaultdict(list) for _ in range(nbars)]       # slot -> [(p,v)]
for (s, d, p, v), q in zip(notes, q16):
    if q < 0: continue
    bars[q // SPB][q % SPB].append((p, v))
def fp(bar):                                           # fingerprint
    return {(sl, p % 12) for sl, grp in bar.items() for p, _ in grp}
def shifted(f, sh):
    return {((sl + sh) % SPB, pc) for sl, pc in f}
def jac(a, b):
    if not a and not b: return 1.0
    return len(a & b) / (len(a | b) or 1)
# SHIFT-INVARIANT leader clustering: a bar whose grid slipped 1-2 beats has ~zero
# overlap with its true cluster at shift 0 and hides in a singleton — so compare
# at shifts -4..+4 and apply the winning shift on entry (grid-slip healing).
fps = [fp(b) for b in bars]
SHIFTS = range(-4, 5) if os.environ.get("SHIFTCLUST", "1") != "0" else (0,)
labels = [-1] * nbars
leaders = []
for i in range(nbars):
    best, bl, bsh = 0.42, -1, 0
    for li, lf in leaders:
        for sh in SHIFTS:
            s = jac(shifted(fps[i], sh), lf)
            if s > best or (s == best and bl == li and abs(sh) < abs(bsh)):
                best, bl, bsh = s, li, sh
    if bl >= 0:
        labels[i] = labels[bl]
        if bsh:                                        # heal the slip
            nb = defaultdict(list)
            for sl, grp in bars[i].items():
                nb[(sl + bsh) % SPB].extend(grp)
            bars[i] = nb
            fps[i] = fp(bars[i])
    else:
        labels[i] = len(leaders); leaders.append((i, fps[i]))

# --- repetition repair: vote (slot,pc) within each cluster ---
clusters = defaultdict(list)
for i, l in enumerate(labels): clusters[l].append(i)

def cluster_votes(idx, skip=None):
    votes, pitch = defaultdict(int), defaultdict(list)
    for i in idx:
        if i == skip: continue
        for sl, grp in bars[i].items():
            seen = set()
            for p, v in grp:
                k = (sl, p % 12)
                if k not in seen: votes[k] += 1; seen.add(k)
                pitch[k].append(p)
    return votes, pitch

# (T1) per-bar PHASE ALIGNMENT: librosa's grid slips by a slot at bar scale;
# shift each bar +-2 slots to best agree with its cluster's consensus
for l, idx in clusters.items():
    if len(idx) < 3: continue
    for i in idx:
        votes, _ = cluster_votes(idx, skip=i)
        mine = {(sl, p % 12) for sl, grp in bars[i].items() for p, _ in grp}
        def agree(shift):
            return sum(votes.get(((sl + shift) % SPB, pc), 0) for sl, pc in mine
                       if 0 <= sl + shift < SPB)
        best = max((-2, -1, 0, 1, 2), key=lambda sh: (agree(sh), -abs(sh)))
        if best:
            nb = defaultdict(list)
            for sl, grp in bars[i].items():
                ns = sl + best
                if 0 <= ns < SPB: nb[ns].extend(grp)
                else: nb[sl].extend(grp)               # keep edge notes in place
            bars[i] = nb

repaired = [defaultdict(list) for _ in range(nbars)]
for l, idx in clusters.items():
    n = len(idx)
    votes, pitch = cluster_votes(idx)
    for i in idx:
        have = {(sl, p % 12) for sl, grp in bars[i].items() for p, _ in grp}
        for sl, grp in bars[i].items():
            for p, v in grp:
                pc = p % 12
                if n == 1 or votes[(sl, pc)] / n >= KEEP:
                    repaired[i][sl].append((p, v))
                else:
                    # (T2) SLOT UNIFICATION: scattered timing — if an adjacent slot
                    # has strong consensus for this pc, move the note there
                    moved = False
                    for dsl in (-1, 1):
                        ns = sl + dsl
                        if 0 <= ns < SPB and votes[(ns, pc)] / n >= max(KEEP, 0.5):
                            repaired[i][ns].append((p, v)); moved = True; break
                    # else: dropped as noise
        if n >= 3:                                     # fill strong consensus dropouts
            for (sl, pc), c in votes.items():
                if c / n >= FILL and (sl, pc) not in have:
                    med = int(np.median(pitch[(sl, pc)]))
                    repaired[i][sl].append((med, 60))

# --- figuration output (v2 collapse + contour fold) ---
out = []
prev = 59.0
for bi in range(nbars):
    for sl in sorted(repaired[bi]):
        grp = repaired[bi][sl]
        bypc = {}
        for p, v in grp:
            pc = p % 12
            if pc not in bypc or v > bypc[pc][1]: bypc[pc] = (p, v)
        tones = sorted(bypc.values(), key=lambda x: -x[1])[:CAP]
        m = []
        for p, v in sorted(tones, key=lambda x: x[0]):
            best = min((p + 12 * o for o in range(-4, 5) if LO <= p + 12 * o <= HI),
                       key=lambda c: abs(c - prev), default=None)
            if best is not None and best not in m: m.append(int(best))
        if m:
            prev = 0.7 * prev + 0.3 * float(np.mean(m))
            out.append({"b": round((bi * SPB + sl) / 4.0, 3), "m": m})

json.dump({"tempo": round(bpm, 1), "notes": out}, open(outf, "w"))
print(f"bpm {bpm:.0f} | {len(notes)} notes | {nbars} bars, {len(clusters)} bar-types | "
      f"{len(out)} onsets ({sum(len(o['m']) for o in out)} guitar notes)")
