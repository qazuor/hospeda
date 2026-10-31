# V48 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Aunque las tres tomas de Hospedín llevan su propio lip sync**, el audio final del
video sale enteramente de esta tirada — igual que en el resto de la serie —, no del
audio que traen las tiradas de imagen.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**: tres frases
muy cortas, con una pausa breve entre cada una.

### De dónde sale la pista

Misma técnica que el resto de la serie: una tirada de Hailuo dedicada, sólo por el
audio, partiendo de `@######ESCENA11#######` porque el modo *image to video* exige un
cuadro de arranque.

El guion son apenas 2,5 s hablados más dos pausas cortas, unos 3,1 s en total. **Se pide
7 s**: deja bastante cola de silencio al final, sin pedirle al modelo que estire una
entrega que dura menos de un segundo por frase.

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre. Sin esto no hay nada |
| `@######ESCENA11#######` | `../../escenas/escena11.png` | 1 | el modo *image to video* exige un cuadro de partida |

`personaje.png`, `poses.png`, `bocas.png` y `expresiones.png` **no van**: la imagen de
este clip se descarta entera, así que da igual cómo se vea.

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 7 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA11####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks three very short, separate declarations straight through to the
camera, each one its own short, confident, complete statement, with a short pause after
each. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the third and last declaration he stops
speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-15% he speaks the FIRST declaration.
15-19% a SHORT pause.
19-29% he speaks the SECOND declaration.
29-33% a SHORT pause.
33-43% he speaks the THIRD declaration.
43-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. Each declaration is short, confident and at a
normal conversational pace — do not slow any of them down and do not stretch them to
fill the 7 seconds.

FIRST declaration: [Spanish] Vos ponés el precio.

SECOND declaration: [Spanish] Vos contestás.

THIRD declaration: [Spanish] Vos decidís.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO racetrack
sound, NO engines, NO crowd noise, NO music, NO sound effects, NO reverb, NO echo. The
voice is recorded close and dry, as if in a quiet room, and nothing else is audible at
any point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que las tres declaraciones salgan bien separadas**, cada una firme y completa, y no
  atropelladas entre sí — el corte de edición coloca cada una sobre su toma exacta.
- **Que "decidís", la última palabra, quede completa.**
- **Que el timbre sea el mismo Hospedín de siempre.**

---
