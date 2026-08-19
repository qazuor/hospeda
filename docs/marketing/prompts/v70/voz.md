# V70 · Tirada de voz

Genera **la pista de audio de T1 y T2**. La imagen se descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué es una sola tirada

**El guion completo son 6,8 s hablados**, bien por debajo del límite de 15 s de una
sola generación de Hailuo.

**S1 se usa como voz en off sobre T1** —que no tiene lip sync, porque el fondo 41 es un
plano general y a esa escala la boca no se lee— y **S2 se usa sincronizada sobre T2**.
El audio final del video sale enteramente de esta tirada en los dos casos, no del audio
que traen las tiradas de imagen.

---

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 |
| `@######ESCENA41#######` | `../../escenas/escena41.png` | 1 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 10 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA41####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the
last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-33% he speaks the FIRST sentence.
33-40% a SHORT pause.
40-75% he speaks the SECOND sentence.
75-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 75%. Do not slow it down and do not stretch it to fill the 10
seconds.

FIRST sentence: [Spanish] Marzo en el Litoral tiene menos gente y el mismo río.

SECOND sentence: [Spanish] Los que se van justo antes se pierden lo mejor de la
temporada.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO water sound,
NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la pausa entre las dos frases no se sienta cortada.**
- **Que "temporada", la última palabra, quede completa.**

---
