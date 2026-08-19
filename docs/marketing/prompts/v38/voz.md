# V38 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Ninguna toma de Hospedín está lip-synced** — es patrón C de punta a punta —, así que
el 100% de lo que se escucha en este video sale de esta tirada.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**. Al
generarlo, respetar la pausa entre S1 y S2.

### De dónde sale la pista

Misma técnica que [V21](../v21/voz.md): una tirada de Hailuo dedicada, sólo por el
audio, partiendo de `@######ESCENA3#######` porque el modo *image to video* exige un
cuadro de arranque.

El guion son 12,5 s hablados más una pausa corta, unos 13,2 s en total. **Se pide 15 s**
—el máximo—: da el margen más grande posible para que no trunque la última palabra sin
que sobre demasiado.

**Este prompt va deliberadamente pelado.** Solo se adjuntan dos referencias:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre. Sin esto no hay nada |
| `@######ESCENA3#######` | `../../escenas/escena3.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

`personaje.png`, `poses.png`, `bocas.png` y `expresiones.png` **no van**: la imagen de
este clip se descarta entera, así que da igual cómo se vea.

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

THE PICTURE: start from @######ESCENA3####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the
last word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-15% he speaks the FIRST sentence.
15-20% a SHORT pause.
20-88% he speaks the SECOND sentence, enumerating five items at an even, unhurried
pace, with a small natural gap after each comma.
88-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 88%. Do not slow it down and do not stretch it to fill the 15
seconds.

FIRST sentence: [Spanish] Planear un finde termina siendo así:

SECOND sentence: [Spanish] una pestaña con el mapa, otra con Google, otra con Mercado
Libre y otras plataformas de alquiler, un grupo de Facebook, y capturas de pantalla que
ya no sabés de dónde salieron.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO river sound,
NO wind, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

---

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que las cinco fuentes de la segunda frase salgan bien separadas** —el mapa, Google,
  Mercado Libre y otras plataformas de alquiler, un grupo de Facebook, capturas de
  pantalla—, porque el corte de T2 sincroniza cada rótulo con su palabra: si se
  atropellan, el rótulo llega tarde.
- **Que no trunque "salieron"**, la última palabra.
- **Que el timbre sea el mismo Hospedín de siempre.**

---
