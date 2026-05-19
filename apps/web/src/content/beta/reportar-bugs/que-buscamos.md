---
title: Qué cosas estamos buscando
description: Lo que esperamos que funcione hoy en Hospeda, por tipo de usuario, y las categorías de problemas que nos interesa que encuentres.
order: 2
role: reportar-bugs
section: Reportar bugs
---

# Qué cosas estamos buscando

Esta página tiene dos partes:

1. **Qué tiene que funcionar hoy** — separado por tipo de usuario, para que sepas qué probar.
2. **Qué tipo de problema buscamos** — las categorías que nos interesan, con ejemplos.

Si algo que figura como "tiene que funcionar" no funciona, **es error (bug)**. Si algo no figura, capaz todavía no lo hicimos — mirá [Próximas funcionalidades](/beta/empezar/proximas-funcionalidades/) y [Cosas que parecen error pero no lo son](/beta/reportar-bugs/que-no-es-bug/).

---

## Parte 1 — Lo que tiene que funcionar hoy

### Si sos turista (entrás a buscar dónde alojarte)

#### Cuenta

- Te podés **registrar** con email + contraseña, con Google o con Facebook.
- Te llega un **email de verificación** y al apretar el enlace tu cuenta queda activa.
- **Iniciás sesión** con email + contraseña, Google o Facebook.
- **"Olvidé mi contraseña"** te manda un enlace al correo y podés cambiarla.
- **Cerrás sesión** y volvés a entrar sin trabarte.
- **Editás tu perfil**: nombre, email, avatar, ubicación, redes. Se guardan los cambios.
- Cambiás **idioma** (español, inglés, portugués) y se acuerda la próxima vez que entrás.
- Cambiás **tema** (claro / oscuro / sistema) y se acuerda.
- En **preferencias** podés configurar notificaciones, privacidad, cookies.

#### Buscar y explorar

- **Buscador general** arriba: encuentra alojamientos, destinos, eventos y publicaciones de blog mientras escribís.
- **Catálogo de alojamientos** con filtros (precio, capacidad, comodidades, fecha) y paginación.
- **Catálogo por tipo** (cabaña, hotel, apartamento, etc.).
- **Mapa** con marcadores: tocás uno y ves un resumen del alojamiento.
- **Catálogos de destinos, eventos y blog**, cada uno con sus filtros (por categoría, autor, etiqueta según el caso).
- **Paginación** funciona en todos los listados.

#### Detalle de un alojamiento

- **Galería** de fotos con vista ampliada (lightbox).
- **Descripción, comodidades, características** del lugar.
- **Precio por noche** y formato claro.
- **Mapa de ubicación** con un punto aproximado y aviso de que es aproximado.
- **Reseñas** con puntaje global y por categoría (limpieza, comunicación, etc.).
- **Datos del propietario** y formas de contacto (si las cargó).
- **Carrusel** de alojamientos parecidos al final.
- **Botón de favorito** funciona logueado y pide login si no lo estás.

#### Favoritos y colecciones

- Marcás como favorito alojamientos, destinos, eventos y publicaciones.
- Creás hasta 10 **colecciones** con nombre, color e ícono.
- **Movés** favoritos entre colecciones.
- **Editás** y **borrás** colecciones (los favoritos no se pierden).
- Le ponés **notas** a un favorito.

#### Mensajería con propietarios

- Desde el detalle de un alojamiento mandás un mensaje al propietario.
- Si no tenés cuenta, te mandamos un email con un enlace para abrir la conversación.
- Si tenés cuenta, la conversación queda en tu **bandeja de mensajes** (`/mi-cuenta/messages/`).
- Ves el **historial completo** y respondés.

#### Reseñas

- Leés reseñas de alojamientos con puntaje y comentarios.
- Si fuiste a un alojamiento, **dejás tu reseña** (estrellas + texto).
- Ves **tus reseñas** desde tu cuenta.

#### Suscripciones de turista (Plus, VIP)

- Ves los planes disponibles en `/suscriptores/precios/`.
- Te suscribís y te redirige a Mercado Pago.
- Después de pagar, ves tu plan activo en `Mi cuenta → Suscripción`.
- Ves el **historial de pagos**.

#### Otras cosas

