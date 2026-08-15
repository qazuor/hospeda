# V21 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

En V21 esto pesa más que de costumbre: **ninguna** toma de Hospedín está lip-synced —es
patrón C de punta a punta—, así que el 100% de lo que se escucha sale de esta tirada, no
sólo la mayoría.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Al
generarlo, respetar la pausa después de F1.

### De dónde sale la pista

Misma técnica que [V9](../v9/voz.md): una tirada de Hailuo dedicada, sólo por el audio,
partiendo de `@######ESCENA17#######` porque el modo *image to video* exige un cuadro de
arranque.

El guion son 7,4 s hablados más una pausa corta, unos 7,8 s en total. **Se pide 10 s**
—no menos—: da margen de sobra para que no trunque la última frase sin desperdiciar
tanto como pedir el máximo de 15.

**Este prompt va deliberadamente pelado.** Solo se adjuntan dos referencias:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre. Sin esto no hay nada |
| `@######ESCENA17#######` | `../../escenas/escena17.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

`personaje.png`, `poses.png`, `bocas.png` y `expresiones.png` **no van**: la imagen de
este clip se descarta entera, así que da igual cómo se vea.

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
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-21% he speaks the FIRST sentence.
21-24% a SHORT pause.
24-77% he speaks the SECOND sentence.
77-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 77%. Do not slow it down, do not stretch it to fill the 10 seconds,
and do not insert any pause other than the one short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Los cobros los maneja Mercado Pago.

SECOND sentence: [Spanish] Pagás con tarjeta o con plata de tu cuenta, y nosotros no
guardamos los datos de tu tarjeta.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO beach sound,
NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.** Si trae ruido de fondo, no sirve para ponerla debajo
  de las dos tomas silenciosas.
- **Que la segunda frase esté completa.** Es la más larga y la que lleva el dato
  sensible ("no guardamos los datos de tu tarjeta"): es lo único irrecuperable en
  edición.
- **Que no haya estirado la locución** para llenar los 10 s.
- **Que el timbre no cambie** entre la primera frase y la última.

---
