# VC5 · Lo que ve el turista

Video de venta · Para todas. Índice en [`../README.md`](../README.md).

Lo hace **Claude Code** de punta a punta con el pipeline de Remotion de `marketing/videos/`.

---

- **Para quién:** Cualquier prospecto que pregunta «¿y cómo se ve?»
- **Formato:** vertical 9:16, 1080×1920, para WhatsApp e Instagram
- **Insignia de prueba gratis:** no
- **Duración:** 20 a 25 s

**La idea:** Recorrido por una ficha pública: traducción automática, mapa y qué hay cerca. El clima no va: vive en la página del destino, no en la ficha.

## Prompt para Claude Code

````
Hacé en Remotion el video de venta VC5 · «Lo que ve el turista» (20 a 25 s).

PARA QUIÉN: Cualquier prospecto que pregunta «¿y cómo se ve?».
LA IDEA: Recorrido por una ficha pública: traducción automática, mapa y qué hay cerca. El clima no va: vive en la página del destino, no en la ficha.

ANTES DE EMPEZAR, leé: marketing/videos/REGLAS.md (todas sus reglas valen: formato,
dispositivo de referencia, nivel estudio, sonido), marketing/videos/README.md,
marketing/personaje-hospedin.md y marketing/prompts/grabaciones.md. La composición
src/a1/ es el molde: intro → tutorial → cierre. Trabajá en un worktree cortado de
staging; lo generado vive en /home/qazuor/projects/WEBS/marketing/video-lab/, nunca en el repo.

GRABACIÓN (pantallas reales, vista mobile del dispositivo de referencia):
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
- Cuenta: ninguna: es la ficha pública, sin login.
- Qué grabar: P5 · Ficha de alojamiento completa, sección por sección.
  1. Fotos y descripción; cambiar el idioma a inglés y a portugués.
  2. Mapa y «Qué hay cerca», con distancias.
- Escribí el grabador como record/record-vc5.mts, siguiendo record-a1.mts
  (eventos con su caja en pantalla, scroll suave, DEMO_HIDE_CSS).

GUION:
- Intro (2,2 s): «¿Cómo te ve el turista?» palabra por palabra, con Hospedín grande.
- Etapa 1 · chip «1/2 · En su idioma»: Hospedín entra y dice «Tu ficha, en su idioma.». El cambio de idioma.
- Etapa 2 · chip «2/2 · Qué hay cerca»: Hospedín entra y dice «Mapa y qué hay cerca.». Mapa y lugares con distancia.
- Cierre (4 s): logo, «Sumate a Hospeda» palabra por palabra, píldora hospeda.com.ar, Hospedín festejando (pose vamos).

EL LOGO: antes de armar el cierre, y otra vez antes de cada render nuevo o de cada
corrección, pedime el logo. Usá exactamente el archivo que te pase (por defecto
apps/web/src/assets/images/logo.webp): sin redibujarlo, sin recolorearlo, sin
deformarlo y sin vectorizarlo a mano.

REGLAS DE CONTENIDO (no se negocian):
- Cero precios en pantalla y en la voz.
- Nada que no exista como si funcionara; lo que viene dice «Próximamente».
- Pantallas reales de Hospeda, grabadas con una cuenta del seed, nunca con super admin.
- Ningún destino por encima de otro; sin cupones; sin métricas ni testimonios inventados.
- Airbnb, Booking y Google se nombran sólo en calendario y reputación, nunca con su logo.
- Voseo rioplatense en todo el texto.
- Elegí una ficha de un destino cualquiera de la lista aprobada, sin destacarlo en el texto.

ENTREGA: render 1080×1920, 30 fps, en /home/qazuor/projects/WEBS/marketing/video-lab/out/vc5.mp4. Antes de
grabar, mostrame el guion con los tiempos. Un render por vez: después del primero esperá
mis correcciones. El sonido lo valido yo.
````
