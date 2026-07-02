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
# chart chords (root-first pcs). POOL = E5 prior filter (off by default);
# CHORDS powers HYBRID mode: weak bars fall back to even-rhythm chord tones.
POOL, CHORDS = None, None
if len(sys.argv) > 6:
    uniq = json.load(open(sys.argv[6]))["unique"]
    CHORDS = [c["pcs"] for c in uniq]
    if os.environ.get("POOLFILTER", "0") == "1":
        POOL = set(pc for c in uniq for pc in c["pcs"])
HYBRID = os.environ.get("HYBRID", "0") == "1"
WEAK = float(os.environ.get("WEAK", 0.55))

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
if os.environ.get("MADMOM", "0") == "1":
    from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor
    act = RNNBeatProcessor()(os.environ.get("GRID_WAV", stemf))
    bt = DBNBeatTrackingProcessor(fps=100)(act)
else:
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
DW = os.environ.get("DWEIGHT", "0") == "1"
for (s, d, p, v), q in zip(notes, q16):
    if q < 0: continue
    bars[q // SPB][q % SPB].append((p, v * (min(1.0, d / 0.25) if DW else 1.0)))
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

if os.environ.get("VITERBI", "0") == "1":
    # (T1v) VITERBI bar-shift healing: grid slips persist over RUNS of bars, so
    # solve shifts jointly — emission = agreement with own cluster's consensus,
    # transition penalty for changing shift between adjacent bars.
    SH = list(range(-4, 5))
    LAM = 1.5                                          # shift-change penalty
    consensus = {}
    for l, idx in clusters.items():
        consensus[l] = cluster_votes(idx)[0]
    def emit(i, sh):
        votes = consensus[labels[i]]
        n = max(1, len(clusters[labels[i]]))
        mine = [(sl, p % 12) for sl, grp in bars[i].items() for p, _ in grp]
        if not mine: return 0.0
        return sum(votes.get(((sl + sh) % SPB, pc), 0) for sl, pc in mine) / (n * len(mine))
    E = np.array([[emit(i, sh) for sh in SH] for i in range(nbars)])
    D = np.full((nbars, len(SH)), -1e9); B = np.zeros((nbars, len(SH)), dtype=int)
    D[0] = E[0] - 0.05 * np.abs(SH)
    for i in range(1, nbars):
        for k in range(len(SH)):
            prev = D[i - 1] - LAM * np.abs(np.array(SH) - SH[k]) / SPB
            B[i, k] = int(np.argmax(prev))
            D[i, k] = prev[B[i, k]] + E[i, k] - 0.02 * abs(SH[k])
    k = int(np.argmax(D[-1])); path = [0] * nbars
    for i in range(nbars - 1, -1, -1):
        path[i] = SH[k]
        if i: k = B[i, k]
    for i in range(nbars):
        if path[i]:
            nb = defaultdict(list)
            for sl, grp in bars[i].items():
                nb[(sl + path[i]) % SPB].extend(grp)
            bars[i] = nb
else:
    # (T1) per-bar PHASE ALIGNMENT: greedy +-2 slot shift to cluster consensus
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
                    else: nb[sl].extend(grp)           # keep edge notes in place
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

# --- HYBRID fallback: bars where detection is weak play their chart chord in an
# EVEN quarter-note rhythm (what human tabbers do in dense passages) ---
if HYBRID and CHORDS:
    masks = np.array([[1.0 if pc in c else 0.0 for pc in range(12)] for c in CHORDS])
    masks = masks / (np.linalg.norm(masks, axis=1, keepdims=True) + 1e-9)
    replaced = 0
    surv = {}
    for i in range(nbars):
        if not bars[i]: continue
        n = len(clusters[labels[i]])
        orig = sum(len(g) for g in bars[i].values())
        kept = sum(len(g) for g in repaired[i].values())
        surv[i] = (kept / orig if orig else 0.0) * (0.5 if n < 2 else 1.0)
    # adaptive threshold: a bar is weak RELATIVE to the song's own norm --
    # fixed thresholds over-replace clean songs and under-replace dense ones
    med = float(np.median(list(surv.values()))) if surv else 0.0
    thr = min(WEAK, med * float(os.environ.get("WEAKREL", "0.85")))
    for i in range(nbars):
        if i not in surv: continue                     # silence stays silent
        if surv[i] >= thr: continue
        # weak bar -> best chart chord from the bar's own (pre-repair) pc energy
        hist = np.zeros(12)
        for sl, grp in bars[i].items():
            for p, v in grp: hist[p % 12] += v
        if hist.sum() == 0: continue
        hist = hist / np.linalg.norm(hist)
        pcs = CHORDS[int(np.argmax(masks @ hist))]
        root = pcs[0]
        bass = 40 + ((root - 40) % 12)
        tones = [52 + ((pc - 52) % 12) for pc in pcs[1:3]]
        nb = defaultdict(list)
        for beat in range(BPB):                        # even rhythm: every beat
            sl = beat * 4
            nb[sl].append((bass, 70))
            for t2 in tones: nb[sl].append((t2, 60))
        repaired[i] = nb
        replaced += 1
    print(f"hybrid: {replaced}/{nbars} weak bars -> even-rhythm chords")

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

# --- self-confidence metrics (no ground truth needed; calibrated vs GT songs) ---
cons_num = cons_den = 0
for l, idx in clusters.items():
    n = len(idx)
    if n < 2: continue
    votes, _ = cluster_votes(idx)
    for i in idx:
        for sl, grp in repaired[i].items():
            for p, v in grp:
                cons_num += votes.get((sl, p % 12), 0) / n
                cons_den += 1
consensus = cons_num / cons_den if cons_den else 0.0
big = sum(len(idx) for idx in clusters.values() if len(idx) >= 3)
coverage = big / nbars if nbars else 0.0
grid_cv = float(np.std(np.diff(bt)) / (np.median(np.diff(bt)) + 1e-9))
conf = {"consensus": round(consensus, 3), "coverage": round(coverage, 3),
        "grid_cv": round(grid_cv, 3), "bar_types": len(clusters), "bars": nbars,
        "density": round(len(notes) / max(1, nbars), 1)}

json.dump({"tempo": round(bpm, 1), "notes": out, "conf": conf}, open(outf, "w"))
print(f"bpm {bpm:.0f} | {len(notes)} notes | {nbars} bars, {len(clusters)} bar-types | "
      f"{len(out)} onsets ({sum(len(o['m']) for o in out)} guitar notes) | conf {conf}")
