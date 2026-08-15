# V2 · Tirada de voz 1 de 2

Genera **la primera mitad de la pista de audio** del video. La imagen se descarta: solo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**El guion completo son 21,2 s hablados**, y Hailuo tiene un techo duro de 15 s por
tirada, así que la narración sale de **dos tiradas separadas** en vez de una sola como en
[V9](../v9/voz.md). Esta es la primera: cubre la frase que se dice en T1 más la que sigue
en off sobre T2.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, que es el
único lugar donde vive para que no haya dos copias que se desincronicen. Al generarlo,
respetar la pausa breve en el dos puntos, entre "destino" y "alojamientos".

**De dónde sale la pista**: la misma técnica que el resto de la serie — una tirada
dedicada, aparte de las de imagen, con el mismo `@######VOZ#######` que clona el timbre
de siempre. Los 59 sílabas de este tramo son ~10,4 s; **se pide 12 s**, no menos, porque
lo único que no se puede permitir es que trunque la última palabra.

**Este prompt va deliberadamente pelado.** Solo se adjuntan dos referencias:

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
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA21####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the two sentences below straight through to the camera, with a short
pause between them. He is ALREADY SPEAKING in the very first frame — no breath, no look,
no pause before the first word. When he has finished the second sentence he stops
speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-48% he speaks the FIRST sentence.
48-51% a SHORT pause.
51-89% he speaks the SECOND sentence.
89-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 89%. Do not slow it down, do not stretch it to fill the 12 seconds,
and do not insert any pause other than the one short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Creamos Hospeda para reunir en un solo lugar todo lo que
necesitás para disfrutar un destino.

SECOND sentence: [Spanish] Alojamientos, gastronomía, experiencias, eventos y lugares
para conocer.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO water sound,
NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb, NO echo.
The voice is recorded close and dry, as if in a quiet room, and nothing else is audible
at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.** Si trae ruido de fondo, no sirve: se duplicaría con
  el ambiente de las tiradas de imagen.
- **Que la segunda frase esté completa**, incluida la última palabra ("conocer").
- **Que no haya estirado la locución** para llenar los 12 s.
- **Que suene como la misma persona que [`voz2.md`](voz2.md)**: son dos generaciones
  separadas, así que hay que confirmarlo antes de dar por buena la narración completa.

---
