# V35 · Tiradas de voz

Genera **la pista de audio de todo el video**. La imagen se descarta en las dos: sólo se
usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

El guion completo de V35 son **94 sílabas, ~16,5 s hablados** más dos pausas cortas —
por encima del techo de 15 s de Hailuo. Se resuelve con **dos tiradas**, en el mismo
punto de corte que las tomas de imagen: **Tirada A cubre F1** (lo que dice
[T1](t1.md), la pregunta gancho) y **Tirada B cubre F2 + F3** (lo que dice
[T3](t3.md), la explicación y el gancho final). Las dos usan la misma
`@######VOZ#######` para que el timbre no cambie entre ellas.

---

## Tirada A · F1

Una sola frase, **3,2 s**. **Se pide 4 s** — el mínimo alcanza.

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|:-:|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | es lo que clona el timbre |
| `@######ESCENA2#######` | `../../escenas/escena2.png` | 2 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 4 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly. Warm, clear, conversational male Argentine voice, young adult, moderate pace,
close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA2####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the sentence straight through to the camera. He is ALREADY SPEAKING in
the very first frame — no breath, no look, no pause before the first word. When he has
finished the last word he stops speaking completely and stays silent until the clip
ends.

TIMING, as fractions of the shot:
0-79% he speaks the sentence.
79-100% SILENCE until the end.

SENTENCE: [Spanish] ¿Conocés bien tu ciudad y te gusta recomendar lugares?

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO background
noise, NO music, NO sound effects, NO reverb, NO echo.
```

---

## Tirada B · F2 + F3

Coincide con lo que dice [T3](t3.md): dos frases seguidas, **13,3 s** más una pausa
corta, unos **13,6 s** en total. **Se pide 15 s**, el máximo, para no truncar la última
frase — es la tirada con menos margen de las siete carpetas de este lote.

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|:-:|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | es lo que clona el timbre |
| `@######ESCENA2#######` | `../../escenas/escena2.png` | 2 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, identical to Tirada A. Warm, clear, conversational male Argentine voice, young
adult, moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA2####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-48% he speaks the FIRST sentence.
48-50% a SHORT pause.
50-91% he speaks the SECOND sentence.
91-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 91%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the one short pause listed above.

FIRST sentence: [Spanish] Buscamos gente que quiera colaborar como editor de Hospeda,
mejorando la información de destinos, lugares y eventos.

SECOND sentence: [Spanish] Queremos contenido con conocimiento local, no escrito desde
una oficina a quinientos kilómetros.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO background
noise, NO music, NO sound effects, NO reverb, NO echo.
```

**Qué mirar en las dos tiradas:** que la última frase de cada una esté completa
—especialmente la de Tirada B, la del gancho final—, que no haya ambiente audible, y
que el timbre no cambie entre las dos.

---
