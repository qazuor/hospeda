# V23 · Tirada de voz — parte 2 de 2

Genera **la segunda mitad de la pista de audio** del video. La imagen se descarta: sólo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md). Por qué la voz se parte en dos:
[`montaje.md`](montaje.md#por-qué-la-voz-se-parte-en-dos).

---

**Cubre F6 y F7** — desde "Hospeda está pensado para…" hasta "…no un reemplazo." — unos
9,4 s de las 19,1 s habladas del video entero.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, últimas dos
frases. Al generarlo, respetar la pausa entre ellas.

### De dónde sale la pista

Misma técnica que `voz1.md`: una tirada de Hailuo dedicada, sólo por el audio, partiendo
de `@######ESCENA4#######`.

**Se pide 11 s.**

**Reemplazos — 2 marcadores, 3 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA4#######` | `../../escenas/escena4.png` | 1 | el modo *image to video* exige un cuadro de partida |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 11 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last, AND identical to how it
sounds in the first half of this same script — this is the second of two takes that get
placed back to back. Warm, clear, conversational male Argentine voice, young adult,
moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA4####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, split into two sentences. He is ALREADY SPEAKING in the very first frame — no
breath, no look, no pause before the first word. When he has finished the last word he
stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-65% he speaks the FIRST sentence.
65-68% a SHORT pause.
68-86% he speaks the SECOND sentence.
86-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 86%. Do not slow it down, do not stretch it to fill the 11 seconds,
and do not insert any pause other than the one short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Hospeda está pensado para darte visibilidad dentro del destino
y que el turista te conozca y te escriba directo.

SECOND sentence: [Spanish] Es un canal más, no un reemplazo.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects,
NO reverb, NO echo. The voice is recorded close and dry, as if in a quiet room, and
nothing else is audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la segunda frase esté completa** — es el remate que resume todo el video.
- **Que no haya estirado la locución** para llenar los 11 s.
- **Que el timbre coincida con `voz1.md`.**

---
