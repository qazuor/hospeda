# V8 · Tiradas de voz

Genera **la pista de audio de todo el video**. La imagen se descarta: solo se usa la
voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Las cuatro frases de V8 suman **19,3 s de habla más tres pausas cortas (~1,05 s)**, unos
**20,3 s en total** — muy por encima del máximo de Hailuo de 15 s. Ni siquiera juntando
de a dos entra holgado: hacen falta **dos tiradas**, repartidas F1+F2 y F3+F4.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**.

**Reemplazos — 2 marcadores en las dos tiradas**, con distinto conteo en cada una
porque la segunda no repite el marcador en el bloque de `SOUND`:

| Marcador | Archivo a adjuntar | Veces en la 1ª | Veces en la 2ª |
|---|---|:-:|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | 1 |
| `@######ESCENA5#######` | `../../escenas/escena5.png` | 1 | 1 |

**Primera tirada: 3 apariciones. Segunda tirada: 2 apariciones.**

---

## Primera tirada — F1 y F2

Se pide de **11 s**: F1 y F2 juntas más la pausa son 9,65 s.

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 11 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA5####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks both sentences straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the second sentence he stops speaking
completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-38% he speaks the FIRST sentence.
38-41% a SHORT pause.
41-88% he speaks the SECOND sentence.
88-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 88%. Do not slow it down, do not stretch it to fill the 11 seconds,
and do not insert any pause other than the one short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Publicar tu alojamiento en Hospeda no es sumarlo a otro
listado.

SECOND sentence: [Spanish] Tu alojamiento pasa a formar parte de todo el contenido
turístico del destino.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

---

## Segunda tirada — F3 y F4

Se pide de **12 s**: F3 y F4 juntas más la pausa son 10,35 s.

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 12 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical to the previous tirada. Warm, clear, conversational male
Argentine voice, young adult, moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA5####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks both sentences straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the second sentence he stops speaking
completely and stays silent until the clip ends.

TIMING, as fractions of the shot:
0-58% he speaks the FIRST sentence.
58-61% a SHORT pause.
61-86% he speaks the SECOND sentence.
86-100% SILENCE until the end.

There is no pause inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] aparece cuando alguien busca dónde quedarse, cuando explora la
ciudad y cuando está armando qué hacer durante el viaje.

SECOND sentence: [Spanish] Y cuando alguien se interesa, te escribe directo.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice. Complete
silence otherwise. NO ambience, NO outdoor sound, NO wind, NO birds, NO background
noise, NO music, NO sound effects, NO reverb, NO echo.
```

**Qué mirar en las dos tiradas:**

- **Que el timbre de la segunda coincida exactamente con el de la primera.**
- **Que no haya ambiente audible** en ninguna de las dos.
- **Que la última frase de cada una esté completa** — la primera tirada tiene la frase
  más larga de todo el video (F1+F2 casi 9,3 s de habla neta), así que es la que más
  riesgo tiene de que la locución se apure o se corte.

---
