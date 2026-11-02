# VC2 · Ya lo tenés publicado: importalo

Video de venta · Alojamientos. Índice en [`../README.md`](../README.md).

Lo hace **Claude Code** de punta a punta con el pipeline de Remotion de `marketing/videos/`.

---

- **Para quién:** Quien ya tiene su aviso en otra plataforma
- **Formato:** vertical 9:16, 1080×1920, para WhatsApp e Instagram
- **Insignia de prueba gratis:** sí, en el cierre
- **Duración:** 20 a 25 s

**La idea:** Pegás el link de tu aviso y la ficha se completa sola. Versión motion graphics de V1, sin tiradas de Hailuo.

## Prompt para Claude Code

````
Hacé en Remotion el video de venta VC2 · «Ya lo tenés publicado: importalo» (20 a 25 s).

PARA QUIÉN: Quien ya tiene su aviso en otra plataforma.
LA IDEA: Pegás el link de tu aviso y la ficha se completa sola. Versión motion graphics de V1, sin tiradas de Hailuo.

ANTES DE EMPEZAR, leé: marketing/videos/REGLAS.md (todas sus reglas valen: formato,
dispositivo de referencia, nivel estudio, sonido), marketing/videos/README.md,
marketing/personaje-hospedin.md y marketing/prompts/grabaciones.md. La composición
src/a1/ es el molde: intro → tutorial → cierre. Trabajá en un worktree cortado de
staging; lo generado vive en /home/qazuor/projects/WEBS/marketing/video-lab/, nunca en el repo.

GRABACIÓN (pantallas reales, vista mobile del dispositivo de referencia):
- Cuenta: host-basico@local.test.
- Qué grabar: A10 · Importar ficha: pegar el link, esperar, la ficha aparece completa.
  1. Abrir el importador desde /publicar/.
  2. Pegar el link de un aviso (sin que se vea el logo de Airbnb ni de Booking).
  3. Esperar la carga y hacer scroll por la ficha completa.
- Escribí el grabador como record/record-vc2.mts, siguiendo record-a1.mts
  (eventos con su caja en pantalla, scroll suave, DEMO_HIDE_CSS).

GUION:
- Intro (2,2 s): «¿Ya estás publicado en otro lado?» palabra por palabra, con Hospedín grande.
- Etapa 1 · chip «1/2 · Pegá el link»: Hospedín entra y dice «Pegás el link de tu aviso.». Foco en el campo del link.
- Etapa 2 · chip «2/2 · Se completa»: Hospedín entra y dice «Y tu ficha se completa sola.». La carga tapada con el barrido de marca y la ficha llena.
- Cierre (4 s): logo, «Publicá tu alojamiento» palabra por palabra, píldora hospeda.com.ar, insignia «30 días de prueba gratis · Sin tarjeta», Hospedín festejando (pose vamos).

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
- En la voz y los textos se dice «Google, Mercado Libre y otras plataformas», nunca Airbnb ni Booking.

ENTREGA: render 1080×1920, 30 fps, en /home/qazuor/projects/WEBS/marketing/video-lab/out/vc2.mp4. Antes de
grabar, mostrame el guion con los tiempos. Un render por vez: después del primero esperá
mis correcciones. El sonido lo valido yo.
````
