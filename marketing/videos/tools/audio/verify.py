"""Measure every generated WAV, render a spectrogram, write tools/audio/README.md (in the repo)."""
from __future__ import annotations

import json
import subprocess

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pathlib import Path

from scipy import signal

import common as C

A = f"{C.AUDIO_DIR}/"
FILES = ["music", "outro-sting", "tap", "key-1", "key-2", "key-3", "whoosh", "whoosh-short", "pop", "ding", "swell"]
meter = pyln.Meter(48000)
stats = {}
for n in FILES:
    p = f"{A}{n}.wav"
    pr = json.loads(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "stream=sample_rate,channels,codec_name,bits_per_sample",
         "-show_entries", "format=duration", "-of", "json", p]))
    x, sr = sf.read(p)
    up = signal.resample_poly(x, 4, 1, axis=0)
    mono = x.mean(axis=1)
    spec = np.abs(np.fft.rfft(mono)) ** 2
    fr = np.fft.rfftfreq(len(mono), 1 / sr)
    hf = 100 * spec[fr > 8000].sum() / spec.sum()
    s = dict(
        sr=int(pr["streams"][0]["sample_rate"]), ch=pr["streams"][0]["channels"], codec=pr["streams"][0]["codec_name"],
        dur=float(pr["format"]["duration"]),
        peak=20 * np.log10(np.abs(x).max()), tp=20 * np.log10(np.abs(up).max()),
        lufs=meter.integrated_loudness(x) if len(x) / sr >= 0.4 else float("nan"),
        dc=float(x.mean()), clip=int((np.abs(x) >= 0.9999).sum()), hf=hf,
        first=float(np.abs(x[0]).max()), last=float(np.abs(x[-1]).max()),
    )
    stats[n] = s
    print(f"{n:13s} {s['sr']} {s['ch']}ch {s['codec']} {s['dur']:.4f}s peak {s['peak']:.2f} tp {s['tp']:.2f} "
          f"lufs {s['lufs']:.2f} dc {s['dc']:.1e} clip {s['clip']} >8k {s['hf']:.2f}% first {s['first']:.1e} last {s['last']:.1e}")

# Spectrogram + waveform for music
x, sr = sf.read(A + "music.wav")
m = x.mean(axis=1)
f, t, S = signal.spectrogram(m, sr, nperseg=4096, noverlap=3072)
fig, ax = plt.subplots(2, 1, figsize=(14, 8), gridspec_kw={"height_ratios": [1, 2]})
tt = np.arange(len(m)) / sr
ax[0].plot(tt[::20], m[::20], lw=0.3)
ax[0].set_xlim(0, 48)
ax[0].set_ylim(-1, 1)
ax[0].set_title("music.wav waveform (+/-1.0 = full scale)")
for b in range(23):
    ax[0].axvline(b * 4 * 60 / 110, color="r", lw=0.3)
ax[1].pcolormesh(t, f, 10 * np.log10(S + 1e-14), shading="auto", vmin=-120, vmax=-40)
ax[1].set_ylim(0, 16000)
ax[1].set_title("spectrogram (dB)")
plt.tight_layout()
C.CHECK_DIR.mkdir(parents=True, exist_ok=True)
plt.savefig(C.CHECK_DIR / "music.png", dpi=80)

# README
BEAT = 60 / 110
BAR = 4 * BEAT


def row(n, desc):
    s = stats[n]
    lufs = "n/a (too short)" if np.isnan(s["lufs"]) else f"{s['lufs']:.1f} LUFS"
    return f"| `{n}.wav` | {s['dur']*1000:.0f} ms | peak {s['peak']:.1f} dBFS, TP {s['tp']:.1f} dBTP, {lufs} | {desc} |"


chords = ["C", "G", "Am", "F"]
bars = "\n".join(
    f"| {b+1} | {b*BAR:.3f} | {(b+1)*BAR:.3f} | {chords[b%4]} | " +
    ("intro: pad + sparse marimba, no drums" if b == 0 else
     "groove + marimba arp" + (" + melody" if b >= 2 else "") + (" (melody B, higher)" if 9 <= b <= 16 else "")) + " |"
    for b in range(22))
