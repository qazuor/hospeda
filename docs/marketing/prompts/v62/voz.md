# V62 · Tirada de voz

Genera **la pista de audio de T1 y T2**. La imagen se descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué es una sola tirada

**El guion completo son 7,7 s hablados**, bien por debajo del límite de 15 s de una sola
generación de Hailuo, así que no hace falta partirlo en dos tiradas.

**Aunque las dos tomas llevan su propio lip sync**, el audio final del video sale
enteramente de esta tirada — igual que en el resto de la serie —, no del audio que traen
las tiradas de imagen.

---

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 |
| `@######ESCENA36#######` | `../../escenas/escena36.png` | 1 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 9 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA36####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the
last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-35% he speaks the FIRST sentence.
35-40% a SHORT pause.
40-91% he speaks the SECOND sentence.
91-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational pace
and finishes at 91%. Do not slow it down and do not stretch it to fill the 9 seconds.

FIRST sentence: [Spanish] Acá la lluvia no arruina el viaje. Lo cambia, nada más.

SECOND sentence: [Spanish] Las termas bajo la lluvia son mejores, no peores. El plan
sigue en pie, llueva o no.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO rain, NO
water sound, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The
voice is recorded close and dry, as if in a quiet room, and nothing else is audible at
any point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la pausa entre las dos frases no se sienta cortada.**
- **Que "no", la última palabra, quede completa.**

---
