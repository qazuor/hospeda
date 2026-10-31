# V14 · Tirada de voz — en dos partes

Genera **la pista de audio de todo el video**. La imagen se descarta: sólo se usa la
voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué son dos tiradas y no una

Igual que en V13: **S1 + S2 + S3 son 16,4 s hablados**, más pausas, lo que supera el
límite de 15 s de una sola generación de Hailuo. Se parte en dos, cortando justo donde
el video ya tiene un corte real de cámara — el pase de T2 (los rótulos) a T3 (Hospedín
de vuelta), en 12,5 s.

- **Parte A** — S1 y S2, para el tramo T1–T2 (0,0 a 12,5 s del video).
- **Parte B** — S3 sola, para T3 (12,5 a 19,0 s del video).

---

## Parte A — S1 y S2

**Reemplazos — 2 marcadores, 6 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 |
| `@######ESCENA4#######` | `../../escenas/escena4.png` | 2 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA4####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-31% he speaks the FIRST sentence.
31-34% a SHORT pause.
34-74% he speaks the SECOND sentence, enumerating four items at an even, unhurried
pace, with a very small natural gap between each one.
74-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 74%. Do not slow it down and do not stretch it to fill the 15
seconds.

FIRST sentence: [Spanish] Hospeda está empezando, y por eso este es un buen momento
para sumarte.

SECOND sentence: [Spanish] Estamos incorporando alojamientos, gastronomía,
experiencias y contenido de distintos destinos.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO river sound,
NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

---

## Parte B — S3

**Reemplazos — 2 marcadores, 6 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 |
| `@######ESCENA4#######` | `../../escenas/escena4.png` | 2 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical to the rest of this video's narration. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA4####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the sentence straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-39% he speaks the sentence.
39-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 39%. Do not slow it down and do not stretch it to fill the 15
seconds.

THE SENTENCE: [Spanish] El que se suma ahora crece con la plataforma y nos ayuda a
construir una herramienta más útil.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO river sound,
NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

---

**Qué mirar en las dos tiradas:**

- **Que no haya ambiente audible** en ninguna de las dos.
- **Que las cuatro verticales de la Parte A salgan bien separadas** —alojamientos,
  gastronomía, experiencias, contenido—, porque el corte de T2 sincroniza cada rótulo
  con su palabra: si se atropellan, el rótulo llega tarde.
- **Que la Parte B no trunque "útil"**, la última palabra.
- **Que el timbre de la Parte B sea idéntico al de la Parte A.**

---
