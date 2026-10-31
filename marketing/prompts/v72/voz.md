# V72 · Tirada de voz (fija para toda la plantilla)

Genera **la pista de audio de T1 y T2**. La imagen se descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué es una sola tirada, y por qué es fija

**El guion completo son 5,8 s hablados**, bien por debajo del límite de 15 s de una
sola generación de Hailuo. **Esta tirada se genera una sola vez y sirve para todas las
ediciones de la plantilla**: no menciona ningún tema ni ningún lugar, así que no hace
falta regenerarla cuando cambia el contenido de las tarjetas de T2.

Ni T1 ni T2 llevan lip sync —el patrón C no hace hablar a Hospedín en ningún momento—,
así que esta tirada es la única fuente de voz de todo el video.

---

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 |
| `@######ESCENA20#######` | `../../escenas/escena20.png` | 1 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 8 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA20####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the
last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-31% he speaks the FIRST sentence.
31-38% a SHORT pause.
38-79% he speaks the SECOND sentence.
79-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 79%. Do not slow it down and do not stretch it to fill the 8
seconds.

FIRST sentence: [Spanish] Tres opciones, para arrancar por algún lado.

SECOND sentence: [Spanish] Elegidas por gente que conoce la zona, no por un ranking.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
birdsong, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The
voice is recorded close and dry, as if in a quiet room, and nothing else is audible at
any point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la pausa entre las dos frases no se sienta cortada.**
- **Que "ranking", la última palabra, quede completa.**
- **Que no se mencione ningún tema ni ningún lugar**: esta tirada es fija para toda la
  plantilla, así que cualquier nombre propio que se cuele obliga a regenerarla.

---
