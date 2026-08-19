# V57 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Aunque las cuatro tomas llevan su propio lip sync**, el audio final del video sale
enteramente de esta tirada — igual que en el resto de la serie —, no del audio que
traen las tiradas de imagen.

**El guion completo son 11,8 s hablados** más tres pausas cortas, lo que entra dentro
del límite de 15 s de una sola generación de Hailuo: no hace falta partirlo en dos
tiradas, a diferencia de [V40](../v40/voz1.md).

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**.

---

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 |
| `@######ESCENA35#######` | `../../escenas/escena35.png` | 1 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 14 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA35####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with three short pauses between the four sentences. He is ALREADY SPEAKING in
the very first frame — no breath, no look, no pause before the first word. When he has
finished the last word he stops speaking completely and stays silent until the clip
ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-25% he speaks the FIRST sentence.
25-28% a SHORT pause.
28-57% he speaks the SECOND sentence.
57-60% a SHORT pause.
60-75% he speaks the THIRD sentence.
75-78% a SHORT pause.
78-93% he speaks the FOURTH sentence.
93-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 93%. Do not slow it down and do not stretch it to fill the 14
seconds.

FIRST sentence: [Spanish] Viene un finde largo, y todavía no sabés qué vas a hacer.

SECOND sentence: [Spanish] A unas horas tenés río, naturaleza y pueblos para conocer.

THIRD sentence: [Spanish] Buscá, comparate opciones y elegí sin vueltas.

FOURTH sentence: [Spanish] Tres días alcanzan para desconectar.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO river sound,
NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que las tres pausas no se sientan cortadas.**
- **Que "desconectar", la última palabra, quede completa.**

---
