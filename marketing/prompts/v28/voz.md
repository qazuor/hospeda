# V28 · Tirada de voz — versión anfitrión

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se descarta:
sólo se usa la voz. Igual que en [`v9/voz.md`](../v9/voz.md), del que este documento es
una réplica directa — el guion entero (~10,9 s) entra cómodo en los 15 s de Hailuo, así
que **no hace falta partirlo** como en V26, V27 o V29.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Aunque las dos tomas de imagen (`t1.md`, `t3.md`) son patrón C — sin lip sync—, esta
tirada SÍ lo pide.** No es una contradicción: esta generación entera se descarta después
de extraer el audio, así que necesita que la boca se mueva para que Hailuo produzca una
locución natural, aunque después nunca se vea. El personaje real de este video nunca abre
la boca; el de esta tirada, sí — y da igual, porque nadie lo va a ver.

**Reemplazos — 2 marcadores, 3 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | clona el timbre |
| `@######ESCENA17#######` | `../../escenas/escena17.png` | 1 | cuadro de partida para *image to video* |

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

THE PICTURE: start from @######ESCENA17####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-20% he speaks the FIRST sentence.
20-23% a SHORT pause.
23-73% he speaks the SECOND sentence.
73-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 73%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Se rompió el termotanque un domingo a la mañana.

SECOND sentence: [Spanish] En Hospeda tenés un directorio de oficios de confianza de la
zona, con las valoraciones de otros anfitriones que ya los llamaron.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO background
noise, NO music, NO sound effects, NO reverb, NO echo. The voice is recorded close and
dry, as if in a quiet room, and nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la última frase esté completa.**
- **Que no haya estirado la locución** para llenar los 15 s.
- **Que el timbre no cambie** entre la primera frase y la última.

---
