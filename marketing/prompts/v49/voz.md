# V49 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Aunque las tres tomas de Hospedín llevan su propio lip sync**, el audio final del
video sale enteramente de esta tirada — igual que en el resto de la serie —, no del
audio que traen las tiradas de imagen.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**: tres
frases, con una pausa corta entre cada una.

### De dónde sale la pista

Misma técnica que el resto de la serie: una tirada de Hailuo dedicada, sólo por el
audio, partiendo de `@######ESCENA8#######` porque el modo *image to video* exige un
cuadro de arranque.

El guion son 6,3 s hablados más dos pausas cortas, unos 6,9 s en total. **Se pide 8 s**:
deja una cola de silencio real al final sin pedirle al modelo que estire la entrega.

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre. Sin esto no hay nada |
| `@######ESCENA8#######` | `../../escenas/escena8.png` | 1 | el modo *image to video* exige un cuadro de partida |

`personaje.png`, `poses.png`, `bocas.png` y `expresiones.png` **no van**: la imagen de
este clip se descarta entera, así que da igual cómo se vea.

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 8 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA8####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks three short sentences straight through to the camera in a single
continuous delivery, with a short pause after each of the first two. He is ALREADY
SPEAKING in the very first frame — no breath, no look, no pause before the first word.
When he has finished the third and last sentence he stops speaking completely and stays
silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-24% he speaks the FIRST sentence.
24-28% a SHORT pause.
28-50% he speaks the SECOND sentence.
50-54% a SHORT pause.
54-86% he speaks the THIRD sentence.
86-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal, warm,
conversational pace — never scolding — and finishes at 86%. Do not slow it down and do
not stretch it to fill the 8 seconds.

FIRST sentence: [Spanish] Tus fotos son de hace dos veranos.

SECOND sentence: [Spanish] Se nota, y te cuesta consultas.

THIRD sentence: [Spanish] Cambialas antes de que arranque la temporada.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO carnival
percussion, NO crowd noise, NO music, NO sound effects, NO reverb, NO echo. The voice is
recorded close and dry, as if in a quiet room, and nothing else is audible at any point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que el tono sea de colega que avisa, nunca de reto** — es el criterio de contenido
  más importante de todo el video.
- **Que las dos pausas no se sientan cortadas.**
- **Que "temporada", la última palabra, quede completa.**
- **Que el timbre sea el mismo Hospedín de siempre.**

---
