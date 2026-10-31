# V17 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Mismo método que [V9](../v9/voz.md) y [V16](../v16/voz.md): la voz se genera **aparte, de
corrido, con el guion entero**, y en edición se descarta el audio que devuelve Hailuo y
se pone esa pista única debajo de todo.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Al
generarlo, respetar la pausa entre F1 y F2.

**Se pide de 15 s** —el máximo—, aunque el guion hablado son sólo ~7,4 s: se pide de más
para no truncar la última frase.

**Reemplazos — 2 marcadores, 3 apariciones en total:**

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
conversational male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA1####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-14% he speaks the FIRST sentence.
14-17% a SHORT pause.
17-52% he speaks the SECOND sentence.
52-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 52%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the one short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Escribí la descripción como te salga.

SECOND sentence: [Spanish] La inteligencia artificial la mejora, y de paso la traduce al
inglés y al portugués.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO countryside
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb, NO
echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la última frase esté completa.**
- **Que "inteligencia artificial" no se coma sílabas** por ir de corrido: es la palabra
  más larga del guion.
- **Que el timbre no cambie** entre la primera frase y la última.

---
