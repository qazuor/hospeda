# V60 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Ninguna** toma de Hospedín está lip-synced en este video —L en la apertura, C en el
resto—, así que el 100% de lo que se escucha sale de esta tirada.

**El texto es el de [El mensaje](montaje.md#el-mensaje)**. Al generarlo, respetar la
pausa entre F1 y F2.

### De dónde sale la pista

Misma técnica que [V21](../v21/voz.md): una tirada de Hailuo dedicada, sólo por el
audio, partiendo de `@######ESCENA40#######` porque el modo *image to video* exige un
cuadro de arranque.

El guion son 6,7 s hablados más una pausa corta, unos 7,1 s en total. **Se pide 9 s** —da
margen de sobra sin desperdiciar tanto como pedir el máximo de 15.

**Este prompt va deliberadamente pelado.** Solo se adjuntan dos referencias:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre. Sin esto no hay nada |
| `@######ESCENA40#######` | `../../escenas/escena40.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

`personaje.png`, `poses.png`, `bocas.png` y `expresiones.png` **no van**: la imagen de
este clip se descarta entera, así que da igual cómo se vea.

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 9 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA40####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the
last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-37% he speaks the FIRST sentence.
37-41% a SHORT pause.
41-78% he speaks the SECOND sentence.
78-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 78%. Do not slow it down and do not stretch it to fill the 9
seconds.

FIRST sentence: [Spanish] A veces lo que buscás está mucho más cerca de lo que pensás.

SECOND sentence: [Spanish] No hace falta ir lejos para tener un buen fin de semana.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
birds, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice is
recorded close and dry, as if in a quiet room, and nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la pausa entre F1 y F2 no se sienta cortada.**
- **Que "semana", la última palabra, quede completa.**

---
