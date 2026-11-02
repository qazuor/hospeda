# VH4 · Que te encuentren para comer o salir

Video de venta · Comer y salir. Índice en [`../README.md`](../README.md).

Se hace con **Hailuo / MiniMax** (*image to video*) para las tomas de Hospedín, una tirada solo para la voz, grabaciones reales y un **montaje que arma Claude Code** en Remotion.

---

- **Para quién:** Carritos, rotiserías, restaurantes, cervecerías, bares y boliches
- **Formato:** vertical 9:16, 1080×1920, para WhatsApp e Instagram
- **Insignia de prueba gratis:** sí, en el cierre
- **Duración:** 14,0 s

## Lo que se escucha

| Frase | Toma | Dura (aprox.) |
|---|:-:|:-:|
| ¿Tenés un carrito, una rotisería o un resto bar? | T1 | 3,2 s |
| Que te encuentren los que buscan dónde comer o salir. | T2 | 2,8 s |
| Con tu mapa, tus fotos y tus redes. | T2 | 1,8 s |
| Sumá tu local en hospeda.com.ar. | T3 | 2,6 s |

## El montaje

| Toma | Tiempo | De dónde sale |
|---|---|---|
| T1 | 0,0–4,0 | Hailuo (se pide 6 s) |
| T2 | 4,0–10,0 | grabación P8 · Gastronomía: listado y ficha |
| T3 | 10,0–14,0 | cierre con el logo, en Remotion |

## Cómo se hace

1. **Una tirada de Hailuo por toma.** En cada una se adjuntan sus archivos, **el logo incluido, otra vez en cada tirada**, y se reemplazan los marcadores `@######NOMBRE#######` a mano.
2. **La tirada de voz** genera el audio de todo el video de corrido; su imagen se descarta.
3. **Las tiradas descargadas** van a `/home/qazuor/projects/WEBS/marketing/video-lab/ventas/vh4/` (`t1.mp4`, `t3.mp4`, …, `voz.mp4`).
4. **El montaje** lo arma Claude Code con el último prompt: graba las pantallas, arma el cierre con el logo y renderiza.

> `/home/qazuor/projects/WEBS/marketing` es la carpeta de assets de marketing (`HOSPEDA_MARKETING_ASSETS_DIR`), fuera del repo.

> **Regla:** La ficha pública de un local no muestra teléfono ni WhatsApp: el video no promete que «te escriben directo».

## Hailuo · tirada T1 (se pide 6 s, se usa 4,0 s)

**Adjuntar y reemplazar:**

- `@######ESCENA#######` → /home/qazuor/projects/WEBS/marketing/escenas/escena10.png
- `@######PERSONAJE#######` → /home/qazuor/projects/WEBS/marketing/personaje/personaje.png
- `@######POSES#######` → /home/qazuor/projects/WEBS/marketing/personaje/poses.png
- `@######EXPRESIONES#######` → /home/qazuor/projects/WEBS/marketing/personaje/expresiones.png
- `@######BOCAS#######` → /home/qazuor/projects/WEBS/marketing/personaje/bocas.png
- `@######ACCIONES#######` → /home/qazuor/projects/WEBS/marketing/personaje/acciones.png
- `@######LOGO#######` → apps/web/src/assets/images/logo.webp (otra vez en cada tirada)
- `@######VOZ#######` → /home/qazuor/projects/WEBS/marketing/personaje/voz.wav
- `@######PANTALLA#######` → captura real del listado de Comer y salir, en el celular

````
FORMAT: 3D animated character film, vertical 9:16, one continuous shot, no cuts, 6
seconds. This clip is ONE SHOT INSIDE A LARGER EDIT: only its first 4,0 seconds will
be used, so the action must happen early and then settle.

THE REFERENCES: @######ESCENA####### is the starting point of this video: the same character, the same restaurant behind him, the same full-body framing and the same light. @######PERSONAJE####### and @######POSES####### define exactly how the character looks and his proportions. @######EXPRESIONES####### defines his facial expressions. @######BOCAS####### defines the mouth shapes he uses when he speaks. @######ACCIONES####### defines his body poses. @######LOGO####### is the exact brand logo printed on his sweatshirt: copy it as it is, never redraw it. @######VOZ####### is the voice: clone that timbre, that accent and that age. @######PANTALLA####### is a real screenshot of a website open in a mobile browser: it is exactly what is displayed on the phone screen, and it must be reproduced faithfully, never redesigned or reinvented.

OPENING COMPOSITION: A closer view than @######ESCENA#######, a medium shot — chest and head — with the phone at chest height, screen to the camera. The restaurant softly out of focus.

