# VH5 · Tu salida, donde el turista ya está mirando

Video de venta · Experiencias. Índice en [`../README.md`](../README.md).

Se hace con **Hailuo / MiniMax** (*image to video*) para las tomas de Hospedín, una tirada solo para la voz, grabaciones reales y un **montaje que arma Claude Code** en Remotion.

---

- **Para quién:** Guías, pesca, kayak, cabalgatas y agencias
- **Formato:** vertical 9:16, 1080×1920, para WhatsApp e Instagram
- **Insignia de prueba gratis:** sí, en el cierre
- **Duración:** 15,0 s

## Lo que se escucha

| Frase | Toma | Dura (aprox.) |
|---|:-:|:-:|
| ¿Llevás turistas a pescar, en kayak o a cabalgar? | T1 | 2,8 s |
| Mostrá tu salida donde el turista ya está buscando qué hacer. | T2 | 3,7 s |
| Probalo treinta días gratis, sin tarjeta. | T3 | 2,3 s |
| Publicá tu experiencia en hospeda.com.ar. | T4 | 3,2 s |

## El montaje

| Toma | Tiempo | De dónde sale |
|---|---|---|
| T1 | 0,0–3,5 | Hailuo (se pide 6 s) |
| T2 | 3,5–8,0 | grabación P9 · Experiencias: listado y ficha |
| T3 | 8,0–11,0 | Hailuo (se pide 6 s) |
| T4 | 11,0–15,0 | cierre con el logo, en Remotion |

## Cómo se hace

1. **Una tirada de Hailuo por toma.** En cada una se adjuntan sus archivos, **el logo incluido, otra vez en cada tirada**, y se reemplazan los marcadores `@######NOMBRE#######` a mano.
2. **La tirada de voz** genera el audio de todo el video de corrido; su imagen se descarta.
3. **Las tiradas descargadas** van a `/home/qazuor/projects/WEBS/marketing/video-lab/ventas/vh5/` (`t1.mp4`, `t3.mp4`, …, `voz.mp4`).
4. **El montaje** lo arma Claude Code con el último prompt: graba las pantallas, arma el cierre con el logo y renderiza.

> `/home/qazuor/projects/WEBS/marketing` es la carpeta de assets de marketing (`HOSPEDA_MARKETING_ASSETS_DIR`), fuera del repo.

> **Regla:** Hoy no se vende el cupo por Hospeda: el video no habla de reservas.

## Hailuo · tirada T1 (se pide 6 s, se usa 3,5 s)

**Adjuntar y reemplazar:**

- `@######ESCENA#######` → /home/qazuor/projects/WEBS/marketing/escenas/escena12.png
- `@######PERSONAJE#######` → /home/qazuor/projects/WEBS/marketing/personaje/personaje.png
- `@######POSES#######` → /home/qazuor/projects/WEBS/marketing/personaje/poses.png
- `@######EXPRESIONES#######` → /home/qazuor/projects/WEBS/marketing/personaje/expresiones.png
- `@######BOCAS#######` → /home/qazuor/projects/WEBS/marketing/personaje/bocas.png
- `@######ACCIONES#######` → /home/qazuor/projects/WEBS/marketing/personaje/acciones.png
- `@######LOGO#######` → apps/web/src/assets/images/logo.webp (otra vez en cada tirada)
- `@######VOZ#######` → /home/qazuor/projects/WEBS/marketing/personaje/voz.wav
- `@######PANTALLA#######` → captura real del listado de Experiencias, en el celular

````
FORMAT: 3D animated character film, vertical 9:16, one continuous shot, no cuts, 6
seconds. This clip is ONE SHOT INSIDE A LARGER EDIT: only its first 3,5 seconds will
be used, so the action must happen early and then settle.

THE REFERENCES: @######ESCENA####### is the starting point of this video: the same character, the same fishing boat on the river behind him, the same full-body framing and the same light. @######PERSONAJE####### and @######POSES####### define exactly how the character looks and his proportions. @######EXPRESIONES####### defines his facial expressions. @######BOCAS####### defines the mouth shapes he uses when he speaks. @######ACCIONES####### defines his body poses. @######LOGO####### is the exact brand logo printed on his sweatshirt: copy it as it is, never redraw it. @######VOZ####### is the voice: clone that timbre, that accent and that age. @######PANTALLA####### is a real screenshot of a website open in a mobile browser: it is exactly what is displayed on the phone screen, and it must be reproduced faithfully, never redesigned or reinvented.

