# V26 · Tiradas de voz

Genera **la pista de audio de todo el video** — la imagen se descarta, sólo se usa la
voz. Igual que en [`v9/voz.md`](../v9/voz.md).

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué son dos tiradas, no una

El guion completo de V26 son **16,84 s hablados** más dos pausas (~17,7 s), y Hailuo tiene
un techo duro de **15 s**. En V9 el guion entero (11,3 s) entraba en una sola tirada de
voz; acá no entra, así que **se parte en dos**, cada una dentro del límite, clonando el
mismo `@######VOZ#######` en las dos para que el timbre no cambie entre partes.

**La partición sigue el mismo corte que separa T3 de T4 en el montaje**: la parte 1 cubre
todo lo que es voz en off sin Hospedín en cámara (F1 completo + F2), y la parte 2 cubre
sólo el remate (F3), que es además la única frase que se vuelve a grabar como lip sync
real en `t4.md`.

| Parte | Cubre | Sílabas | Dura | Se pide |
|---|---|:-:|:-:|:-:|
| **1** | Oración 1 completa + Oración 2 | 39 + 35 = 74 | 13,43 s (con la pausa) | 15 s |
| **2** | Oración 3 (el remate) | 22 | 3,86 s | 6 s |

**En edición se descarta el audio de las tres tiradas de imagen** (T1, T4, T5) y se
reemplaza por estas dos pistas, cortadas entre frases y puestas en su lugar según la
tabla ["Dónde cae cada frase de la voz"](montaje.md#dónde-cae-cada-frase-de-la-voz) del
montaje.

---

## Parte 1 — Oración 1 y Oración 2

**Reemplazos — 3 marcadores, 6 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | clona el timbre |
| `@######ESCENA26#######` | `../../escenas/escena26.png` | 1 | cuadro de partida para *image to video* |

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

THE PICTURE: start from @######ESCENA26####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, with one short pause in the middle. He is ALREADY SPEAKING in the very first
frame — no breath, no look, no pause before the first word. When he has finished the last
word he stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-46% he speaks the FIRST sentence.
46-49% a SHORT pause.
49-90% he speaks the SECOND sentence.
90-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational pace
and finishes at 90%. Do not slow it down, do not stretch it to fill the 15 seconds, and do
not insert any pause other than the one short one listed above. There is no pause inside a
sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Si tenés un restaurante, un bar, una cafetería o un
emprendimiento gastronómico, también podés estar en Hospeda.

SECOND sentence: [Spanish] El que visita una ciudad no busca solo dónde dormir: busca
dónde comer, dónde tomar algo y qué conocer.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO restaurant
sound, NO music, NO sound effects, NO reverb, NO echo. The voice is recorded close and
dry, as if in a quiet room, and nothing else is audible at any point.
```

---

## Parte 2 — Oración 3 (el remate)

**Reemplazos — 3 marcadores, 6 apariciones:**

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | clona el timbre |
| `@######ESCENA30#######` | `../../escenas/escena30.png` | 1 | cuadro de partida para *image to video* — el remate se filma en primer plano |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 6 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, matching the same voice used in the other tiradas of this video. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly, not
announcer-like.

THE PICTURE: start from @######ESCENA30####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole sentence straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely and
stays silent until the clip ends.

TIMING, as fractions of the shot:
0-65% he speaks the sentence.
65-100% SILENCE until the end.

SENTENCE: [Spanish] Queremos que los negocios de la zona sean parte de esa búsqueda.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO restaurant
sound, NO music, NO sound effects, NO reverb, NO echo.
```

---

**Qué mirar en las dos tiradas:**

- **Que no haya ambiente audible** en ninguna de las dos.
- **Que la última frase de cada parte esté completa.**
- **Que el timbre de la parte 2 sea indistinguible del de la parte 1.** Es lo único que
  puede delatar que son dos generaciones distintas.

---
