"""Shared synthesis helpers for the Hospeda tutorial audio (pure numpy/scipy, no samples)."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d, uniform_filter1d

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from marketing_paths import CHECK_DIR, PUBLIC_DIR  # noqa: E402

# Generated WAVs go outside the repo (marketing_paths.py).
AUDIO_DIR = PUBLIC_DIR / "audio"
SR = 48000
RNG = np.random.default_rng(20261026)


def mtof(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def tarr(d: float) -> np.ndarray:
    return np.arange(int(round(d * SR))) / SR


def fade(x: np.ndarray, fin: float = 0.0, fout: float = 0.0) -> np.ndarray:
    """Raised-cosine fades (seconds) on axis 0."""
    x = x.copy()
    n = len(x)
    ni, no = min(int(fin * SR), n), min(int(fout * SR), n)
    shape = (-1,) + (1,) * (x.ndim - 1)
    if ni > 0:
        x[:ni] *= (0.5 - 0.5 * np.cos(np.pi * np.arange(ni) / ni)).reshape(shape)
    if no > 0:
        x[n - no:] *= (0.5 + 0.5 * np.cos(np.pi * np.arange(no) / no)).reshape(shape)
    return x


def _filt(x, kind, fc, order=2):
    sos = signal.butter(order, fc, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def lp(x, fc, order=2):
    return _filt(x, "low", fc, order)


def hp(x, fc, order=2):
    return _filt(x, "high", fc, order)


def bp(x, lo, hi, order=2):
    return _filt(x, "band", [lo, hi], order)


def pan_stereo(mono: np.ndarray, pan: float) -> np.ndarray:
    th = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(th), mono * np.sin(th)], axis=1)


def place(buf: np.ndarray, sig: np.ndarray, start_s: float, gain: float = 1.0, wrap: bool = True) -> None:
    """Add stereo `sig` into `buf` at start_s. wrap=True makes tails wrap (loopable)."""
    n, N = len(sig), len(buf)
    s = int(round(start_s * SR))
    if wrap:
        idx = (s + np.arange(n)) % N
        buf[idx] += sig * gain
    else:
        e = min(N, s + n)
        if e > s:
            buf[s:e] += sig[: e - s] * gain


def rms_db(x: np.ndarray) -> float:
    return 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)


def true_peak_db(x: np.ndarray) -> float:
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def limiter(x: np.ndarray, ceiling_db: float, look_ms: float = 5.0) -> np.ndarray:
    """Simple look-ahead peak limiter (smoothed gain reduction)."""
    thr = 10 ** (ceiling_db / 20)
    w = max(3, int(SR * look_ms / 1000))
    pk = maximum_filter1d(np.max(np.abs(x), axis=1), size=w * 2 + 1)
    g = np.minimum(1.0, thr / np.maximum(pk, 1e-9))
    g = uniform_filter1d(g, size=w * 2 + 1)
    g = np.minimum(g, 1.0)
    return x * g[:, None]


def write_wav(path: str, x: np.ndarray) -> None:
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    sf.write(path, np.clip(x, -1, 1), SR, subtype="PCM_16")


def peak_normalize(x: np.ndarray, db: float = -6.0) -> np.ndarray:
    return x * (10 ** (db / 20) / np.max(np.abs(x)))


# ---------------------------------------------------------------- instruments

def marimba(f: float, vel: float = 1.0, dur: float = 1.4) -> np.ndarray:
    """Mono marimba-like bar: 1 : 3.99 : 9.9 partials + soft mallet thump."""
    t = tarr(dur)
    d0 = 2.8 + f / 220.0
    y = np.zeros_like(t)
    for r, a, d in ((1.0, 1.0, d0), (3.99, 0.28, d0 * 3.0), (9.9, 0.06, d0 * 7.0)):
        if f * r < 11000:
            y += a * np.sin(2 * np.pi * f * r * t) * np.exp(-d * t)
    y *= 1 - np.exp(-t / 0.0018)
    thump = lp(RNG.standard_normal(len(t)) * np.exp(-t / 0.004), 2200)
    y += 0.10 * thump
    return fade(y, 0, 0.04) * vel


def pluck(f: float, vel: float = 1.0, dur: float = 1.6) -> np.ndarray:
    """Stereo soft pluck lead: 3 detuned copies, harmonics that decay faster (filter-envelope feel)."""
    t = tarr(dur)
    out = np.zeros((len(t), 2))
    for cents, pan in ((-6, -0.4), (6, 0.4), (0, 0.0)):
        ff = f * 2 ** (cents / 1200)
        y = np.zeros_like(t)
        ph = RNG.uniform(0, 2 * np.pi)
        for k in range(1, 8):
            if ff * k > 8000:
                break
            y += (1 / k**1.35) * np.sin(2 * np.pi * ff * k * t + ph * k) * np.exp(-(3.0 + 2.0 * k) * t)
        y *= 1 - np.exp(-t / 0.004)
        out += pan_stereo(y, pan)
    return fade(out, 0, 0.06) * vel * 0.45


def pad(midis, dur: float, att: float = 0.3, rel: float = 0.5, brightness: float = 1400.0) -> np.ndarray:
    """Warm stereo pad: detuned band-limited saws (additive), rolled off, slow LFO. RMS-normalised to ~0.08."""
    t = tarr(dur)
    out = np.zeros((len(t), 2))
    cents = (-14, -7, 0, 7, 14)
    pans = (-0.8, -0.4, 0.0, 0.4, 0.8)
    for m in midis:
        f0 = mtof(m)
        for c, p in zip(cents, pans):
            f = f0 * 2 ** (c / 1200)
            ph = RNG.uniform(0, 2 * np.pi)
            lfo = 1 + 0.10 * np.sin(2 * np.pi * RNG.uniform(0.15, 0.45) * t + RNG.uniform(0, 6.28))
            y = np.zeros_like(t)
            k = 1
            while f * k < 3500:
                a = (1.0 / k) / np.sqrt(1 + (f * k / brightness) ** 4)
                y += a * np.sin(2 * np.pi * f * k * t + ph * k)
                k += 1
            out += pan_stereo(y * lfo, p)
    env = np.ones_like(t)
    na = int(att * SR)
    env[:na] = np.sin(0.5 * np.pi * np.arange(na) / na) ** 2
    nr = int(rel * SR)
    env[-nr:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(nr) / nr)
    out *= env[:, None]
    return out * (0.08 / np.sqrt(np.mean(out**2)))


def kick(vel: float = 1.0) -> np.ndarray:
    t = tarr(0.38)
    freq = 46 + 85 * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    y = np.sin(ph) * np.exp(-t / 0.11) * (1 - np.exp(-t / 0.0015))
    click = lp(RNG.standard_normal(len(t)) * np.exp(-t / 0.002), 3000) * 0.12
    y = np.tanh(1.4 * (y + click)) / 1.4
    return fade(y, 0, 0.05) * vel


def clap(vel: float = 1.0) -> np.ndarray:
    t = tarr(0.35)
    n = bp(RNG.standard_normal(len(t)), 1000, 3600)
    env = np.zeros_like(t)
    for off in (0.0, 0.009, 0.019):
        m = t >= off
        env[m] += np.exp(-(t[m] - off) / 0.006)
    env += 0.8 * np.exp(-t / 0.07) * (t >= 0.019)
    y = n * env * (1 - np.exp(-t / 0.001))
    y /= np.max(np.abs(y))
    return fade(pan_stereo(y, 0.05), 0, 0.08) * vel


def shaker(vel: float = 1.0, pan: float = 0.0) -> np.ndarray:
    t = tarr(0.08)
    n = bp(RNG.standard_normal(len(t)), 4500, 9000)
    env = (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.022)
    y = n * env
    y /= np.max(np.abs(y))
    return fade(pan_stereo(y, pan), 0, 0.02) * vel


def bass(f: float, dur: float, vel: float = 1.0) -> np.ndarray:
    t = tarr(dur + 0.05)
    y = (np.sin(2 * np.pi * f * t)
         + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6)
         + 0.12 * np.sin(6 * np.pi * f * t) * np.exp(-t * 9))
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t * 1.8)
    y = np.tanh(1.5 * y * env) / 1.5
    return fade(y, 0, 0.05) * vel


def reverb_ir(rt60: float = 1.7, seed: int = 1, damp: float = 5500.0) -> np.ndarray:
    """Stereo noise-tail impulse response with pre-delay and HF damping. Unit energy per channel."""
    rng = np.random.default_rng(seed)
    n = int((rt60 * 1.3 + 0.03) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for ch in range(2):
        x = rng.standard_normal(n)
        bright = lp(x, damp) * np.exp(-6.9 * t / rt60)
        dark = lp(x, 1200) * np.exp(-6.9 * t / (rt60 * 1.4))
        y = bright * 0.7 + dark * 0.6
        y *= np.clip((t - 0.018) / 0.012, 0, 1)  # 18 ms pre-delay with soft onset
        out[:, ch] = y / np.sqrt(np.sum(y**2))
    return out


def reverb(send: np.ndarray, ir: np.ndarray, wrap: bool = True) -> np.ndarray:
    """Convolve a stereo send; if wrap, the tail wraps to the start (loopable)."""
    n = len(send)
    wet = np.zeros((n, 2))
    for ch in range(2):
        full = signal.fftconvolve(send[:, ch], ir[:, ch])
        wet[:, ch] = full[:n]
        if wrap:
            tail = full[n:]
            wet[: len(tail), ch] += tail[: n]
    return wet