ACTION, IN ORDER: In the VERY FIRST FRAME he is ALREADY SPEAKING — do not start with a pause, a breath or a look. He asks with an ALEGRE expression, counting on the fingers of his free hand the way ENUMERANDO appears in @######ACCIONES#######. When the action is over he holds the pose, breathing and blinking. He does not start any new movement.

TIMING, as fractions of the shot — never as seconds, so it still holds if the clip comes
out longer than requested:
0-53% he speaks the line(s) below in one flowing delivery while doing the action.
53-100% he holds the final pose, breathing and blinking, with no new action. No drift, no creeping, no scale change.

DIALOGUE: warm, clear, conversational male Argentine voice from @######VOZ#######, young
adult, moderate pace, close and friendly, not announcer-like. Mouth shapes from
@######BOCAS#######.

The character (S1) faces the camera and says: [Spanish] ¿Tenés un carrito, una rotisería o un resto bar?

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

SOUND: soft restaurant ambience, distant cutlery and murmur. No music.
````

## Hailuo · tirada de voz (15 s, sólo el audio)

**Adjuntar y reemplazar:**

- `@######VOZ#######` → /home/qazuor/projects/WEBS/marketing/personaje/voz.wav
- `@######ESCENA#######` → /home/qazuor/projects/WEBS/marketing/escenas/escena10.png

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
0-21% he speaks the FIRST sentence.
21-23% a SHORT pause.
23-42% he speaks the SECOND sentence.
42-44% a SHORT pause.
44-56% he speaks the THIRD sentence.
56-58% a SHORT pause.
58-76% he speaks the FOURTH sentence.
76-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace. Do not slow it down, do not stretch it to fill the 15 seconds, and do not insert
any pause other than the short ones listed above.

FIRST sentence: [Spanish] ¿Tenés un carrito, una rotisería o un resto bar?

SECOND sentence: [Spanish] Que te encuentren los que buscan dónde comer o salir.

THIRD sentence: [Spanish] Con tu mapa, tus fotos y tus redes.

FOURTH sentence: [Spanish] Sumá tu local en hospeda.com.ar.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room.
````

## Montaje · prompt para Claude Code

````
Armá en Remotion el video de venta VH4 · «Que te encuentren para comer o salir» (14,0 s).

ANTES DE EMPEZAR, leé: marketing/videos/REGLAS.md, marketing/videos/README.md,
marketing/personaje-hospedin.md y marketing/prompts/grabaciones.md. Usá la composición
src/a1/ como molde. Trabajá en un worktree cortado de staging; lo generado (tomas,
audio, renders) vive en /home/qazuor/projects/WEBS/marketing/video-lab/, nunca en el repo.

MATERIAL QUE TE PASO en /home/qazuor/projects/WEBS/marketing/video-lab/ventas/vh4/:
- t1.mp4: la tirada T1 de Hailuo.
- voz.mp4: la tirada de voz. Usá SOLO su audio; tirá el audio de las demás tiradas.

GRABACIÓN: la grabás vos con el grabador de marketing/videos, con el dispositivo de
referencia (config/device.ts) y la puesta en escena de demo (DEMO_HIDE_CSS).
- T2: P8 · Gastronomía: listado y ficha. Del listado a una ficha: fotos, mapa y redes. Un local con buenas fotos.

HOJA DE CORTE (cortes secos, en múltiplos de 0,5 s):
| Toma | En la timeline | Dura | De dónde sale | Voz |
|---|---|:-:|---|---|
| T1 | 0,0 → 4,0 | 4,0 | tirada T1 · 6 s, se usa 0,0 → 4,0 | «¿Tenés un carrito, una rotisería o un resto bar?» |
| T2 | 4,0 → 10,0 | 6,0 | grabación P8 · Gastronomía: listado y ficha | «Que te encuentren los que buscan dónde comer o salir.» «Con tu mapa, tus fotos y tus redes.» |
| T3 | 10,0 → 14,0 | 4,0 | cierre en Remotion | «Sumá tu local en hospeda.com.ar.» |

LA VOZ: la pista es una sola tirada; cortala entre frases y ubicá cada frase en su toma.

TEXTOS EN PANTALLA (exactos, Geologica para títulos, Roboto para el resto):
- T1: «Carrito, rotisería o resto bar»
- T2: «Mapa · Fotos · Redes»

EL CIERRE (4,0 s): logo que entra, «Sumá tu local» palabra por palabra, píldora
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

ENTREGA: render 1080×1920, 30 fps, en /home/qazuor/projects/WEBS/marketing/video-lab/out/vh4.mp4. Un render
por vez: después del primero esperá mis correcciones. El sonido lo valido yo.
````
