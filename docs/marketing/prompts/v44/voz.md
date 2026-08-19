# V44 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Ninguna toma de Hospedín está lip-synced** — es patrón C de punta a punta —, así que
el 100% de lo que se escucha en este video sale de esta tirada.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Al
generarlo, respetar las pausas entre las cinco frases.

### De dónde sale la pista

Misma técnica que [V21](../v21/voz.md) y [V38](../v38/voz.md): una tirada de Hailuo
dedicada, sólo por el audio, partiendo de `@######ESCENA6#######` porque el modo *image
to video* exige un cuadro de arranque.

El guion son 12,6 s hablados más cuatro pausas cortas, unos 13,4 s en total. **Se pide
15 s** —el máximo—: da el margen más grande posible para que no trunque la última
palabra sin que sobre demasiado.

**Este prompt va deliberadamente pelado.** Solo se adjuntan dos referencias:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre. Sin esto no hay nada |
| `@######ESCENA6#######` | `../../escenas/escena6.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

`personaje.png`, `poses.png`, `bocas.png` y `expresiones.png` **no van**: la imagen de
este clip se descarta entera, así que da igual cómo se vea.

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

THE PICTURE: start from @######ESCENA6####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with four short pauses between the five sentences. He is ALREADY SPEAKING in
the very first frame — no breath, no look, no pause before the first word. When he has
finished the last word he stops speaking completely and stays silent until the clip
ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-15% he speaks the FIRST sentence.
15-17% a SHORT pause.
17-30% he speaks the SECOND sentence.
30-32% a SHORT pause.
32-45% he speaks the THIRD sentence.
45-47% a SHORT pause.
47-61% he speaks the FOURTH sentence.
61-63% a SHORT pause.
63-89% he speaks the FIFTH sentence.
89-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 89%. Do not slow it down and do not stretch it to fill the 15
seconds.

FIRST sentence: [Spanish] Cuatro cosas que asumís mal de Hospeda:

SECOND sentence: [Spanish] ¿Hace falta ser una empresa? No.

THIRD sentence: [Spanish] ¿Hay que registrarte para mirar? No.

FOURTH sentence: [Spanish] ¿Es sólo para alojamientos grandes? No.

FIFTH sentence: [Spanish] ¿No se puede probar gratis? Sí se puede: no se cobra nada por
treinta días.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO water sound,
NO steam, NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo.
The voice is recorded close and dry, as if in a quiet room, and nothing else is audible
at any point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que las cuatro pausas entre frases salgan parejas** — ni tan cortas que se
  atropellen, ni tan largas que rompan el ritmo de ráfaga —, porque cada una tiene que
  quedar sincronizada con una reacción distinta de T2.
- **Que las tres primeras respuestas ("No") suenen con el mismo tono**, y que la cuarta
  ("Sí se puede") suene visiblemente más cálida, no apurada.
- **Que "días", la última palabra, quede completa.**

---
