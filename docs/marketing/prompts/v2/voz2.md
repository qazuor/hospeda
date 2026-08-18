# V2 · Tirada de voz 2 de 2

Genera **la segunda mitad de la pista de audio** del video. La imagen se descarta: solo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Continúa donde termina [`voz1.md`](voz1.md). Cubre las dos frases que se escuchan en off
sobre T3 y T4/T5, después de las cuales el video se queda solo con música e imagen.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Los 62
sílabas de este tramo son ~10,9 s; **se pide 12 s**, el mismo margen que `voz1.md`.

**Este prompt va deliberadamente pelado**, igual que el anterior:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA21#######` | `../../escenas/escena21.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 12 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last — and identical to the
same voice used in the companion tirada for this video. Warm, clear, conversational
male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA21####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the two sentences below straight through to the camera, with a short
pause between them. He is ALREADY SPEAKING in the very first frame — no breath, no look,
no pause before the first word. When he has finished the second sentence he stops
speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-39% he speaks the FIRST sentence.
39-42% a SHORT pause.
42-93% he speaks the SECOND sentence.
93-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 93%. Do not slow it down, do not stretch it to fill the 12 seconds,
and do not insert any pause other than the one short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Podés descubrir qué hacer, dónde alojarte y contactar directo
a los prestadores.

SECOND sentence: [Spanish] Estamos empezando por Entre Ríos, y queremos que sirva tanto
al que viaja como al que vive del turismo.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO water sound,
NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb, NO echo.
The voice is recorded close and dry, as if in a quiet room, and nothing else is audible
at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la última frase esté completa**, incluida la palabra final ("turismo"): es lo
  único irrecuperable en edición.
- **Que no haya estirado la locución** para llenar los 12 s.
- **Que suene como la misma persona que [`voz1.md`](voz1.md)** — escucharlas seguidas
  antes de dar por buena la narración completa.

---
