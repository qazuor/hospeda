# V1 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: solo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Igual que en V9: cada toma de imagen clonaría `@######VOZ#######` por su cuenta y el
timbre variaría entre toma y toma. Acá se genera **una sola vez, de corrido, con el
guion entero**, y en edición se descarta el audio de las tres tiradas de imagen y se
usa esta pista debajo de todo.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, que es el
único lugar donde vive. Al generarlo, respetar las tres pausas: después de F1, después
de F2 y después de F3.

Las cuatro frases suman **11,4 s de habla más tres pausas cortas (~1,05 s)**, unos
**12,5 s en total** — entra cómodo en el máximo de Hailuo de 15 s, así que alcanza con
**una sola tirada** (a diferencia de V7, V8 y V10, que necesitan dos).

**Se pide de 15 s** para no arriesgar que trunque la última frase; el sobrante se
recorta y el clip se descarta entero, solo se usa el audio.

**Reemplazos — 2 marcadores, 3 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA1#######` | `../../escenas/escena1.png` | 1 | el modo *image to video* exige un cuadro de partida |

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

THE PICTURE: start from @######ESCENA1####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-21% he speaks the FIRST sentence.
21-23% a SHORT pause.
23-32% he speaks the SECOND sentence.
32-34% a SHORT pause.
34-58% he speaks the THIRD sentence.
58-61% a SHORT pause.
61-83% he speaks the FOURTH sentence.
83-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 83%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the three short ones listed above. There is no
pause inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] ¿Ya tenés tu alojamiento publicado en otro lado?

SECOND sentence: [Spanish] No lo cargues de nuevo.

THIRD sentence: [Spanish] Pegás el link, esperás dos segundos, y tu ficha se completa
sola.

FOURTH sentence: [Spanish] Publicá tu alojamiento en hospeda.com.ar.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.** Regenerar antes que intentar limpiarla.
- **Que la última frase esté completa**: es lo único irrecuperable en edición.
- **Que no haya estirado la locución** para llenar los 15 s.
- **Que el timbre no cambie** entre la primera frase y la última.

---
