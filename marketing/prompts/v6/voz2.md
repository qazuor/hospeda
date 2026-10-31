# V6 · Tirada de voz 2 de 2

Genera **la segunda mitad de la pista de audio** del video. La imagen se descarta: solo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Continúa donde termina [`voz1.md`](voz1.md). Cubre la frase que suena en off sobre T2 y
la frase **completa** de T3 — aunque la primera mitad de esa frase también se pida
hablada dentro de [`t3.md`](t3.md) para que la boca de Hailuo se mueva bien, el audio que
de verdad se escucha en el video sale siempre de esta tirada.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Los 73
sílabas de este tramo son ~12,8 s; **se pide 15 s**, el máximo de Hailuo, porque lo único
que no se puede permitir es que trunque la última palabra del video.

**Este prompt va deliberadamente pelado**, igual que el anterior:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA4#######` | `../../escenas/escena4.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last — and identical to the
companion tirada for this video. Warm, clear, conversational male Argentine voice, young
adult, moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA4####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the two sentences below straight through to the camera, with a short
pause between them. He is ALREADY SPEAKING in the very first frame — no breath, no look,
no pause before the first word. When he has finished the second sentence he stops
speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-45% he speaks the FIRST sentence.
45-47% a SHORT pause.
47-88% he speaks the SECOND sentence, at a normal conversational pace, with no internal
pause other than the small breath between "construir," and "y queremos hacerlo".
88-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery finishes at 88%. Do not slow it
down, do not stretch it to fill the 15 seconds, and do not insert any pause other than
the one short one listed above.

FIRST sentence: [Spanish] Queremos que turistas, alojamientos, gastronómicos,
prestadores e instituciones encuentren acá un punto en común.

SECOND sentence: [Spanish] Todavía tenemos muchísimo por construir, y queremos hacerlo
con los que viven el turismo de la región.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
birds, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice is
recorded close and dry, as if in a quiet room, and nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la última frase esté completa**, incluida la palabra final ("región"): es lo
  único irrecuperable en edición, y encima es el cierre de toda la campaña de marca.
- **Que no haya estirado la locución** para llenar los 15 s.
- **Que suene como la misma persona que [`voz1.md`](voz1.md)**.

---
