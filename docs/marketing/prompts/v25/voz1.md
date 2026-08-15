# V25 · Tirada de voz — parte 1 de 2

Genera **la primera parte de la pista de audio** del video. La imagen se descarta: sólo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md). Por qué la voz se parte en dos:
[`montaje.md`](montaje.md#por-qué-la-voz-se-parte-en-dos).

---

**Cubre solo F1** — "Cuando describas tu alojamiento, no te quedes en que es hermoso,
increíble o espectacular." — 5,4 s. Es la única de las seis tiradas de voz de V21 a V25
que carga una sola frase: se corta acá porque F1 es lo único que se escucha en la toma
lip-synced de T1, y F2 arranca ya sobre la pantalla completa del tratamiento de texto.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, primera
frase.

### De dónde sale la pista

Misma técnica que el resto de la serie: una tirada de Hailuo dedicada, sólo por el
audio, partiendo de `@######ESCENA22#######`.

**Se pide 7 s.**

**Reemplazos — 2 marcadores, 3 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA22#######` | `../../escenas/escena22.png` | 1 | el modo *image to video* exige un cuadro de partida |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 7 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly. Warm, clear, conversational male Argentine voice, young adult, moderate pace,
close and friendly, not announcer-like — a touch of gentle, resigned humour on the list
of worn-out adjectives, never sharp or annoyed.

THE PICTURE: start from @######ESCENA22####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the single sentence straight through to the camera in one continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-78% he speaks the sentence.
78-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 78%. Do not slow it down and do not stretch it to fill the 7
seconds. There is no pause inside the sentence: it is spoken in one flow.

SENTENCE: [Spanish] Cuando describas tu alojamiento, no te quedes en que es hermoso,
increíble o espectacular.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO beach sound,
NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la frase esté completa.**
- **Que el timbre coincida con `voz2.md`** — acá el corte es más sensible que en V22 o
  V23, porque en el video final las dos pistas quedan pegadas dentro del mismo tramo de
  pantalla, sin un corte de imagen que disimule la costura.

---
