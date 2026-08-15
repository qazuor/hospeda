# V23 · Tirada de voz — parte 1 de 2

Genera **la primera mitad de la pista de audio** del video. La imagen se descarta: sólo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md). Por qué la voz se parte en dos:
[`montaje.md`](montaje.md#por-qué-la-voz-se-parte-en-dos).

---

**Cubre F1 a F5** — desde "¿Ya tenés Instagram…" hasta "...herramientas distintas." —
unos 10,9 s de las 19,1 s habladas del video entero. El corte con la segunda parte cae
en la misma costura del montaje: T2 → T3.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, primeras
cinco frases. Al generarlo, respetar las cuatro pausas cortas — son preguntas y
respuestas breves, así que las pausas son cortas y parejas, no una pausa larga seguida
de otras chicas.

### De dónde sale la pista

Misma técnica que V22: una tirada de Hailuo dedicada, sólo por el audio, partiendo de
`@######ESCENA4#######`.

**Se pide 13 s.**

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
not announcer-like. This is a light, quick back-and-forth — question, answer, question,
answer — so the pace stays brisk and casual, never solemn.

THE PICTURE: start from @######ESCENA4####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, split into five short sentences. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the
last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-20% he speaks the FIRST sentence.
20-23% a SHORT pause.
23-40% he speaks the SECOND sentence.
40-42% a SHORT pause.
42-52% he speaks the THIRD sentence.
52-54% a SHORT pause.
54-73% he speaks the FOURTH sentence.
73-75% a SHORT pause.
75-86% he speaks the FIFTH sentence.
86-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a brisk conversational pace
and finishes at 86%. Do not slow it down, do not stretch it to fill the 13 seconds, and
do not insert any pause other than the four short ones listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] ¿Ya tenés Instagram, Facebook o una página?

SECOND sentence: [Spanish] Perfecto, no venimos a reemplazarlos.

THIRD sentence: [Spanish] ¿Usás Airbnb o Booking?

FOURTH sentence: [Spanish] Tampoco hace falta que dejes de usarlos.

FIFTH sentence: [Spanish] Son herramientas distintas.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects,
NO reverb, NO echo. The voice is recorded close and dry, as if in a quiet room, and
nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que las cinco frases se escuchen como preguntas y respuestas cortas**, no como un
  párrafo corrido — es el tono de todo el video.
- **Que la quinta frase esté completa.**
- **Que el timbre coincida con `voz2.md`.**

---
