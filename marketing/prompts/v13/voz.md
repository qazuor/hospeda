# V13 · Tirada de voz — en dos partes

Genera **la pista de audio de todo el video**. La imagen se descarta: sólo se usa la
voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué son dos tiradas y no una

En V9 y en V12 el guion entero entra en los 15 s máximos de Hailuo. Acá no: **S1 + S2

+ S3 son 14,9 s hablados**, y sumando las pausas naturales entre oraciones se pasa del
límite de 15 s de una sola generación. Pedir una tirada más larga no es una opción — 15
s es un techo duro del modelo, no una preferencia de producción.

**La solución es partir el guion en dos tiradas**, cada una dentro del límite, cortando
justo donde el video **ya tiene un corte de cámara real**: el pase de T2 a T3, en
21,5 s. Así el empalme entre las dos pistas de audio cae exactamente sobre un corte
visual, y no hay forma de que se note la costura.

+ **Parte A** — S1 y S2, para el tramo T1–T2 (0,0 a 21,5 s del video).
+ **Parte B** — S3 sola, para T3 (21,5 a 26,0 s del video).

Cada parte se genera, se descarta la imagen, y en edición se pega cada pista debajo de
su tramo correspondiente — igual que en V9, **la pista se corta entre frases y cada una
se posiciona en su lugar**, no se pega como bloque único.

---

## Parte A — S1 y S2

**Reemplazos — 2 marcadores, 6 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 |
| `@######ESCENA22#######` | `../../escenas/escena22.png` | 2 |

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

THE PICTURE: start from @######ESCENA22####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-39% he speaks the FIRST sentence.
39-42% a SHORT pause.
42-76% he speaks the SECOND sentence.
76-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 76%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Queremos que Hospeda sirva tanto al que alquila un
departamento como a un complejo o un hotel.

SECOND sentence: [Spanish] Por eso hay distintos planes, con opciones accesibles según
lo que necesite cada uno.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO beach sound,
NO water, NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo.
The voice is recorded close and dry, as if in a quiet room, and nothing else is audible
at any point.
```

---

## Parte B — S3

**Reemplazos — 2 marcadores, 6 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 |
| `@######ESCENA22#######` | `../../escenas/escena22.png` | 2 |

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

THE PICTURE: start from @######ESCENA22####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the sentence straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-27% he speaks the sentence.
27-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 27%. Do not slow it down and do not stretch it to fill the 15
seconds.

THE SENTENCE: [Spanish] No hace falta ser una gran empresa para tener presencia
profesional.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO beach sound,
NO water, NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo.
The voice is recorded close and dry, as if in a quiet room, and nothing else is audible
at any point.
```

---

**Qué mirar en las dos tiradas:**

+ **Que no haya ambiente audible** en ninguna de las dos.
+ **Que la Parte A no trunque "cada uno"** ni la Parte B trunque "profesional": son las
  últimas palabras de cada pista, y son irrecuperables en edición.
+ **Que el timbre de la Parte B sea idéntico al de la Parte A** — al ser dos
  generaciones separadas, es el punto donde más fácil se nota una deriva de voz.
+ **Que ninguna de las dos haya estirado la locución** para llenar los 15 s.

---
