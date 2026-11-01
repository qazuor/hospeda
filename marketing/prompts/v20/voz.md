# V20 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Mismo método que [V9](../v9/voz.md): la voz se genera **aparte, de corrido, con el guion
entero**, y en edición se descarta el audio que devuelve Hailuo y se pone esa pista única
debajo de todo.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, con **tres**
frases. Al generarlo, respetar las dos pausas: después de F1 y después de F2.

**Se pide de 15 s** —el máximo—, aunque el guion hablado son sólo ~8,6 s: se pide de más
para no truncar la última frase.

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA21#######` | `../../escenas/escena21.png` | 1 | el modo *image to video* exige un cuadro de partida |

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
conversational male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA21####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-15% he speaks the FIRST sentence, as a question.
15-18% a SHORT pause.
18-51% he speaks the SECOND sentence.
51-54% a SHORT pause.
54-63% he speaks the THIRD sentence.
63-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 63%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the two short ones listed above. There is no
pause inside a sentence: each one is spoken in one flow.

FIRST sentence, spoken as a real question with a rising intonation at the end: [Spanish]
¿Sabés cuánta gente vio tu ficha este mes?

SECOND sentence: [Spanish] Cuántos te consultaron, cuántos te guardaron y cómo estás
respecto del resto de la zona.

THIRD sentence: [Spanish] Está todo en tu panel.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO riverside
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb, NO
echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la última frase esté completa.**
- **Que la segunda frase —la más larga del video— no se apure**: son tres datos
  seguidos (consultas, guardados, comparación con la zona) y tienen que distinguirse.
- **Que el timbre no cambie** entre la primera frase y la última.

---