md = f"""# Hospeda tutorial audio

All audio is synthesised by code (`tools/audio/*.py`, numpy/scipy). No samples, no downloads. 48 kHz, 16-bit, stereo WAV.
The WAVs are generated OUTSIDE the repo, in `$HOSPEDA_MARKETING_ASSETS_DIR/video-lab/public/audio/` (see `tools/marketing_paths.py`).
Regenerate: `uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python tools/audio/<music|sting|sfx>.py`

## Files

| File | Duration | Levels | Notes |
|---|---|---|---|
{row('music', 'Bed, C major, 110 BPM, 22 bars. Loopable: reverb/pad tails wrap to the start. Target -18 LUFS.')}
{row('outro-sting', 'Pickup G5-A5-B5, then C major chord + soft sub impact at t=0.409 s. Target -16 LUFS (a touch above the bed).')}
{row('tap', 'Soft UI touch click.')}
{row('key-1', 'Soft key tick (alternate with 2 and 3).')}
{row('key-2', 'Soft key tick (brighter).')}
{row('key-3', 'Soft key tick (duller).')}
{row('whoosh', 'Filtered-noise whoosh, band centre rises 350 Hz to 3.8 kHz (peak at ~45%) then falls.')}
{row('whoosh-short', 'Short whoosh variant.')}
{row('pop', 'Bubbly pop (rising sine chirp), for titles / speech bubbles.')}
{row('ding', 'Success chime, G5 then C6 at +120 ms (bell partials).')}
{row('swell', 'Riser: noise sweep + soft C-G-C-E tones. Level peaks at the very END (t=1.2 s): place so its end lands on the beat/impact.')}

SFX are peak-normalised to -6 dBFS (no LUFS target, LUFS of very short files is not meaningful).

## Music: key, tempo, timing

- Key: C major. Progression, one chord per bar: **C - G - Am - F** (x5), then C, G (bar 21-22 end on the dominant, so the loop back to C resolves).
- Tempo: 110 BPM, 4/4. Beat = {BEAT:.5f} s, bar = {BAR:.5f} s, 22 bars = 48.000 s.
- Beat `n` (0-based, global) is at `n * {BEAT:.5f}` s; bar `b` (1-based) starts at `(b-1) * {BAR:.5f}` s.
- Bar 1: soft intro, no drums, no bass. Drums, bass and arpeggio-at-full-density enter at bar 2 (t = {BAR:.3f} s).
- Melody (pluck) enters at bar 3 (t = {2*BAR:.3f} s). Bars 10-17 use a higher/busier melody B. Bars 18-22 return to melody A.
- Groove: kick on beats 1 and 3 (+ soft ghost on "and" of 2 in even-numbered bars, pickup on "and" of 4 every 4th bar), clap on beats 2 and 4, swung 16th shaker, bass on beat 1, "and" of 2, "and" of 3. Pad + bass gently ducked by the kick.
- Useful cut points: every bar line; strongest = bars 2, 3, 10, 18 (section changes). Beat grid at 110 BPM: 0.545 s per beat.
- Fade: music has no built-in fade. Fade it manually over the last 1-2 s and start `outro-sting.wav` so that its impact (t = 0.409 s into the file) lands on a bar line / final beat.

| Bar | Start (s) | End (s) | Chord | Content |
|---|---|---|---|---|
{bars}

## outro-sting timing

- Pickup notes at 0.000, 0.136, 0.273 s (16ths at 110 BPM), resolution chord + impact at **0.409 s** (3 sixteenths), rolled marimba chord C4-E4-G4-C5-E5, pad sustain, fade out from ~2.0 s to 2.5 s.
- To land the impact on a bar line at time T, start the file at T - 0.409 s.

## SFX sync notes

- `tap` transient is at t=0; `key-*` transients at t=0; `pop` onset at t=0; `ding` first note at t=0, second at 0.120 s; `whoosh` energy peaks at ~0.20 s (0.45 s file) / ~0.11 s (0.25 s file); `swell` ends at its loudest point.
"""
open(Path(__file__).resolve().parent / "README.md", "w").write(md)
print("README written")
