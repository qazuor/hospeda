# V11 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: solo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Las tres frases de V11 suman **14,0 s de habla más dos pausas cortas (~0,7 s)**, unos
**14,7 s en total** — entra justo en el máximo de Hailuo de 15 s, así que alcanza con
**una sola tirada** (a diferencia de V7, V8 y V10).

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Al
generarlo, respetar las dos pausas: después de F1 y después de F2.

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
not announcer-like.

THE PICTURE: start from @######ESCENA15####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-18% he speaks the FIRST sentence.
18-20% a SHORT pause.
20-61% he speaks the SECOND sentence.
61-63% a SHORT pause.
63-98% he speaks the THIRD sentence.
98-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 98%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the two short ones listed above. There is no
pause inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Publicar tu alojamiento es bastante simple.

SECOND sentence: [Spanish] Creás tu cuenta, cargás la información, agregás las fotos, la
ubicación, los servicios y tus datos de contacto.

THIRD sentence: [Spanish] Una vez publicado ya tenés tu espacio en Hospeda para empezar
a recibir consultas.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la última frase esté completa.**
- **Que no haya estirado la locución** para llenar los 15 s: 14,7 s de contenido en un
  clip de 15 deja muy poco margen, así que una locución lenta se nota enseguida.
- **Que el timbre no cambie** entre la primera frase y la última.

---
