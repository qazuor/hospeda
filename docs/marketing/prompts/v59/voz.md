# V59 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Aunque las cuatro tomas llevan su propio lip sync**, el audio final del video sale
enteramente de esta tirada — igual que en el resto de la serie —, no del audio que
traen las tiradas de imagen.

**El guion completo son 11,6 s hablados** más tres pausas cortas, lo que entra dentro
del límite de 15 s de una sola generación de Hailuo: no hace falta partirlo en dos
tiradas.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**.

---

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 |
| `@######ESCENA32#######` | `../../escenas/escena32.png` | 1 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 14 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like — with a light, knowing playfulness on the third sentence only.

THE PICTURE: start from @######ESCENA32####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with three short pauses between the four sentences. He is ALREADY SPEAKING in
the very first frame — no breath, no look, no pause before the first word. When he has
finished the last word he stops speaking completely and stays silent until the clip
ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-21% he speaks the FIRST sentence.
21-24% a SHORT pause.
24-41% he speaks the SECOND sentence.
41-44% a SHORT pause.
44-67% he speaks the THIRD sentence, with a light, knowing playfulness.
67-70% a SHORT pause.
70-91% he speaks the FOURTH sentence.
91-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 91%. Do not slow it down and do not stretch it to fill the 14
seconds.

FIRST sentence: [Spanish] El finde largo no se planea el viernes a la tarde.

SECOND sentence: [Spanish] Se planea el martes, con café de por medio.

THIRD sentence: [Spanish] El que arranca el viernes llega tarde a todo lo bueno.

FOURTH sentence: [Spanish] Elegí ahora. El resto lo resolvemos nosotros.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO river sound,
NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que las tres pausas no se sientan cortadas.**
- **Que la picardía de la tercera frase sea liviana**, sin volverse una voz de chiste.
- **Que "nosotros", la última palabra, quede completa.**

---