OPENING COMPOSITION: A closer view than @######ESCENA#######, a medium shot of the character on the boat — chest and head — with the phone at chest height, screen to the camera. The river softly out of focus.

ACTION, IN ORDER: In the VERY FIRST FRAME he is ALREADY SPEAKING — do not start with a pause, a breath or a look. He asks with a DIVERTIDO expression and gestures at the river with his free hand the way SEÑALANDO appears in @######ACCIONES#######. When the action is over he holds the pose, breathing and blinking. He does not start any new movement.

TIMING, as fractions of the shot — never as seconds, so it still holds if the clip comes
out longer than requested:
0-47% he speaks the line(s) below in one flowing delivery while doing the action.
47-100% he holds the final pose, breathing and blinking, with no new action. No drift, no creeping, no scale change.

DIALOGUE: warm, clear, conversational male Argentine voice from @######VOZ#######, young
adult, moderate pace, close and friendly, not announcer-like. Mouth shapes from
@######BOCAS#######.

The character (S1) faces the camera and says: [Spanish] ¿Llevás turistas a pescar, en kayak o a cabalgar?

THE PHONE: its shape, proportions and screen aspect ratio are exactly those of the phone
in @######ESCENA#######. Do not reshape it and do not substitute a different phone model.
It is a modern Android flagship with a 19.5:9 screen: flat titanium frame, nearly
square corners, thin even bezels and a single tiny round punch-hole camera centred at
the top of the screen. No logos or brand names on it.

THE PHONE SCREEN: it always shows the screen from @######PANTALLA####### — the same layout,
colours, logo and texts, in the same position, sharp and free of glare. Never redesign it
and never invent a generic app screen.

CAMERA: locked off, with a very subtle handheld drift. No zoom, no pan.

KEEP UNCHANGED, exactly as in @######PERSONAJE####### and @######POSES#######: the large
rounded blue head and its silhouette, the green and teal band across the lower part of
the face, the floating orange sphere beside the head and its separation from it, the big
cartoon eyes and black eyebrows, the simple flat mouth from @######BOCAS#######, the
white hooded sweatshirt with its logo — reproduced exactly as @######LOGO#######, the
symbol AND the word hospeda below it — and the compact proportions with a large head and
short limbs. He stays a stylized 3D cartoon at all times and never becomes humanlike.

SOUND: gentle water lapping against a boat, distant birds. No music.
````

## Hailuo · tirada T3 (se pide 6 s, se usa 3,0 s)

**Adjuntar y reemplazar:**

- `@######ESCENA#######` → /home/qazuor/projects/WEBS/marketing/escenas/escena12.png
- `@######PERSONAJE#######` → /home/qazuor/projects/WEBS/marketing/personaje/personaje.png
- `@######POSES#######` → /home/qazuor/projects/WEBS/marketing/personaje/poses.png
- `@######EXPRESIONES#######` → /home/qazuor/projects/WEBS/marketing/personaje/expresiones.png
- `@######BOCAS#######` → /home/qazuor/projects/WEBS/marketing/personaje/bocas.png
- `@######ACCIONES#######` → /home/qazuor/projects/WEBS/marketing/personaje/acciones.png
- `@######LOGO#######` → apps/web/src/assets/images/logo.webp (otra vez en cada tirada)
- `@######VOZ#######` → /home/qazuor/projects/WEBS/marketing/personaje/voz.wav
- `@######PANTALLA#######` → captura real del listado de Experiencias, en el celular

````
FORMAT: 3D animated character film, vertical 9:16, one continuous shot, no cuts, 6
seconds. This clip is ONE SHOT INSIDE A LARGER EDIT: only its first 3,0 seconds will
be used, so the action must happen early and then settle.

THE REFERENCES: @######ESCENA####### is the starting point of this video: the same character, the same fishing boat on the river behind him, the same full-body framing and the same light. @######PERSONAJE####### and @######POSES####### define exactly how the character looks and his proportions. @######EXPRESIONES####### defines his facial expressions. @######BOCAS####### defines the mouth shapes he uses when he speaks. @######ACCIONES####### defines his body poses. @######LOGO####### is the exact brand logo printed on his sweatshirt: copy it as it is, never redraw it. @######VOZ####### is the voice: clone that timbre, that accent and that age. @######PANTALLA####### is a real screenshot of a website open in a mobile browser: it is exactly what is displayed on the phone screen, and it must be reproduced faithfully, never redesigned or reinvented.

