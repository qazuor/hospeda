# V39 · Tirada de voz — parte A (S1 + S2)

Genera **la pista de audio de T1 y T2**. La imagen se descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué son dos tiradas y no una

**El guion completo son 17,5 s hablados** más pausas, lo que supera el límite de 15 s
de una sola generación de Hailuo. Se parte en dos, cortando justo donde el video ya
tiene un corte real de cámara — el pase de T2 (los rótulos) a T3 (Hospedín de vuelta),
en 9,5 s.

- **Parte A** (esta) — S1 y S2, para el tramo T1–T2 (0,0 a 9,5 s del video).
- **Parte B** — S3 y S4, para T3–T4 (ver [`voz2.md`](voz2.md)).

**Aunque T1 lleva su propio lip sync**, el audio final del video sale enteramente de
estas dos tiradas — igual que en el resto de la serie —, no del audio que trae la
tirada de imagen de T1.

---

**Reemplazos — 2 marcadores, 3 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 |
| `@######ESCENA30#######` | `../../escenas/escena30.png` | 1 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 10 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA30####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the
last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-21% he speaks the FIRST sentence.
21-26% a SHORT pause.
26-89% he speaks the SECOND sentence.
89-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 89%. Do not slow it down and do not stretch it to fill the 10
seconds.

FIRST sentence: [Spanish] Hospeda no es una app de reservas.

SECOND sentence: [Spanish] Te ayudamos a encontrar tu próximo lugar, y te ponemos en
contacto directo con quien te va a recibir.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO room tone,
NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice is
recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la pausa entre S1 y S2 no se sienta cortada** — tiene que sonar a que retoma la
  idea, no a que la corta.
- **Que "recibir", la última palabra, quede completa.**

---
