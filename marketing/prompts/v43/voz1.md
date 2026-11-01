# V43 · Tirada de voz — parte A (S1 + S2)

Genera **la pista de audio de T1 y T2**. La imagen se descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué son dos tiradas y no una

**El guion completo son 14,9 s hablados** más pausas, que roza el límite de 15 s de una
sola generación de Hailuo. En vez de arriesgar que la pausa entre frases empuje la
última palabra fuera del clip, se parte en dos — cortando justo donde el video ya
tiene un corte real de cámara, el pase de T2 a T3, en 10,5 s — igual que el resto de la
serie.

- **Parte A** (esta) — S1 y S2, para el tramo T1–T2 (0,0 a 10,5 s del video).
- **Parte B** — S3 y S4, para T3–T4 (ver [`voz2.md`](voz2.md)).

**Aunque T1, T3 y T4 llevan su propio lip sync**, el audio final del video sale
enteramente de estas dos tiradas — igual que en el resto de la serie —, no del audio
que traen las tiradas de imagen.

---

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 |
| `@######ESCENA17#######` | `../../escenas/escena17.png` | 1 |

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

THE PICTURE: start from @######ESCENA17####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the
last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-35% he speaks the FIRST sentence.
35-38% a SHORT pause.
38-87% he speaks the SECOND sentence, three short examples at an even, unhurried pace,
with a small natural gap after each one.
87-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 87%. Do not slow it down and do not stretch it to fill the 10
seconds.

FIRST sentence: [Spanish] Recién estamos empezando, y seguro se nos escapa algo.

SECOND sentence: [Spanish] Un dato mal cargado. Un botón que no responde. Algo que no
carga como debería.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
background noise, NO music, NO sound effects, NO reverb, NO echo. The voice is recorded
close and dry, as if in a quiet room, and nothing else is audible at any point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que los tres ejemplos de la segunda frase salgan bien separados**, porque el corte
  de T2 sincroniza cada rótulo con su ejemplo: si se atropellan, el rótulo llega tarde.
- **Que "debería", la última palabra, quede completa.**

---
