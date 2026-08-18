# V31 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Igual que en V9, la voz se genera **una sola vez, de corrido, con el guion entero**, y
en edición se descarta el audio que devuelve Hailuo y se pone esa pista única debajo de
todo. **El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, que es
el único lugar donde vive.

Los tres frases habladas suman **10,9 s** más dos pausas cortas, unos **11,3 s** en
total — bien por debajo del techo de Hailuo. **Se pide 15 s** —el máximo, no menos—
porque lo único que no se puede permitir es que trunque la última frase; el sobrante se
recorta y el video se descarta entero, sólo se usa el audio.

**Este prompt va deliberadamente pelado**, igual que el de V9: solo se adjuntan dos
referencias.

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|:-:|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA13#######` | `../../escenas/escena13.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

`personaje.png`, `poses.png`, `bocas.png` y `expresiones.png` **no van**: la imagen de
este clip se descarta entera.

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA13####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-29% he speaks the FIRST sentence.
29-31% a SHORT pause.
31-48% he speaks the SECOND sentence.
48-49% a SHORT pause.
49-75% he speaks the THIRD sentence.
75-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 75%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the two short ones listed above. There is no
pause inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Mientras organizás el viaje encontrás varias opciones que
querés comparar después.

SECOND sentence: [Spanish] Guardalas en favoritos y tenelas a mano.

THIRD sentence: [Spanish] Una cosa menos para acordarte entre veinte pestañas abiertas.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO beach sound,
NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.** Si trae ruido de fondo de playa, se duplica con el
  ambiente de las tomas T1 y T3. Regenerar antes que intentar limpiarla.
- **Que la última frase esté completa.** Es lo único irrecuperable en edición.
- **Que el timbre no cambie** entre la primera frase y la última.

---
