# V24 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Las tres frases del guion son 13,5 s hablados más dos pausas cortas, unos 14,1 s en
total — entran justas en una sola tirada de Hailuo, a diferencia de V22 y V23, que
tuvieron que partirse en dos.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Al
generarlo, respetar las dos pausas.

### De dónde sale la pista

Misma técnica que el resto de la serie: una tirada de Hailuo dedicada, sólo por el
audio, partiendo de `@######ESCENA15#######` porque el modo *image to video* exige un
cuadro de arranque.

**Se pide el máximo, 15 s** — el guion casi lo agota (14,1 de 15), así que acá sí hace
falta pedir el techo para no arriesgar que trunque la última frase.

**Reemplazos — 2 marcadores, 3 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA15#######` | `../../escenas/escena15.png` | 1 | el modo *image to video* exige un cuadro de partida |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like — the tone of one host giving another a practical tip, not a
lecture.

THE PICTURE: start from @######ESCENA15####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-20% he speaks the FIRST sentence.
20-22% a SHORT pause.
22-58% he speaks the SECOND sentence.
58-60% a SHORT pause.
60-94% he speaks the THIRD sentence.
94-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 94%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the two short ones listed above. There is no
pause inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Las fotos son lo que más pesa en la primera impresión.

SECOND sentence: [Spanish] Usá buena luz, mostrá todos los ambientes, y no llenes la
publicación con diez fotos casi iguales.

THIRD sentence: [Spanish] No hace falta ser fotógrafo para mejorar muchísimo cómo se ve
tu alojamiento.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects,
NO reverb, NO echo. The voice is recorded close and dry, as if in a quiet room, and
nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la tercera frase esté completa.**
- **Que no haya estirado la locución** para llenar los 15 s — con el guion ocupando el
  94% del clip, el margen para que se estire es corto.
- **Que el timbre no cambie** entre la primera frase y la última.

---
