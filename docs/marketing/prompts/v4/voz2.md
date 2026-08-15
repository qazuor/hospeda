# V4 · Tirada de voz 2 de 2

Genera **la segunda mitad de la pista de audio** del video. La imagen se descarta: solo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Continúa donde termina [`voz1.md`](voz1.md). Cubre las dos frases que suenan en off sobre
T3, la resolución del problema.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Los 61
sílabas de este tramo son ~10,7 s; **se pide 12 s**.

**Este prompt va deliberadamente pelado**, igual que el anterior:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA17#######` | `../../escenas/escena17.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 12 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last — and identical to the
companion tirada for this video. Warm, clear, conversational male Argentine voice, young
adult, moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA17####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the two sentences below straight through to the camera, with a short
pause between them. He is ALREADY SPEAKING in the very first frame — no breath, no look,
no pause before the first word. When he has finished the second sentence he stops
speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-20% he speaks the FIRST sentence.
20-23% a SHORT pause.
23-91% he speaks the SECOND sentence.
91-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 91%. Do not slow it down, do not stretch it to fill the 12 seconds,
and do not insert any pause other than the one short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Hospeda nació para ordenar todo eso.

SECOND sentence: [Spanish] Queremos que cada destino tenga su oferta turística en un
mismo lugar, y que los negocios de la zona tengan una forma nueva de mostrarse.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
birds, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice is
recorded close and dry, as if in a quiet room, and nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la última frase esté completa**, incluida la palabra final ("mostrarse").
- **Que no haya estirado la locución** para llenar los 12 s.
- **Que suene como la misma persona que [`voz1.md`](voz1.md)**.

---
