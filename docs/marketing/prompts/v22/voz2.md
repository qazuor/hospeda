# V22 · Tirada de voz — parte 2 de 2

Genera **la segunda mitad de la pista de audio** del video. La imagen se descarta: sólo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md). Por qué la voz se parte en dos:
[`montaje.md`](montaje.md#por-qué-la-pista-de-voz-se-parte-en-dos).

---

**Cubre F3, F4 y F5** — desde "Una publicación en Hospeda..." hasta "...que te
encuentren más." — unos 14,8 s de las 24,9 s habladas del video entero. Incluye
**la frase obligatoria del cierre**: no se acorta ni se resume.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, últimas
tres frases. Al generarlo, respetar las dos pausas cortas. F4 y F5 son una sola idea
partida por una coma, así que la pausa entre ellas es más corta que la que separa F3 de
F4.

### De dónde sale la pista

Misma técnica que `voz1.md`: una tirada de Hailuo dedicada, sólo por el audio, partiendo
de `@######ESCENA4#######`.

**Se pide 15 s** — el techo. Los 14,8 s hablados casi lo agotan, así que acá sí hace
falta pedir el máximo para no arriesgar que trunque la última frase, que es justamente
la obligatoria.

**Reemplazos — 2 marcadores, 3 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA4#######` | `../../escenas/escena4.png` | 1 | el modo *image to video* exige un cuadro de partida |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last, AND identical to how it
sounds in the first half of this same script — this is the second of two takes that get
placed back to back. Warm, clear, conversational male Argentine voice, young adult,
moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA4####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, split into three sentences. He is ALREADY SPEAKING in the very first frame —
no breath, no look, no pause before the first word. When he has finished the last word
he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-51% he speaks the FIRST sentence.
51-54% a SHORT pause.
54-74% he speaks the SECOND sentence.
74-76% a VERY SHORT pause, shorter than the first one — the second and third sentences
are one continuous thought split by a comma, not two separate ideas.
76-99% he speaks the THIRD sentence.
99-100% brief silence.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 99%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the two listed above. There is no pause inside a
sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Una publicación en Hospeda suma otra presencia asociada a tu
actividad y a tu destino, que los buscadores pueden encontrar.

SECOND sentence: [Spanish] No hay fórmulas mágicas para aparecer primero,

THIRD sentence: [Spanish] pero sí se pueden hacer las cosas bien para que te encuentren
más.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects,
NO reverb, NO echo. The voice is recorded close and dry, as if in a quiet room, and
nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la tercera frase esté completa** — es la línea obligatoria del video entero.
- **Que no haya estirado la locución** para llenar los 15 s.
- **Que el timbre coincida con `voz1.md`.**

---
