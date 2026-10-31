# V30 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se descarta:
sólo se usa la voz. Igual que en [`v9/voz.md`](../v9/voz.md), del que este documento es
una réplica directa — el guion entero (~11,5 s) entra cómodo en los 15 s de Hailuo.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Cada toma dice exactamente una frase**, así que alinear la pista es trivial: se hace
coincidir el arranque de cada frase con el arranque del movimiento de boca de su toma. Los
prompts de `t1.md` y `t4.md` igual piden el diálogo — para que la boca se mueva bien—,
aunque después ese audio se tira.

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
0-11% he speaks the FIRST sentence.
11-13% a SHORT pause.
13-53% he speaks the SECOND sentence.
53-56% a SHORT pause.
56-77% he speaks the THIRD sentence.
77-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 77%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the two short ones listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] No todos buscamos lo mismo.

SECOND sentence: [Spanish] A veces necesitás una quinta con pileta, otras un
departamento para dos, o algo cerca del centro.

THIRD sentence: [Spanish] En Hospeda filtrás hasta encontrar lo que estás buscando.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor sound,
NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb, NO echo.
The voice is recorded close and dry, as if in a quiet room, and nothing else is audible at
any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la última frase esté completa.**
- **Que no haya estirado la locución** para llenar los 15 s.
- **Que el timbre no cambie** entre la primera frase y la última.

---
