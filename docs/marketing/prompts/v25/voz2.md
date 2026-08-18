# V25 · Tirada de voz — parte 2 de 2

Genera **la segunda parte de la pista de audio** del video. La imagen se descarta: sólo
se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md). Por qué la voz se parte en dos:
[`montaje.md`](montaje.md#por-qué-la-voz-se-parte-en-dos).

---

**Cubre F2 y F3** — desde "Contá lo que el huésped quiere saber…" hasta "…una colección
de adjetivos." — unos 12,1 s. Esta pista suena entera **sobre la pantalla del
tratamiento de texto (T2) y sobre el cierre hablado (T3)**, así que su propio arranque
—el de F2— no coincide con ningún corte de imagen: la pantalla ya está en el tratamiento
de texto desde antes.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, segunda y
tercera frase. Al generarlo, respetar la pausa entre ambas.

### De dónde sale la pista

Misma técnica que `voz1.md`: una tirada de Hailuo dedicada, sólo por el audio, partiendo
de `@######ESCENA22#######`.

**Se pide 14 s.**

**Reemplazos — 2 marcadores, 3 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA22#######` | `../../escenas/escena22.png` | 1 | el modo *image to video* exige un cuadro de partida |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 14 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last, AND identical to how it
sounds in the first part of this same script — this is the second of two takes that get
placed back to back, with no visual cut between them to hide the seam. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA22####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, split into two sentences. He is ALREADY SPEAKING in the very first frame — no
breath, no look, no pause before the first word. When he has finished the last word he
stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-54% he speaks the FIRST sentence.
54-56% a SHORT pause.
56-86% he speaks the SECOND sentence.
86-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 86%. Do not slow it down, do not stretch it to fill the 14 seconds,
and do not insert any pause other than the one short one listed above. There is no
pause inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Contá lo que el huésped quiere saber: para cuántas personas
es, dónde está, qué comodidades tiene, qué hay cerca y qué lo hace distinto.

SECOND sentence: [Spanish] La información concreta da más confianza que una colección
de adjetivos.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO beach sound,
NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.**
- **Que la segunda frase esté completa.**
- **Que el timbre coincida con `voz1.md`** — es el punto más frágil de las cinco
  publicaciones largas: acá la costura queda expuesta en medio de una pantalla continua,
  sin un corte que la disimule.

---