OPENING COMPOSITION: The literal full-body framing of @######ESCENA#######.

ACTION, IN ORDER: In the VERY FIRST FRAME he is ALREADY SPEAKING — do not start with a pause, a breath or a look. With an ENTUSIASMADO expression he raises his free hand in the ES FÁCIL pose from @######ACCIONES#######. When the action is over he holds the pose, breathing and blinking. He does not start any new movement.

TIMING, as fractions of the shot — never as seconds, so it still holds if the clip comes
out longer than requested:
0-38% he speaks the line(s) below in one flowing delivery while doing the action.
38-100% he holds the final pose, breathing and blinking, with no new action. No drift, no creeping, no scale change.

DIALOGUE: warm, clear, conversational male Argentine voice from @######VOZ#######, young
adult, moderate pace, close and friendly, not announcer-like. Mouth shapes from
@######BOCAS#######.

The character (S1) faces the camera and says: [Spanish] Probalo treinta días gratis, sin tarjeta.

THE PHONE: its shape, proportions and screen aspect ratio are exactly those of the phone
in @######ESCENA#######. Do not reshape it and do not substitute a different phone model.
It is a modern Android flagship with a 19.5:9 screen: flat titanium frame, nearly
square corners, thin even bezels and a single tiny round punch-hole camera centred at
the top of the screen. No logos or brand names on it.

THE PHONE SCREEN: it always shows the screen from @######PANTALLA####### — the same layout,
colours, logo and texts, in the same position, sharp and free of glare. Never redesign it
and never invent a generic app screen.

CAMERA: locked off, with a very subtle handheld drift. No zoom, no pan.

KEEP UNCHANGED, exactly as in @######PERSONAJE####### and @######POSES#######: the large
rounded blue head and its silhouette, the green and teal band across the lower part of
the face, the floating orange sphere beside the head and its separation from it, the big
cartoon eyes and black eyebrows, the simple flat mouth from @######BOCAS#######, the
white hooded sweatshirt with its logo — reproduced exactly as @######LOGO#######, the
symbol AND the word hospeda below it — and the compact proportions with a large head and
short limbs. He stays a stylized 3D cartoon at all times and never becomes humanlike.

SOUND: gentle water lapping against a boat, distant birds. No music.
````

## Hailuo · tirada de voz (15 s, sólo el audio)

**Adjuntar y reemplazar:**

- `@######VOZ#######` → /home/qazuor/projects/WEBS/marketing/personaje/voz.wav
- `@######ESCENA#######` → /home/qazuor/projects/WEBS/marketing/escenas/escena12.png

````
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-19% he speaks the FIRST sentence.
19-21% a SHORT pause.
21-46% he speaks the SECOND sentence.
46-48% a SHORT pause.
48-63% he speaks the THIRD sentence.
63-65% a SHORT pause.
65-87% he speaks the FOURTH sentence.
87-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace. Do not slow it down, do not stretch it to fill the 15 seconds, and do not insert
any pause other than the short ones listed above.

FIRST sentence: [Spanish] ¿Llevás turistas a pescar, en kayak o a cabalgar?

SECOND sentence: [Spanish] Mostrá tu salida donde el turista ya está buscando qué hacer.

THIRD sentence: [Spanish] Probalo treinta días gratis, sin tarjeta.

FOURTH sentence: [Spanish] Publicá tu experiencia en hospeda.com.ar.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room.
````

## Montaje · prompt para Claude Code

**Adjuntar y reemplazar:**

- `El clip descargado de Hailuo de la tirada T1` → undefined
- `El clip descargado de Hailuo de la tirada T3` → undefined
- `El clip descargado de la tirada de voz (sólo se usa su audio)` → undefined
- `Logo: apps/web/src/assets/images/logo.webp, cuando Claude lo pida` → undefined

````
Armá en Remotion el video de venta VH5 · «Tu salida, donde el turista ya está mirando» (15,0 s).

