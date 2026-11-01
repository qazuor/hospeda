# V36 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Aunque T1 ya es una sola toma continua con las dos frases, **se genera la voz aparte de
todas formas**, con el mismo criterio que el resto del lote: así el timbre queda
garantizado incluso si T1 hay que regenerarla más de una vez hasta que la actuación
salga bien, sin que eso implique regenerar también el audio.

**Importante**: el texto de esta tirada **no lleva el nombre de ninguna ciudad** — la
voz es la misma para todas las ediciones "por destino" de V36. Lo que nombra la ciudad
es el texto en pantalla, no la voz (ver `montaje.md`).

Las dos frases suman **12,5 s** más una pausa corta, unos **12,8 s** en total. **Se pide
15 s**, el máximo, para no truncar la segunda frase.

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|:-:|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA16#######` | `../../escenas/escena16.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA16####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-35% he speaks the FIRST sentence.
35-37% a SHORT pause.
37-85% he speaks the SECOND sentence.
85-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 85%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the one short pause listed above.

FIRST sentence: [Spanish] Estamos armando la guía visual del Litoral y queremos que la
hagan los que viven acá.

SECOND sentence: [Spanish] Si tenés buenas fotos de tu ciudad, conocés un lugar que
deberíamos sumar, o encontraste algo para corregir, escribinos.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
background noise, NO music, NO sound effects, NO reverb, NO echo.
```

**Qué mirar en esta tirada:** que la segunda frase esté completa, que no haya ambiente
audible, y que el timbre no cambie de punta a punta.

---
