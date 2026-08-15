# V5 · Tirada de voz 1 de 2

Genera **la primera mitad de la pista de audio** del video. La imagen se descarta: solo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Cubre la frase que se dice en T1 más la que sigue en off al entrar en el hueco de
material real. Se parte en dos tiradas porque el guion tiene una costura natural justo
ahí — el momento en que Hospedín le cede el cuadro.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Los 46
sílabas de este tramo son ~8,1 s; **se pide 10 s**.

**Este prompt va deliberadamente pelado.** Solo se adjuntan dos referencias:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA1#######` | `../../escenas/escena1.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 10 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA1####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the sentence below straight through to the camera. He is ALREADY
SPEAKING in the very first frame — no breath, no look, no pause before the first word.
When he has finished he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-81% he speaks the sentence, at a normal conversational pace.
81-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery finishes at 81%. Do not slow it
down and do not stretch it to fill the 10 seconds. There is no pause inside the
sentence: it is spoken in one flow.

SENTENCE: [Spanish] Atrás de Hospeda hay una persona de la región, que alquila para
turismo hace años y conoce los problemas del rubro de primera mano.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
birds, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice is
recorded close and dry, as if in a quiet room, and nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la frase esté completa**, incluida la última palabra ("mano").
- **Que no haya estirado la locución** para llenar los 10 s.
- **Que suene como la misma persona que [`voz2.md`](voz2.md)**.

---
