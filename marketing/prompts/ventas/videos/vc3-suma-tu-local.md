# VC3 · Sumá tu local

Video de venta · Comer y salir. Índice en [`../README.md`](../README.md).

Lo hace **Claude Code** de punta a punta con el pipeline de Remotion de `marketing/videos/`.

---

- **Para quién:** Locales gastronómicos y de noche
- **Formato:** vertical 9:16, 1080×1920, para WhatsApp e Instagram
- **Insignia de prueba gratis:** sí, en el cierre
- **Duración:** 25 a 30 s

**La idea:** Cargar un local es corto: datos, fotos, mapa y redes.

## Prompt para Claude Code

**Adjuntar y reemplazar:**

- `Nada al empezar: Claude graba las pantallas reales en staging.` → undefined
- `Logo: apps/web/src/assets/images/logo.webp, cuando Claude lo pida (antes del cierre y antes de cada render o corrección)` → undefined

````
Hacé en Remotion el video de venta VC3 · «Sumá tu local» (25 a 30 s).

PARA QUIÉN: Locales gastronómicos y de noche.
LA IDEA: Cargar un local es corto: datos, fotos, mapa y redes.

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
- Cuenta: una cuenta de dueño de local en staging.
- Qué grabar: Alta de un local desde /publicar/comer-y-salir/ hasta publicado.
  1. Datos del local y rubro.
  2. Fotos y ubicación.
  3. Redes y publicar; la ficha pública.
- Escribí el grabador como record/record-vc3.mts, siguiendo record-a1.mts
  (eventos con su caja en pantalla, scroll suave, DEMO_HIDE_CSS).

GUION:
- Intro (2,2 s): «¿Querés sumar tu local?» palabra por palabra, con Hospedín grande.
- Etapa 1 · chip «1/3 · Tu local»: Hospedín entra y dice «Contás qué es tu local.». Tipeo con jump cut.
- Etapa 2 · chip «2/3 · Fotos y mapa»: Hospedín entra y dice «Fotos y dónde encontrarte.». Carga de fotos y pin del mapa.
- Etapa 3 · chip «3/3 · Publicado»: Hospedín entra y dice «¡Listo, ya te encuentran!». La ficha pública.
- Cierre (4 s): logo, «Sumá tu local» palabra por palabra, píldora hospeda.com.ar, insignia «30 días de prueba gratis · Sin tarjeta», Hospedín festejando (pose vamos).

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
- El mapa de locales todavía no existe: la toma del mapa se presta del editor de alojamientos, tapando todo lo que diga alojamiento (decisión del dueño), y se regraba cuando entre. El video no se manda hasta entonces.
- En el copy se dice «tu local»; «menú» o «carta» sólo si se muestra esa sección.
- La ficha pública de un local no muestra teléfono: no prometas que te escriben directo.

ENTREGA: render 1080×1920, 30 fps, en /home/qazuor/projects/WEBS/marketing/video-lab/out/vc3.mp4. Antes de
grabar, mostrame el guion con los tiempos. Un render por vez: después del primero esperá
mis correcciones. El sonido lo valido yo.
````