- **Newsletter**: te suscribís desde el pie de página con tu email.
- **Páginas estáticas** funcionan y se entienden: nosotros, FAQ, beneficios, contacto, términos, privacidad, cookies.
- **Formulario de contacto** envía bien y te confirma.
- **Banner de cookies** aparece la primera vez, podés aceptar o personalizar, queda guardado.
- **Botón naranja flotante "Reportar problema"** está en todas las páginas.

---

### Si sos propietario o anfitrión

Además de todo lo de turista:

#### Empezar como propietario

- Te registrás como propietario sin trabarte en la bienvenida inicial.
- Apretás **"Publicar"** o **"Publicá tu alojamiento"** y te lleva al miniformulario.
- El **miniformulario** (Nombre, Tipo, Ciudad, Resumen) crea el alojamiento como borrador y te redirige al panel admin.

#### Gestionar tus alojamientos

- Ves **"Mis propiedades"** desde el menú de usuario, con cada alojamiento como tarjeta (foto, nombre, precio, estado, botones).
- Apretás **"Editar"** y te lleva al asistente del panel admin con 8 secciones (datos básicos, ubicación, capacidad, comodidades, fotos, precio, contacto, publicar).
- Cambiás datos en cualquier sección y al guardar se actualizan en el sitio público.
- **Subís hasta 20 fotos** por alojamiento.
- **Publicás / despublicás** un alojamiento y se refleja en la búsqueda pública.
- Apretás **"Ver en el sitio"** y se abre el detalle público.

#### Mensajes recibidos

- Cuando un turista te escribe, te llega a tu **bandeja** (`/mi-cuenta/messages/`).
- Ves la conversación, el huésped, el alojamiento, el estado.
- **Respondés** y la conversación queda en historial.
- Tenés acciones disponibles: archivar, bloquear, cerrar, reabrir, eliminar conversación.

#### Suscripción y pagos

- Ves los planes para propietarios (Owner Basic, Pro, Premium o Complex).
- Te suscribís y te redirige a Mercado Pago.
- Después de pagar, ves tu suscripción activa con plan, próxima renovación e historial.
- Tenés **14 días de prueba gratuita** al empezar.

---

### Si sos admin (te avisamos por privado)

Además de todo lo anterior:

#### Tablero principal del panel

- Entrás al panel admin con tus credenciales y ves el **dashboard**: métricas generales, gráfico de tráfico, actividad reciente.

#### Contenido

- Crear / editar / eliminar / listar:
  - **Alojamientos** (todos los del sitio, no solo los tuyos)
  - **Destinos** y **atracciones de destino**
  - **Eventos**, **ubicaciones de eventos** y **organizadores de eventos**
  - **Publicaciones del blog** (con SEO y patrocinio por post)
  - **Comodidades** y **características**
- **Buscar y filtrar** en cada listado por sus campos típicos.

#### Acceso, usuarios, permisos

- Listar usuarios, editar, cambiar estado, ver actividad de cada uno.
- Asignar / sacar permisos y roles.
- Ver listados maestros de **roles** y **permisos** (no los toques sin coordinar).

#### Etiquetas (tags)

- **Post tags** (etiquetas del blog): crear, editar, listar.
- **Etiquetas del sistema**: listas internas (admin-only).
- **Etiquetas internas**: idem.
- **Moderación de etiquetas creadas por usuarios**.

#### Mensajería (vista admin)

- Ves **todas** las conversaciones del sistema con filtros (estado, participantes, fecha).
- Podés abrir cualquier conversación y moderarla.

#### Patrocinadores y patrocinios

- CRUD de patrocinadores (marcas).
- Crear patrocinios asociando una marca a una publicación, con duración y monto.
- ⏳ **Próximamente**: pantalla de analítica de patrocinador (la página existe pero el contenido todavía no está completo).

#### Newsletter

- Crear y enviar **campañas** (con preview y confirmación antes de mandar).
- Métricas por campaña: aperturas, clics, entregas fallidas.
- Listar y filtrar **suscriptores** del newsletter.

#### Facturación (billing)

- **Planes** (gestionados desde código, los ves pero no se editan desde el panel).
- **Suscripciones**: listar, filtrar por estado, abrir detalle.
- **Add-ons**: crear, listar, asignar.
- **Pagos**: listar, filtrar, abrir y procesar **reembolsos**.
- **Facturas**: listar, generar nueva, descargar PDF.
- **Códigos promocionales**: crear, listar, editar.
- **Promociones de propietarios** (distintas de los códigos): crear y listar.
- **Tasas de cambio** ARS/USD: ver y actualizar.
- **Métricas de billing**: MRR, ARR, ARPU, churn.
- **Tareas programadas** (cron jobs): ver y disparar manualmente.

