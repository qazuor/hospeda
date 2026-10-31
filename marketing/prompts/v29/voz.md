# V29 · Tiradas de voz

Genera **la pista de audio de todo el video** — la imagen se descarta, sólo se usa la
voz. Igual que en [`v9/voz.md`](../v9/voz.md).

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué son dos tiradas, no una

El guion completo de V29 son **18,08 s hablados** más dos pausas (~19,0 s) — muy por
encima del techo de 15 s de Hailuo. **Se parte en dos**, clonando el mismo
`@######VOZ#######` en las dos:

| Parte | Cubre | Sílabas | Dura | Se pide |
|---|---|:-:|:-:|:-:|
| **1** | Oración 1 completa + Oración 2 completa | 23 + 53 = 76 | 13,79 s (con la pausa) | 15 s |
| **2** | Oración 3 (el remate) | 27 | 4,74 s | 6 s |

La partición sigue el mismo corte que separa T6 de T7 en el montaje: la parte 1 cubre
todo lo que es voz en off sobre las cinco pantallas encadenadas, y la parte 2 cubre sólo
el remate, que además es la única frase de la voz en off que se vuelve a grabar como lip
sync real en `t7.md`.

**En edición se descarta el audio de las tres tiradas de imagen** (T1, T7, T8) y se
reemplaza por estas dos pistas, cortadas entre las siete frases y puestas en su lugar
según la tabla ["Dónde cae cada frase de la voz"](montaje.md#dónde-cae-cada-frase-de-la-voz)
del montaje.

---

## Parte 1 — Oración 1 y Oración 2

**Reemplazos — 3 marcadores, 6 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | clona el timbre |
| `@######ESCENA23#######` | `../../escenas/escena23.png` | 1 | cuadro de partida para *image to video* |

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

THE PICTURE: start from @######ESCENA23####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the last
word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-27% he speaks the FIRST sentence.
27-30% a SHORT pause.
30-92% he speaks the SECOND sentence.
92-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational pace
and finishes at 92%. Do not slow it down, do not stretch it to fill the 15 seconds, and do
not insert any pause other than the one short one listed above. There is no pause inside a
sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Supongamos que querés pasar un fin de semana en Concepción del
Uruguay.

SECOND sentence: [Spanish] En Hospeda conocés el destino, buscás alojamiento, encontrás
dónde comer, qué actividades hay, qué eventos coinciden con tu visita y qué lugares
visitar.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor sound,
NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb, NO echo.
The voice is recorded close and dry, as if in a quiet room.
```

---

## Parte 2 — Oración 3 (el remate)

**Reemplazos — 3 marcadores, 6 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | clona el timbre |
| `@######ESCENA17#######` | `../../escenas/escena17.png` | 1 | cuadro de partida para *image to video* — el remate se filma en primer plano |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 6 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, matching the same voice used in Part 1 of this video. Warm, clear, conversational
male Argentine voice, young adult, moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA17####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole sentence straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely and
stays silent until the clip ends.

TIMING, as fractions of the shot:
0-79% he speaks the sentence.
79-100% SILENCE until the end.

SENTENCE: [Spanish] No se trata solo de encontrar dónde dormir: se trata de organizar
todo el viaje.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO background
noise, NO music, NO sound effects, NO reverb, NO echo.
```

---

**Qué mirar en las dos tiradas:**

- **Que no haya ambiente audible** en ninguna de las dos.
- **Que la última frase de cada parte esté completa** — en la parte 1, que "visitar"
  cierre entero.
- **Que el timbre de la parte 2 sea indistinguible del de la parte 1.**

---
