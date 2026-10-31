# Hospeda tutorial audio

All audio is synthesised by code (`tools/audio/*.py`, numpy/scipy). No samples, no downloads. 48 kHz, 16-bit, stereo WAV.
The WAVs are generated OUTSIDE the repo, in `$HOSPEDA_MARKETING_ASSETS_DIR/video-lab/public/audio/` (see `tools/marketing_paths.py`).
Regenerate: `uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python tools/audio/<music|sting|sfx>.py`

## Files

| File | Duration | Levels | Notes |
|---|---|---|---|
| `music.wav` | 48000 ms | peak -3.2 dBFS, TP -3.2 dBTP, -18.0 LUFS | Bed, C major, 110 BPM, 22 bars. Loopable: reverb/pad tails wrap to the start. Target -18 LUFS. |
| `outro-sting.wav` | 2500 ms | peak -1.6 dBFS, TP -1.6 dBTP, -16.0 LUFS | Pickup G5-A5-B5, then C major chord + soft sub impact at t=0.409 s. Target -16 LUFS (a touch above the bed). |
| `tap.wav` | 60 ms | peak -6.0 dBFS, TP -6.0 dBTP, n/a (too short) | Soft UI touch click. |
| `key-1.wav` | 40 ms | peak -6.0 dBFS, TP -6.0 dBTP, n/a (too short) | Soft key tick (alternate with 2 and 3). |
| `key-2.wav` | 40 ms | peak -6.0 dBFS, TP -6.0 dBTP, n/a (too short) | Soft key tick (brighter). |
| `key-3.wav` | 40 ms | peak -6.0 dBFS, TP -6.0 dBTP, n/a (too short) | Soft key tick (duller). |
| `whoosh.wav` | 450 ms | peak -6.0 dBFS, TP -5.8 dBTP, -16.0 LUFS | Filtered-noise whoosh, band centre rises 350 Hz to 3.8 kHz (peak at ~45%) then falls. |
| `whoosh-short.wav` | 250 ms | peak -6.0 dBFS, TP -5.8 dBTP, n/a (too short) | Short whoosh variant. |
| `pop.wav` | 120 ms | peak -6.0 dBFS, TP -6.0 dBTP, n/a (too short) | Bubbly pop (rising sine chirp), for titles / speech bubbles. |
| `ding.wav` | 700 ms | peak -6.0 dBFS, TP -6.0 dBTP, -16.7 LUFS | Success chime, G5 then C6 at +120 ms (bell partials). |
| `swell.wav` | 1200 ms | peak -6.0 dBFS, TP -6.0 dBTP, -18.4 LUFS | Riser: noise sweep + soft C-G-C-E tones. Level peaks at the very END (t=1.2 s): place so its end lands on the beat/impact. |

SFX are peak-normalised to -6 dBFS (no LUFS target, LUFS of very short files is not meaningful).

## Music: key, tempo, timing

- Key: C major. Progression, one chord per bar: **C - G - Am - F** (x5), then C, G (bar 21-22 end on the dominant, so the loop back to C resolves).
- Tempo: 110 BPM, 4/4. Beat = 0.54545 s, bar = 2.18182 s, 22 bars = 48.000 s.
- Beat `n` (0-based, global) is at `n * 0.54545` s; bar `b` (1-based) starts at `(b-1) * 2.18182` s.
- Bar 1: soft intro, no drums, no bass. Drums, bass and arpeggio-at-full-density enter at bar 2 (t = 2.182 s).
- Melody (pluck) enters at bar 3 (t = 4.364 s). Bars 10-17 use a higher/busier melody B. Bars 18-22 return to melody A.
- Groove: kick on beats 1 and 3 (+ soft ghost on "and" of 2 in even-numbered bars, pickup on "and" of 4 every 4th bar), clap on beats 2 and 4, swung 16th shaker, bass on beat 1, "and" of 2, "and" of 3. Pad + bass gently ducked by the kick.
- Useful cut points: every bar line; strongest = bars 2, 3, 10, 18 (section changes). Beat grid at 110 BPM: 0.545 s per beat.
- Fade: music has no built-in fade. Fade it manually over the last 1-2 s and start `outro-sting.wav` so that its impact (t = 0.409 s into the file) lands on a bar line / final beat.

| Bar | Start (s) | End (s) | Chord | Content |
|---|---|---|---|---|
| 1 | 0.000 | 2.182 | C | intro: pad + sparse marimba, no drums |
| 2 | 2.182 | 4.364 | G | groove + marimba arp |
| 3 | 4.364 | 6.545 | Am | groove + marimba arp + melody |
| 4 | 6.545 | 8.727 | F | groove + marimba arp + melody |
| 5 | 8.727 | 10.909 | C | groove + marimba arp + melody |
| 6 | 10.909 | 13.091 | G | groove + marimba arp + melody |
| 7 | 13.091 | 15.273 | Am | groove + marimba arp + melody |
| 8 | 15.273 | 17.455 | F | groove + marimba arp + melody |
| 9 | 17.455 | 19.636 | C | groove + marimba arp + melody |
| 10 | 19.636 | 21.818 | G | groove + marimba arp + melody (melody B, higher) |
| 11 | 21.818 | 24.000 | Am | groove + marimba arp + melody (melody B, higher) |
| 12 | 24.000 | 26.182 | F | groove + marimba arp + melody (melody B, higher) |
| 13 | 26.182 | 28.364 | C | groove + marimba arp + melody (melody B, higher) |
| 14 | 28.364 | 30.545 | G | groove + marimba arp + melody (melody B, higher) |
| 15 | 30.545 | 32.727 | Am | groove + marimba arp + melody (melody B, higher) |
| 16 | 32.727 | 34.909 | F | groove + marimba arp + melody (melody B, higher) |
| 17 | 34.909 | 37.091 | C | groove + marimba arp + melody (melody B, higher) |
| 18 | 37.091 | 39.273 | G | groove + marimba arp + melody |
| 19 | 39.273 | 41.455 | Am | groove + marimba arp + melody |
| 20 | 41.455 | 43.636 | F | groove + marimba arp + melody |
| 21 | 43.636 | 45.818 | C | groove + marimba arp + melody |
| 22 | 45.818 | 48.000 | G | groove + marimba arp + melody |

## outro-sting timing

- Pickup notes at 0.000, 0.136, 0.273 s (16ths at 110 BPM), resolution chord + impact at **0.409 s** (3 sixteenths), rolled marimba chord C4-E4-G4-C5-E5, pad sustain, fade out from ~2.0 s to 2.5 s.
- To land the impact on a bar line at time T, start the file at T - 0.409 s.

## SFX sync notes

- `tap` transient is at t=0; `key-*` transients at t=0; `pop` onset at t=0; `ding` first note at t=0, second at 0.120 s; `whoosh` energy peaks at ~0.20 s (0.45 s file) / ~0.11 s (0.25 s file); `swell` ends at its loudest point.
