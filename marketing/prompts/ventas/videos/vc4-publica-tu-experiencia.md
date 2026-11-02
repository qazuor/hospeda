# VC4 · Publicá tu experiencia

Video de venta · Experiencias. Índice en [`../README.md`](../README.md).

Lo hace **Claude Code** de punta a punta con el pipeline de Remotion de `marketing/videos/`.

---

- **Para quién:** Guías y prestadores de actividades
- **Formato:** vertical 9:16, 1080×1920, para WhatsApp e Instagram
- **Insignia de prueba gratis:** sí, en el cierre
- **Duración:** 25 a 30 s

**La idea:** Mostrar el alta de una experiencia y cómo la ve el turista.

## Prompt para Claude Code

````
Hacé en Remotion el video de venta VC4 · «Publicá tu experiencia» (25 a 30 s).

PARA QUIÉN: Guías y prestadores de actividades.
LA IDEA: Mostrar el alta de una experiencia y cómo la ve el turista.

ANTES DE EMPEZAR, leé: marketing/videos/REGLAS.md (todas sus reglas valen: formato,
dispositivo de referencia, nivel estudio, sonido), marketing/videos/README.md,
marketing/personaje-hospedin.md y marketing/prompts/grabaciones.md. La composición
src/a1/ es el molde: intro → tutorial → cierre. Trabajá en un worktree cortado de
staging; lo generado vive en /home/qazuor/projects/WEBS/marketing/video-lab/, nunca en el repo.

GRABACIÓN (pantallas reales, vista mobile del dispositivo de referencia):
- Cuenta: experience-owner@local.test.
- Qué grabar: Alta de una experiencia desde /publicar/experiencias/ hasta publicada.
  1. Datos de la salida.
  2. Fotos y punto de encuentro.
  3. Publicar; la ficha pública.
- Escribí el grabador como record/record-vc4.mts, siguiendo record-a1.mts
  (eventos con su caja en pantalla, scroll suave, DEMO_HIDE_CSS).

GUION:
- Intro (2,2 s): «¿Querés mostrar tu salida?» palabra por palabra, con Hospedín grande.
- Etapa 1 · chip «1/3 · Tu salida»: Hospedín entra y dice «Contás de qué se trata.». Tipeo con jump cut.
- Etapa 2 · chip «2/3 · Fotos»: Hospedín entra y dice «Sumás tus mejores fotos.». Carga de fotos.
- Etapa 3 · chip «3/3 · Publicada»: Hospedín entra y dice «¡Y el turista ya la ve!». La ficha pública.
- Cierre (4 s): logo, «Publicá tu experiencia» palabra por palabra, píldora hospeda.com.ar, insignia «30 días de prueba gratis · Sin tarjeta», Hospedín festejando (pose vamos).

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
- Hoy no se vende el cupo por Hospeda: nada de reservas ni pagos en el video.
- Resolvé conmigo el plan activo antes de grabar (REGLAS.md, «Pendiente de definir»).

ENTREGA: render 1080×1920, 30 fps, en /home/qazuor/projects/WEBS/marketing/video-lab/out/vc4.mp4. Antes de
grabar, mostrame el guion con los tiempos. Un render por vez: después del primero esperá
mis correcciones. El sonido lo valido yo.
````
