# V15 · Tirada de voz — en dos partes

Genera **la pista de audio de todo el video**. La imagen se descarta: sólo se usa la
voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## Por qué son dos tiradas y no una

**El guion completo son 18,9 s hablados**, el más largo de los cuatro videos de este
lote, y con las pausas entre frases se va bastante más allá del límite de 15 s de una
sola generación de Hailuo. Se parte en dos, cortando en un punto que **ya es un corte
real de cámara** en el montaje: el pase de la placa del problema 2 al asentimiento
reutilizado (T4 → T5, en 13,0 s).

- **Parte A** — S1, S2, P1 y P2, para el tramo T1–T4 (0,0 a 13,0 s del video).
- **Parte B** — P3, P4 y S4, para el tramo T6–T9 (14,0 a 27,5 s del video).

> El texto de las cuatro frases de problema es el de
> [El diálogo completo](montaje.md#el-diálogo-completo) — **ejemplos pendientes de
> reemplazo por los reales**. No generar la tirada final hasta tener los cuatro
> confirmados.

---

## Parte A — S1, S2, P1 y P2

**Reemplazos — 3 marcadores, 6 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 |
| `@######ESCENA14#######` | `../../escenas/escena14.png` | 1 |

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

THE PICTURE: start from @######ESCENA14####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, pacing it like a short spoken list toward the end. He is ALREADY SPEAKING in
the very first frame — no breath, no look, no pause before the first word. When he has
finished the last word he stops speaking completely and stays silent until the clip
ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-17% he speaks the FIRST sentence.
17-19% a SHORT pause.
19-40% he speaks the SECOND sentence.
40-42% a SHORT pause.
42-57% he speaks the THIRD sentence.
57-59% a SHORT pause.
59-78% he speaks the FOURTH sentence.
78-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace, a little quicker and more list-like on the third and fourth sentences, and
finishes at 78%. Do not slow it down, do not stretch it to fill the 15 seconds, and do
not insert any pause other than the short ones listed above.

FIRST sentence: [Spanish] Esto no lo armó una empresa de software.

SECOND sentence: [Spanish] Lo armó alguien que alquila para turismo hace años.

THIRD sentence: [Spanish] El que pregunta a las once de la noche,

FOURTH sentence: [Spanish] las fechas que se superponen entre tres plataformas,

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO indoor
murmur, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

---

## Parte B — P3, P4 y S4

**Reemplazos — 3 marcadores, 6 apariciones en total:**

| Marcador | Archivo a adjuntar | Veces |
|---|---|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 |
| `@######ESCENA30#######` | `../../escenas/escena30.png` | 1 |

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical to the rest of this video's narration. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA30####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery, list-like on the first two short sentences and settling into a warmer,
conclusive pace on the third. He is ALREADY SPEAKING in the very first frame — no
breath, no look, no pause before the first word. When he has finished the last word he
stops speaking completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-14% he speaks the FIRST sentence.
14-16% a SHORT pause.
16-29% he speaks the SECOND sentence.
29-31% a SHORT pause.
31-58% he speaks the THIRD sentence, at a warmer and more conclusive pace than the
first two.
58-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery finishes at 58%. Do not slow it
down, do not stretch it to fill the 15 seconds, and do not insert any pause other than
the short ones listed above.

FIRST sentence: [Spanish] la comisión que se lleva media noche,

SECOND sentence: [Spanish] cargar la misma ficha por cuarta vez.

THIRD sentence: [Spanish] Los problemas que resuelve Hospeda son los que sufrimos
nosotros primero.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO indoor
murmur, NO background noise, NO music, NO sound effects, NO reverb, NO echo. The voice
is recorded close and dry, as if in a quiet room, and nothing else is audible at any
point.
```

---

**Qué mirar en las dos tiradas:**

- **Que no haya ambiente audible** en ninguna de las dos.
- **Que las cuatro frases de problema salgan bien separadas entre sí**, con un corte
  limpio posible en cada coma: el montaje las recorta una por una para colocarlas sobre
  cada placa.
- **Que la Parte B no trunque "primero"**, la última palabra del video.
- **Que el timbre de la Parte B sea idéntico al de la Parte A.**
- **Que ninguna de las dos haya estirado la locución** para llenar los 15 s — con
  cuatro/tres frases cortas en una sola tirada, es la que más tienta a espaciarlas de
  más.

---