#### SEO y revalidación

- Configurar metadatos, robots.txt, datos estructurados.
- **Revalidación ISR** (refrescar caché de páginas estáticas): config por tipo de entidad, ver logs, disparador manual.

#### Configuración crítica

- Acceso a settings sensibles del sistema (no la toques sin avisar).

**Procesos guiados** (combinaciones de varios módulos)

- Crear destino con todo (atracciones + alojamiento + verificación pública).
- Gestionar suscripción de propietario de punta a punta.
- Moderar reseñas.
- Publicar un post con SEO y patrocinio incluido.

---

### Si sos editor (te avisamos por privado)

Lo que sí ves desde el panel admin:

- **Publicaciones del blog**: crear, editar, configurar SEO, asignar patrocinio.
- **Post tags**: crear, listar, editar.
- **Tu perfil de editor**: nombre, foto, contraseña.
- **Mensajería**: ver conversaciones del sistema.

Lo que NO ves (es esperado, no lo reportes):

- Billing (planes, pagos, facturas, promociones).
- Acceso (usuarios, roles, permisos).
- Etiquetas del sistema, etiquetas internas, moderación de etiquetas de usuario.
- Patrocinadores.
- Configuración crítica, revalidación, SEO global.
- Newsletter.
- Analítica avanzada.

---

### Cosas transversales (todos los roles)

Estas tienen que funcionar para cualquier tipo de usuario:

- **Cambio de idioma** (es / en / pt). Lo que esté traducido aparece en el idioma elegido; lo no traducido cae a español.
- **Cambio de tema** (claro / oscuro / sistema). Se acuerda la próxima vez.
- **Modo adaptable al dispositivo (responsive)**: ves bien el sitio en celular vertical, celular horizontal, tablet y computadora.
- **Animaciones de aparición** al scrollear (no son obligatorias pero deberían ser suaves).
- **Notificaciones flotantes** (las cartelitas que aparecen tras guardar o un error) salen y se cierran solas.
- **Páginas de error**: si entrás a una URL inventada, ves un 404 customizado, no una página en blanco.
- **Banner de cookies** en la primera visita.
- **Botón flotante naranja "Reportar problema"** está en todas las páginas (excepto admin) y funciona.
- **Accesibilidad básica**: podés navegar con teclado, los iconos importantes tienen etiqueta (aria-label), el contraste es legible.

---

## Parte 2 — Qué tipo de problema buscamos

### a) Funcionamiento — ¿hace lo que dice?

**La categoría más importante.** Si algo que figura en la Parte 1 no anda, es **error crítico**. "El paso 4 se rompió" vale más que veinte detalles cosméticos.

### b) Rendimiento — ¿anda lento o se traba?

No esperamos que sea instantáneo, pero tampoco que te tengas que esperar 10 segundos. Ejemplos de lo que nos interesa:

- La home o el catálogo **tardan más de 3 segundos** en cargar la primera vez (en WiFi normal o 4G en el celular).
- Apretás un botón y **no pasa nada por más de 1 segundo** sin ningún indicador visual (ni cargando, ni cambio de color).
- El **scroll va a saltitos** cuando pasás por el mapa, la galería o un listado largo.
- Las **imágenes** del catálogo tardan en aparecer aunque la página ya cargó.
- **Filtrar** un listado largo (más de 20 items) tarda varios segundos.
- Recargás la página y **pierde el estado** (filtros aplicados, posición de scroll, etc.).
- En el panel admin, abrir una tabla grande te **traba el navegador** unos segundos.
- Animaciones de aparición que se ven **a tirones** en lugar de suaves.

Anotá qué dispositivo, qué conexión (WiFi / 4G) y qué hora estimada — capaz es del momento, capaz es del sitio.

### c) Accesibilidad — ¿se puede usar bien?

- Texto muy chico para leer cómodo.
- Botones chiquitos o demasiado pegados entre sí.
- Contraste pobre (texto gris claro sobre fondo blanco).
- Iconos sin etiqueta que no se entienden solos.
- No se puede navegar con teclado (Tab + Enter).
- Si tu familiar mayor usa el sitio: ¿le costaría leer o moverse?

### d) Visuales — ¿se ve bien?

