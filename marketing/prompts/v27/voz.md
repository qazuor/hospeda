# V27 · Tiradas de voz

Genera **la pista de audio de todo el video** — la imagen se descarta, sólo se usa la
voz. Igual que en [`v9/voz.md`](../v9/voz.md).

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué son dos tiradas, no una

Las dos oraciones del guion son **8,25 s y 7,19 s**. Juntas, con la pausa entre medio,
suman **~15,9 s** — por encima del techo de 15 s de Hailuo por apenas un margen, pero por
encima al fin. No hay forma de generarlas juntas sin arriesgar que la segunda oración se
trunque, que es lo único irrecuperable en edición. Por eso **cada oración es su propia
tirada**, clonando el mismo `@######VOZ#######` en las dos.

| Parte | Cubre | Sílabas | Dura | Se pide |
|---|---|:-:|:-:|:-:|
| **A** | Oración 1 completa | 47 | 8,25 s | 12 s |
| **B** | Oración 2 completa | 41 | 7,19 s | 12 s |

**En edición se descarta el audio de las dos tiradas de imagen** (T1, T4) y se reemplaza
por estas dos pistas, cortadas y puestas en su lugar según la tabla
["Dónde cae cada frase de la voz"](montaje.md#dónde-cae-cada-frase-de-la-voz) del
montaje.

---

## Parte A — Oración 1

**Reemplazos — 2 marcadores, 6 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | clona el timbre |
| `@######ESCENA12#######` | `../../escenas/escena12.png` | 2 | cuadro de partida para *image to video* |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 12 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA12####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole sentence straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely and
stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-69% he speaks the sentence, at a normal conversational pace.
69-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. Do not slow it down and do not stretch it to
fill the 12 seconds. There is no pause inside the sentence: it is spoken in one flow.

SENTENCE: [Spanish] Si ofrecés paseos, excursiones, pesca, alquiler de bicicletas,
actividades en el agua o visitas guiadas, queremos que estés en Hospeda.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO river sound, NO
water, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb, NO
echo. The voice is recorded close and dry, as if in a quiet room.
```

---

## Parte B — Oración 2

**Reemplazos — 2 marcadores, 6 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | clona el timbre |
| `@######ESCENA12#######` | `../../escenas/escena12.png` | 2 | cuadro de partida para *image to video* |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 12 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, matching the same voice used in Part A of this video. Warm, clear, conversational
male Argentine voice, young adult, moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA12####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole sentence straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely and
stays silent until the clip ends.

TIMING, as fractions of the shot:
0-60% he speaks the sentence, at a normal conversational pace.
60-100% SILENCE until the end.

SENTENCE: [Spanish] Porque el viaje no termina cuando encontrás alojamiento: queremos
mostrar también todo lo que se puede hacer una vez que llegás.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO river sound, NO
water, NO wind, NO music, NO sound effects, NO reverb, NO echo.
```

---

**Qué mirar en las dos tiradas:**

- **Que no haya ambiente audible** en ninguna de las dos.
- **Que la última frase de cada parte esté completa.**
- **Que el timbre de la parte B sea indistinguible del de la parte A.**

---
