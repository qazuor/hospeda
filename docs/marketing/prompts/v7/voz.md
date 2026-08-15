# V7 · Tiradas de voz

Genera **la pista de audio de todo el video**. La imagen se descarta: solo se usa la
voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

Las tres frases de V7 suman **17,5 s de habla más dos pausas cortas (~0,7 s)**, unos
**18,2 s en total** — no entra en el máximo de Hailuo de 15 s. A diferencia de V1 y
V11, acá hacen falta **dos tiradas**.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, que es el
único lugar donde vive.

**Reemplazos — 2 marcadores en las dos tiradas**, con distinto conteo en cada una
porque la segunda no repite el marcador en el bloque de `SOUND`:

| Marcador | Archivo a adjuntar | Veces en la 1ª | Veces en la 2ª |
|---|---|:-:|:-:|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | 1 |
| `@######ESCENA15#######` | `../../escenas/escena15.png` | 1 | 1 |

**Primera tirada: 3 apariciones. Segunda tirada: 2 apariciones.**

---

## Primera tirada — F1 y F2

Se pide de **15 s** —el máximo— porque F1 y F2 juntas más la pausa entre ellas son
13,33 s: no hay margen para pedir menos sin arriesgar que trunque F2.

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

THE PICTURE: start from @######ESCENA15####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks both sentences straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the second sentence he stops speaking
completely and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-55% he speaks the FIRST sentence.
55-57% a SHORT pause.
57-89% he speaks the SECOND sentence.
89-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 89%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the one short one listed above. There is no pause
inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] Si tenés una casa, un departamento, una cabaña, una quinta, un
hotel o cualquier alojamiento turístico, podés publicarlo en Hospeda.

SECOND sentence: [Spanish] Tenés tu propia página con fotos, descripción, servicios,
ubicación, precios y contacto.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

---

## Segunda tirada — F3

Se pide de **6 s**: F3 sola son 4,56 s, y no hace falta más margen que ese.

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 6 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical to the previous tirada. Warm, clear, conversational male
Argentine voice, young adult, moderate pace, close and friendly, not announcer-like.

THE PICTURE: start from @######ESCENA15####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the sentence straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished he stops speaking completely and stays
silent until the clip ends.

TIMING, as fractions of the shot:
0-76% he speaks the sentence.
76-100% SILENCE until the end.

ONE sentence: [Spanish] La idea es simple: que más turistas te encuentren y puedan
escribirte directo.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice. Complete
silence otherwise. NO ambience, NO outdoor sound, NO wind, NO birds, NO background
noise, NO music, NO sound effects, NO reverb, NO echo.
```

**Qué mirar en las dos tiradas:**

- **Que el timbre de la segunda coincida exactamente con el de la primera.** Es el
  punto donde dos tiradas de voz se pueden notar como dos voces distintas.
- **Que no haya ambiente audible** en ninguna de las dos.
- **Que la última frase de cada una esté completa.**

---