ANTES DE EMPEZAR, leé: marketing/videos/REGLAS.md, marketing/videos/README.md,
marketing/personaje-hospedin.md y marketing/prompts/grabaciones.md. Usá la composición
src/a1/ como molde. Trabajá en un worktree cortado de staging; lo generado (tomas,
audio, renders) vive en /home/qazuor/projects/WEBS/marketing/video-lab/, nunca en el repo.

MATERIAL QUE TE PASO en /home/qazuor/projects/WEBS/marketing/video-lab/ventas/vh5/:
- t1.mp4: la tirada T1 de Hailuo.
- t3.mp4: la tirada T3 de Hailuo.
- voz.mp4: la tirada de voz. Usá SOLO su audio; tirá el audio de las demás tiradas.

GRABACIÓN: la grabás vos con el grabador de marketing/videos, con el dispositivo de
referencia (config/device.ts) y la puesta en escena de demo (DEMO_HIDE_CSS).
- Dónde: en https://staging.hospeda.com.ar, no en local. Ahí se crean cuentas y se
  paga con el sandbox de Mercado Pago, así que el alta llega a publicado de verdad.
- La cuenta: pedímela, o la creamos juntos, antes de grabar. Nunca escribas usuario ni
  contraseña en el repo, en el grabador ni en un log: pasalos por variables de entorno.
- Nunca una cuenta con permisos de super admin.
- Si el flujo pide pagar, se paga con una tarjeta de prueba del sandbox y ese tramo no
  entra en el video.
- En la barra de direcciones que se dibuja en la edición se lee hospeda.com.ar, nunca
  staging.
- Staging tiene datos de prueba: elegí fichas con buenas fotos y sin textos de prueba a
  la vista.
- T2: P9 · Experiencias: listado y ficha. Del listado a una ficha con buenas fotos.

HOJA DE CORTE (cortes secos, en múltiplos de 0,5 s):
| Toma | En la timeline | Dura | De dónde sale | Voz |
|---|---|:-:|---|---|
| T1 | 0,0 → 3,5 | 3,5 | tirada T1 · 6 s, se usa 0,0 → 3,5 | «¿Llevás turistas a pescar, en kayak o a cabalgar?» |
| T2 | 3,5 → 8,0 | 4,5 | grabación P9 · Experiencias: listado y ficha | «Mostrá tu salida donde el turista ya está buscando qué hacer.» |
| T3 | 8,0 → 11,0 | 3,0 | tirada T3 · 6 s, se usa 0,0 → 3,0 | «Probalo treinta días gratis, sin tarjeta.» |
| T4 | 11,0 → 15,0 | 4,0 | cierre en Remotion | «Publicá tu experiencia en hospeda.com.ar.» |

LA VOZ: la pista es una sola tirada; cortala entre frases y ubicá cada frase en su toma.

TEXTOS EN PANTALLA (exactos, Geologica para títulos, Roboto para el resto):
- T1: «¿Pesca, kayak o cabalgata?»
- T3: «30 días de prueba gratis · Sin tarjeta»

EL CIERRE (4,0 s): logo que entra, «Publicá tu experiencia» palabra por palabra, píldora
hospeda.com.ar y la insignia «30 días de prueba gratis · Sin tarjeta». Fondo con las colinas de A1.

EL LOGO: antes de armar el cierre, y otra vez antes de cada render nuevo o de cada
corrección, pedime el logo. Usá exactamente el archivo que te pase (por defecto
apps/web/src/assets/images/logo.webp): sin redibujarlo, sin recolorearlo, sin
deformarlo y sin vectorizarlo a mano.

MÚSICA Y SONIDO: la base sintetizada de tools/audio, con acento en cada corte de toma.
Subtítulos palabra por palabra dentro de la zona segura. Audio a -14 LUFS.

REGLAS DE CONTENIDO (no se negocian):
- Cero precios en pantalla y en la voz.
- Nada que no exista como si funcionara; lo que viene dice «Próximamente».
- Pantallas reales de Hospeda, grabadas con una cuenta del seed, nunca con super admin.
- Ningún destino por encima de otro; sin cupones; sin métricas ni testimonios inventados.
- Airbnb, Booking y Google se nombran sólo en calendario y reputación, nunca con su logo.
- Voseo rioplatense en todo el texto.

ENTREGA: render 1080×1920, 30 fps, en /home/qazuor/projects/WEBS/marketing/video-lab/out/vh5.mp4. Un render
por vez: después del primero esperá mis correcciones. El sonido lo valido yo.
````
