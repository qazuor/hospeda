# V63 · Tirada de voz

Genera **la pista de audio de T1, T2 y T3**. La imagen se descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué es una sola tirada

**El guion completo son 11,8 s hablados**, por debajo del límite de 15 s de una sola
generación de Hailuo, así que no hace falta partirlo en dos tiradas.

**Aunque las tres tomas llevan su propio lip sync**, el audio final del video sale
enteramente de esta tirada — igual que en el resto de la serie —, no del audio que traen
las tiradas de imagen.

---

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 |
| `@######ESCENA1#######` | `../../escenas/escena1.png` | 1 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA1####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with two short pauses between the three sentences. He is ALREADY SPEAKING in
the very first frame — no breath, no look, no pause before the first word. When he has
finished the last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-30% he speaks the FIRST sentence.
30-34% a SHORT pause.
34-56% he speaks the SECOND sentence.
56-59% a SHORT pause.
59-85% he speaks the THIRD sentence.
85-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational pace
and finishes at 85%. Do not slow it down and do not stretch it to fill the 15 seconds.

FIRST sentence: [Spanish] Esto es para el plomero, el electricista, el que arregla lo
que se rompe.

SECOND sentence: [Spanish] Un alojamiento que te llama una vez, te vuelve a llamar.

THIRD sentence: [Spanish] No sos una changa suelta. Sos el que ya conocen y en el que
confían.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
birdsong, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que las dos pausas entre frases no se sientan cortadas.**
- **Que "confían", la última palabra, quede completa.**

---
