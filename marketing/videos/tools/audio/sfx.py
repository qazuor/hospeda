"""UI SFX set. Each file peak-normalised to -6 dBFS, stereo 48k/16-bit."""
from __future__ import annotations

import numpy as np

import common as C

SR = C.SR
RNG = np.random.default_rng(99)
OUT = f"{C.AUDIO_DIR}/"


def save(name: str, x: np.ndarray) -> None:
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    C.write_wav(OUT + name, C.peak_normalize(x, -6.0))


def tap():
    t = C.tarr(0.06)
    body = np.sin(2 * np.pi * (240 - 80 * t / 0.06) * t) * np.exp(-t / 0.012)
    tick = np.sin(2 * np.pi * 1500 * t) * np.exp(-t / 0.006) * 0.45
    n = C.bp(RNG.standard_normal(len(t)), 1800, 4500) * np.exp(-t / 0.002) * 0.5
    y = (body + tick + n) * (1 - np.exp(-t / 0.0006))
    return C.fade(y, 0, 0.015)


def key(f_body, c_lo, c_hi, decay):
    t = C.tarr(0.04)
    n = C.bp(RNG.standard_normal(len(t)), c_lo, c_hi) * np.exp(-t / decay)
    body = np.sin(2 * np.pi * f_body * t) * np.exp(-t / 0.008) * 0.6
    y = (n + body) * (1 - np.exp(-t / 0.0005))
    y = C.lp(y, 6500)
    return C.fade(y, 0, 0.012)


def whoosh(dur, lo=350.0, hi=3800.0, q=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    # rising then falling centre freq (geometric), peak at 45% of the duration
    shape = np.where(u < 0.45, u / 0.45, 1 - (u - 0.45) / 0.55 * 0.7)
    fc = lo * (hi / lo) ** (np.clip(shape, 0, 1) ** 1.2)
    amp = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.5
    out = np.zeros((n, 2))
    for ch in range(2):
        x = RNG.standard_normal(n)
        y = np.zeros(n)
        low = band = 0.0
        fcc = np.clip(fc * (1.0 if ch == 0 else 0.97), 50, 9000)
        fcoef = 2 * np.sin(np.pi * fcc / SR)
        for i in range(n):  # state-variable filter, time-varying
            low += fcoef[i] * band
            high = x[i] - low - band / q
            band += fcoef[i] * high
            y[i] = band
        out[:, ch] = y * amp
    return C.fade(C.lp(out, 6500), 0.01, 0.03)


def pop():
    t = C.tarr(0.12)
    f = 380 + 700 * (1 - np.exp(-t / 0.022))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.032) + 0.2 * np.sin(2 * ph) * np.exp(-t / 0.018)
    y *= 1 - np.exp(-t / 0.0015)
    return C.fade(y, 0, 0.03)


def bell(f, dur, vel=1.0):
    t = C.tarr(dur)
    y = np.zeros_like(t)
    for r, a, d in ((1.0, 1.0, 5.5), (2.0, 0.35, 8.0), (2.76, 0.22, 11.0), (5.4, 0.08, 18.0)):
        y += a * np.sin(2 * np.pi * f * r * t) * np.exp(-d * t)
    return y * (1 - np.exp(-t / 0.002)) * vel


def ding():
    n = int(0.7 * SR)
    out = np.zeros((n, 2))
    C.place(out, C.pan_stereo(bell(C.mtof(79), 0.7), -0.15), 0.0, wrap=False)       # G5
    C.place(out, C.pan_stereo(bell(C.mtof(84), 0.58, 1.05), 0.15), 0.12, wrap=False)  # C6
    return C.fade(out, 0, 0.12)


def swell():
    dur = 1.2
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    out = np.zeros((n, 2))
    # noise riser, exponential band sweep
    for ch in range(2):
        x = RNG.standard_normal(n)
        fc = np.clip(300 * (6500 / 300) ** u * (1 if ch == 0 else 1.03), 50, 9500)
        fcoef = 2 * np.sin(np.pi * fc / SR)
        low = band = 0.0
        y = np.zeros(n)
        for i in range(n):
            low += fcoef[i] * band
            high = x[i] - low - band / 1.4
            band += fcoef[i] * high
            y[i] = band
        out[:, ch] += y * (u**2.2) * 0.55
    # soft rising C-G-C-E tones
    for m, p in ((60, -0.4), (67, 0.4), (72, -0.2), (76, 0.2)):
        f = C.mtof(m) * (0.985 + 0.015 * u)
        ph = 2 * np.pi * np.cumsum(f) / SR
        tone = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * (u**1.8)
        out += C.pan_stereo(tone, p) * 0.16
    return C.fade(C.lp(out, 5500), 0.02, 0.03)


save("tap.wav", tap())
save("key-1.wav", key(180, 1800, 5200, 0.0035))
save("key-2.wav", key(230, 2400, 6000, 0.0030))
save("key-3.wav", key(150, 1400, 4200, 0.0040))
save("whoosh.wav", whoosh(0.45))
save("whoosh-short.wav", whoosh(0.25, 450, 4200))
save("pop.wav", pop())
save("ding.wav", ding())
save("swell.wav", swell())
print("sfx done")
