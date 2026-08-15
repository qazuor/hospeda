# V37 · Tiradas de voz

Genera **la pista de audio de todo el video**. La imagen se descarta en las dos: sólo se
usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

El guion completo de V37 son **99 sílabas, ~17,4 s hablados** más dos pausas cortas —
por encima del techo de 15 s de Hailuo. Igual que en V35, se resuelve con **dos
tiradas**, cortando en el límite de oración más natural: **Tirada A cubre F1 + F2** (las
mismas dos frases que dice T1) y **Tirada B cubre F3** (la misma que dice T3, el
remate). Las dos usan la misma `@######VOZ#######` para que el timbre no cambie entre
ellas.

---

## Tirada A · F1 + F2

Coincide con lo que dice [T1](t1.md). Las dos frases suman **13,5 s** más una pausa
corta, unos **13,7 s** en total. **Se pide 15 s**, el máximo, para no truncar la segunda
frase.

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|:-:|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | es lo que clona el timbre |
| `@######ESCENA27#######` | `../../escenas/escena27.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA27####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-40% he speaks the FIRST sentence.
40-41% a SHORT pause.
41-92% he speaks the SECOND sentence.
92-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 92%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the one short pause listed above.

FIRST sentence: [Spanish] Hospeda también quiere trabajar con empresas, instituciones y
organizaciones vinculadas al turismo.

SECOND sentence: [Spanish] Un partner puede colaborar con contenido, promociones,
acciones conjuntas o eventos que aporten valor al que visita un destino.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO background
noise, NO music, NO sound effects, NO reverb, NO echo.
```

---

## Tirada B · F3

Coincide con lo que dice [T3](t3.md). Una sola frase, **3,9 s**. **Se pide 6 s**.

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|:-:|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 4 | es lo que clona el timbre |
| `@######ESCENA17#######` | `../../escenas/escena17.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 6 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical to Tirada A — same character, same recording session in
spirit even though it is a separate generation.

THE PICTURE: start from @######ESCENA17####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the sentence straight through to the camera. He is ALREADY SPEAKING in
the very first frame — no breath, no look, no pause before the first word. When he has
finished the last word he stops speaking completely and stays silent until the clip
ends.

TIMING, as fractions of the shot:
0-64% he speaks the sentence.
64-100% SILENCE until the end.

SENTENCE: [Spanish] La idea es crecer armando una red, no cada uno por su lado.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO background
noise, NO music, NO sound effects, NO reverb, NO echo.
```

**Qué mirar en las dos tiradas:** que la última frase de cada una esté completa, que no
haya ambiente audible, y sobre todo **que el timbre de la Tirada B suene idéntico al de
la Tirada A** — es el punto más frágil de dividir la voz en dos generaciones.

---
