"""Hospeda tutorial music bed: C major, 110 BPM, 22 bars = 48.000 s. Loopable (tails wrap)."""
from __future__ import annotations

import numpy as np
import pyloudnorm as pyln
from scipy import signal

import common as C

SR = C.SR
BPM = 110
BEAT = 60.0 / BPM
BAR = 4 * BEAT
NBARS = 22
N = int(round(NBARS * BAR * SR))
rng = np.random.default_rng(7)

PAD = [[48, 55, 60, 64, 67], [47, 55, 59, 62, 67], [45, 52, 57, 60, 64], [48, 53, 57, 60, 65]]  # C G Am F
ARP = [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]]
ARP_PAT = [0, 1, 2, 3, 2, 1, 2, 1]
ARP_VEL = [1.0, 0.55, 0.75, 0.6, 0.9, 0.55, 0.72, 0.6]
BASS_ROOT = [36, 43, 45, 41]
MEL_A = [
    [(0, 76, 1.5), (1.5, 74, 0.5), (2, 72, 1), (3, 74, 1)],
    [(0, 74, 1), (1, 71, 1), (2, 74, 1.5), (3.5, 76, 0.5)],
    [(0, 72, 1.5), (1.5, 76, 0.5), (2, 81, 1), (3, 79, 1)],
    [(0, 77, 1), (1, 76, 0.5), (1.5, 72, 0.5), (2, 74, 2)],
]
MEL_B = [
    [(0, 79, 1), (1, 76, 0.5), (1.5, 79, 0.5), (2, 84, 1.5), (3.5, 83, 0.5)],
    [(0, 81, 1), (1, 79, 1), (2, 74, 1), (3, 79, 1)],
    [(0, 76, 1), (1, 81, 1), (2, 79, 0.5), (2.5, 76, 0.5), (3, 72, 1)],
    [(0, 77, 1.5), (1.5, 81, 0.5), (2, 79, 1), (3, 77, 1)],
]


def z():
    return np.zeros((N, 2))


stems = {k: z() for k in ("pad", "arp", "lead", "bass", "kick", "clap", "shaker")}
kick_times: list[float] = []

# Pads (render once per chord, place per bar; crossfade through release/attack overlap)
pads = [C.pad(ch, BAR + 0.55, att=0.32, rel=0.55) for ch in PAD]
for b in range(NBARS):
    C.place(stems["pad"], pads[b % 4], b * BAR)

for b in range(NBARS):
    t0 = b * BAR
    ci = b % 4
    # Arpeggio (marimba): intro bar is sparse and softer
    for i in range(8):
        if b == 0 and i % 2:
            continue
        swing = 0.04 * BEAT if i % 2 else 0.0
        jit = rng.normal(0, 0.002)
        vel = ARP_VEL[i] * (0.7 if b == 0 else 1.0) * rng.uniform(0.9, 1.05)
        f = C.mtof(ARP[ci][ARP_PAT[i]])
        C.place(stems["arp"], C.pan_stereo(C.marimba(f, vel), 0.2 + 0.05 * (i % 3)), t0 + i * 0.5 * BEAT + swing + jit)
    # Melody pluck
    if b >= 2:
        mel = (MEL_B if 9 <= b <= 16 else MEL_A)[ci]
        for p, m, d in mel:
            vel = rng.uniform(0.75, 1.0) * (1.0 if p in (0, 2) else 0.85)
            C.place(stems["lead"], C.pluck(C.mtof(m), vel), t0 + p * BEAT + rng.normal(0, 0.002))
    if b == 0:
        continue
    # Drums
    for p, v in ((0, 1.0), (2, 0.9)):
        C.place(stems["kick"], C.pan_stereo(C.kick(v), 0.0), t0 + p * BEAT)
        kick_times.append(t0 + p * BEAT)
    if b % 2 == 1:
        C.place(stems["kick"], C.pan_stereo(C.kick(0.4), 0.0), t0 + 1.5 * BEAT)
    if b % 4 == 3:
        C.place(stems["kick"], C.pan_stereo(C.kick(0.5), 0.0), t0 + 3.5 * BEAT)
    for p in (1, 3):
        C.place(stems["clap"], C.clap(rng.uniform(0.85, 1.0)), t0 + p * BEAT)
    sh = [0.55, 0.25, 0.42, 0.28]
    for i in range(16):
        sw = 0.14 * (BEAT / 4) if i % 2 else 0.0
        v = sh[i % 4] * rng.uniform(0.8, 1.1)
        C.place(stems["shaker"], C.shaker(v, 0.25 if i % 2 else -0.25), t0 + i * BEAT / 4 + sw + rng.normal(0, 0.0015))
    # Bass
    for p, semi, d in ((0, 0, 1.3), (1.5, 0, 0.4), (2.5, 7, 0.4)):
        f = C.mtof(BASS_ROOT[ci] + semi)
        C.place(stems["bass"], C.pan_stereo(C.bass(f, d * BEAT, rng.uniform(0.85, 1.0)), 0.0), t0 + p * BEAT)

# Sidechain-style duck on pad + bass
duck = np.zeros(N)
for kt in kick_times:
    s = int(kt * SR)
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    dip = 0.30 * np.exp(-t / 0.13) * np.clip(t / 0.004, 0, 1)
    idx = (s + np.arange(n)) % N
    duck[idx] = np.maximum(duck[idx], dip)
g = (1 - duck)[:, None]
stems["pad"] *= g
stems["bass"] *= g

GAIN = {"pad": 0.5, "arp": 0.16, "lead": 0.20, "bass": 0.25, "kick": 0.42, "clap": 0.37, "shaker": 0.15}
SEND = {"pad": 0.30, "arp": 0.35, "lead": 0.45, "bass": 0.0, "kick": 0.0, "clap": 0.55, "shaker": 0.15}
for k, v in stems.items():
    print(f"stem {k:7s} rms {C.rms_db(v * GAIN[k]):6.1f} dB  peak {20*np.log10(np.max(np.abs(v*GAIN[k]))+1e-12):6.1f}")

dry = sum(stems[k] * GAIN[k] for k in stems)
send = sum(stems[k] * GAIN[k] * SEND[k] for k in stems)
send = C.hp(send, 220)
ir = C.reverb_ir(1.7, seed=3)
wet = C.reverb(send, ir)
mix = dry + 0.55 * wet

# Master: HP 35 Hz, gentle LP 11 kHz, loudness to -18 LUFS, TP <= -1.2 dBTP
mix = C.hp(mix, 35)
mix = C.lp(mix, 11000)
meter = pyln.Meter(SR)
gain_db = 0.0
for it in range(4):
    lufs = meter.integrated_loudness(mix)
    mix = mix * 10 ** ((-18.0 - lufs) / 20)
    tp = C.true_peak_db(mix)
    print(f"iter {it}: LUFS before {lufs:.2f}  TP after gain {tp:.2f}")
    if tp <= -1.2:
        break
    mix = C.limiter(mix, -1.6)
print("final LUFS", meter.integrated_loudness(mix), "TP", C.true_peak_db(mix), "len", len(mix) / SR)
C.write_wav(str(C.AUDIO_DIR / "music.wav"), mix)