- Texto **cortado** o que se sale de su caja.
- Elementos **mal alineados** o pegados de forma rara.
- **Imágenes rotas** o que no cargan.
- **Colores** que no pegan con el resto.
- **Sombras o bordes** que aparecen donde no deberían.
- **Espaciado** raro entre secciones.
- En modo oscuro: texto que **no se lee** o queda invisible.

### e) Idiomas (i18n)

- Palabras en **inglés** cuando elegiste español.
- Traducciones **raras** o sin sentido.
- Pedazos sin traducir mezclados con texto traducido.
- Errores de **ortografía** o gramática.
- Mensajes técnicos en inglés ("Network error", "Forbidden") que deberían estar traducidos.

### f) Adaptable al dispositivo (responsive)

Las pantallas se acomodan según el tamaño del dispositivo. Estas son las cosas que se rompen seguido:

- **Celular OK, computadora rota** o al revés.
- Achicás la ventana en compu y antes de llegar al tamaño de tablet (~1024px) algo **se desarma**.
- Girás el celular a **horizontal** y algo queda raro.
- El **menú de hamburguesa** en celular no abre, o abre y no cierra.
- **Tablas** que en celular pierden columnas o se cortan sin scroll lateral.
- **Texto** que en celular se sale del contenedor.
- Una **ventana emergente (modal)** ocupa toda la pantalla en computadora (debería ser chica).
- El **mapa interactivo** no responde a gestos de celular (pinch, drag).
- **Botones pegados entre sí** en celular, hacés tap y le pegás al de al lado.
- Imágenes que aparecen **estiradas o deformadas** en algún tamaño.

### g) Pagos y suscripciones

- Pago que da **error** o queda colgado.
- Monto **distinto al esperado** entre el plan elegido y lo que ves en Mercado Pago.
- Pagaste y la suscripción **no se activó**.
- **Emails de confirmación** que no llegan (o llegan duplicados).
- Renovación que falla o que cobra a destiempo.

> **Tarjetas de prueba** que no son reales. Mirá [Pagos de prueba](/beta/pagos/pagos-de-prueba/). **NO USES TU TARJETA REAL** salvo que seas uno de los 2 testers de [pago real](/beta/pagos/pago-real/introduccion/).

### h) Facilidad de uso y claridad

¿Se entiende qué hacer en cada pantalla? ¿Los nombres tienen sentido? ¿Hay pasos confusos? Acá nos importa todo lo que te haga **dudar, frenarte o sentir que algo no se entiende**, incluso si "técnicamente funciona".

#### En el sitio público (web)

- Botones o enlaces cuyo nombre no dice qué pasa al apretarlos.
- Pantallas sin título, o con un título ambiguo (ej. "Configuración" cuando es "Editar mi perfil").
- Formularios donde no se entiende **qué dato pide un campo**, o si es obligatorio.
- Mensajes de error genéricos ("Algo salió mal") sin pista de qué hacer.
- Estados vacíos ("no tenés favoritos") que no explican cómo empezar.
- Acciones que **borran cosas** y no piden confirmación, o la piden mal.
- Después de una acción importante, **no hay confirmación visible** ("¿se guardó?").
- Iconos sin texto que no se entienden solos.
- Te perdés volviendo a la home o a "Mi cuenta" desde donde estás (te falta el camino de regreso).
- Onboarding o primera carga que te tira a una pantalla sin saber **qué hacer primero**.

#### En el panel admin

- Menú lateral con etiquetas **técnicas** que no se entienden ("ISR Revalidation", "Webhook Events").
- **Tablas** sin cabecera clara o con columnas con siglas sin tooltip.
- **Filtros** que no recuerdan tu última selección al volver a la pantalla.
- Modales o ventanas largas **sin scroll** o sin botón "Guardar" visible.
- Procesos donde no queda claro **si lo que apretaste tuvo efecto** (no hay notificación flotante, no cambia nada visible).
- Errores de permisos que dicen "Forbidden" o "403" en vez de "no tenés acceso a X".
- Campos que validan al enviar pero **no avisan antes** (ej. email mal formateado).
- Acciones que requieren **5 o más clics** donde podrían ser 2 o 3.
- Pantallas que no aparecen en el menú lateral pero existen por URL directa (reportá que les falta el item del menú).
- **Términos en inglés** en el panel sin traducir ("Subscriptions", "Sponsors") que confunden al editor o admin no técnico.

## Próximo paso

**[Cómo intentar romper el sistema](/beta/reportar-bugs/intentar-romper/)** — la parte más divertida.
