# V32 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

El guion completo de V32 son solo **dos frases, 6,5 s hablados**: la tirada de voz más
corta de las siete que arma este lote. Aun así se genera aparte, igual que en V9 y V31,
para que el timbre de T1 (que sí lleva lip sync) sea idéntico al de la narración que
acompaña la pantalla en T2.

**Se pide 8 s** — el siguiente incremento disponible por encima de lo necesario, con
margen de sobra para que no trunque la segunda frase.

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|:-:|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA23#######` | `../../escenas/escena23.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 8 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA23####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-28% he speaks the FIRST sentence.
28-31% a SHORT pause.
31-81% he speaks the SECOND sentence.
81-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 81%. Do not slow it down, do not stretch it to fill the 8 seconds,
and do not insert any pause other than the one short pause listed above.

FIRST sentence: [Spanish] Tres alojamientos, una sola pantalla.

SECOND sentence: [Spanish] Compará precio, capacidad y comodidades sin abrir cinco
pestañas.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO wind, NO
background noise, NO music, NO sound effects, NO reverb, NO echo. The voice is recorded
close and dry, as if in a quiet room, and nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que la segunda frase esté completa**, palabra a palabra: es la que trae los tres
  criterios de comparación y es lo único irrecuperable en edición.
- **Que no haya ambiente audible.**
- **Que el timbre no cambie** entre la primera frase y la última.

---
