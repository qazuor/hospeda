"""Outro sting: pickup flourish G5-A5-B5 resolving to a C major chord + soft impact at t=0.409 s. 2.5 s."""
from __future__ import annotations

import numpy as np
import pyloudnorm as pyln

import common as C

SR = C.SR
BEAT = 60 / 110
S16 = BEAT / 4
DUR = 2.5
N = int(DUR * SR)
IMPACT = 3 * S16  # 0.4091 s

dry = np.zeros((N, 2))
send = np.zeros((N, 2))

lead = np.zeros((N, 2))
for i, m in enumerate((79, 81, 83)):
    C.place(lead, C.pluck(C.mtof(m), 0.8 + 0.07 * i), i * S16, wrap=False)
# resolution: C6 pluck + rolled marimba chord
C.place(lead, C.pluck(C.mtof(84), 1.0, dur=2.2), IMPACT, wrap=False)
C.place(lead, C.pluck(C.mtof(76), 0.7, dur=2.2), IMPACT + 0.03, wrap=False)

arp = np.zeros((N, 2))
for i, m in enumerate((60, 64, 67, 72, 76)):
    C.place(arp, C.pan_stereo(C.marimba(C.mtof(m), 0.9 - 0.05 * i, dur=1.8), -0.2 + 0.1 * i), IMPACT + i * 0.022, wrap=False)

padc = C.pad([48, 55, 60, 64, 67, 72], DUR - IMPACT + 0.1, att=0.12, rel=1.2)
pads = np.zeros((N, 2))
C.place(pads, padc, IMPACT - 0.05, wrap=False)

# soft impact: sub drop + low noise puff
t = C.tarr(0.9)
sub = np.sin(2 * np.pi * np.cumsum(48 + 60 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.22) * (1 - np.exp(-t / 0.004))
puff = C.lp(C.RNG.standard_normal(len(t)), 700) * np.exp(-t / 0.05) * 0.25
imp = np.tanh(1.2 * (sub + puff)) / 1.2
imp_st = C.fade(np.stack([imp, imp], 1), 0, 0.1)
bass = np.zeros((N, 2))
C.place(bass, imp_st, IMPACT - 0.004, wrap=False)

dry = lead * 0.20 + arp * 0.20 + pads * 0.55 + bass * 0.30
send = C.hp(lead * 0.20 * 0.5 + arp * 0.20 * 0.4 + pads * 0.55 * 0.25, 220)
wet = C.reverb(send, C.reverb_ir(1.6, seed=5), wrap=False)
mix = dry + 0.55 * wet
mix = C.hp(mix, 35)
mix = C.lp(mix, 11000)
mix = C.fade(mix, 0.003, 0.5)

meter = pyln.Meter(SR)
for it in range(4):
    lufs = meter.integrated_loudness(mix)
    mix *= 10 ** ((-16.0 - lufs) / 20)
    if C.true_peak_db(mix) <= -1.2:
        break
    mix = C.limiter(mix, -1.6)
mix = C.fade(mix, 0.003, 0.5)
print("sting LUFS", meter.integrated_loudness(mix), "TP", C.true_peak_db(mix))
C.write_wav(str(C.AUDIO_DIR / "outro-sting.wav"), mix)
