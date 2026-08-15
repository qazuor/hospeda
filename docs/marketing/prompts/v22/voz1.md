# V22 · Tirada de voz — parte 1 de 2

Genera **la primera mitad de la pista de audio** del video. La imagen se descarta: sólo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md). Por qué la voz se parte en dos:
[`montaje.md`](montaje.md#por-qué-la-pista-de-voz-se-parte-en-dos).

---

**Cubre F1a, F1b y F2** — desde "Hoy un turista..." hasta "...información clara en
internet." — unos 11,3 s de las 24,9 s habladas del video entero. El corte con la
segunda parte cae en la misma costura que el montaje: T3 → T4.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, primeras
tres frases. Al generarlo, respetar las dos pausas cortas.

### De dónde sale la pista

Misma técnica que V9 y V21: una tirada de Hailuo dedicada, sólo por el audio, partiendo
de `@######ESCENA4#######` porque el modo *image to video* exige un cuadro de arranque.

**Se pide 13 s.** Los 11,3 s hablados más margen para que la última frase no se trunque,
sin acercarse al techo de 15.

**Reemplazos — 2 marcadores, 3 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA4#######` | `../../escenas/escena4.png` | 1 | el modo *image to video* exige un cuadro de partida |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 13 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA4####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, split into three sentences. He is ALREADY SPEAKING in the very first frame —
no breath, no look, no pause before the first word. When he has finished the last word
he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-27% he speaks the FIRST sentence.
27-30% a SHORT pause.
30-54% he speaks the SECOND sentence.
54-57% a SHORT pause.
57-88% he speaks the THIRD sentence.
88-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 88%. Do not slow it down, do not stretch it to fill the 13 seconds,
and do not insert any pause other than the two short ones listed above. There is no
pause inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Hoy un turista te puede encontrar buscando en Google, en
redes,

SECOND sentence: [Spanish] o preguntándole a una inteligencia artificial.

THIRD sentence: [Spanish] Por eso importa que tu negocio tenga información clara en
internet.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects,
NO reverb, NO echo. The voice is recorded close and dry, as if in a quiet room, and
nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la tercera frase esté completa.**
- **Que no haya estirado la locución** para llenar los 13 s.
- **Que el timbre coincida con `voz2.md`** cuando se escuchan una después de la otra —
  es el riesgo específico de partir la narración en dos tiradas.

---
