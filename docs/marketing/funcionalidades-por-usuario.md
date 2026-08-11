# Hospeda — Funcionalidades por tipo de usuario

> Base para el plan de contenido de redes.
> Fuente: catálogo de código del 2026-07-08 + delta verificado contra `origin/staging` al 2026-08-11.
> **Semáforo**: 🟢 disponible hoy · 🟡 en curso · 🔴 definido pero NO construido

---

## El semáforo NO excluye — asigna prioridad

**Toda funcionalidad entra a la lista de publicaciones, exista o no.** Lo que cambia es cuándo se produce:

| Semáforo | Prioridad | Significado |
|---|---|---|
| 🟢 disponible hoy | 1 a 4 | Se prioriza por valor comercial, no por disponibilidad |
| 🟡 en curso | **5** | Pieza escrita y diseñada, **guardada sin publicar** hasta que salga a producción |
| 🔴 no construido | **5** | Idem. El día que se construya, el contenido ya está listo |

**Prioridad 5 = No hacer aún.** Extiende la escala original (1 urgente · 2 primer mes · 3 mes 2-3 · 4 algún día) con un quinto nivel que significa *bloqueado por producto, no por importancia*. El contenido se piensa igual: cuando la funcionalidad sale, la publicación ya existe y se dispara el mismo día.

### Reglas que sí son innegociables

1. **Cero precios en las imágenes.** La grilla nueva (HOS-301) está decidida pero no implementada. Los precios se mencionan solamente en la página web, nunca dentro de una imagen.
2. **Una pieza de Prioridad 5 no se publica** hasta que la funcionalidad esté disponible y probada en la plataforma. Se produce, se guarda, se espera.
3. Excepción: la categoría **Novedades** puede publicar lo 🔴 como *lo que se viene*, siempre con la palabra "próximamente" adelante y nunca en tiempo presente.

---

## Idiomas — la plataforma está en tres

**es · en · pt**, con español por defecto. Los tres están construidos y funcionando, no son promesa.

Esto abre dos segmentos que hoy no se están trabajando:

- **Portugués** — brasileños. La costa del río Uruguay es corredor natural de entrada desde el norte.
- **Inglés** — turismo internacional de naturaleza y **pesca deportiva en el Río Uruguay**, extranjeros residentes en Argentina, y SEO internacional que hoy no tiene competencia en la región.

Propuesta de esquema: sumar un campo **Idioma** a cada ítem de la lista (`es` por defecto, `es/en/pt` donde valga la producción triple). Evita decidirlo pieza por pieza sobre la marcha.

---

## 1. Visitante anónimo — sin cuenta

**El 100% del catálogo es navegable sin registrarse.** Solo `/mi-cuenta/*` exige sesión. Este es el ángulo de marketing más fuerte y más desaprovechado: *no te pedimos nada para mirar*.

### Descubrimiento

- 🟢 Buscar y listar alojamientos con filtros: tipo, precio, huéspedes, dormitorios/baños, rating, comodidades, wifi, pileta, estacionamiento, acepta mascotas, distancia en el mapa
- 🟢 Ordenar por nombre, fecha, puntaje, cantidad de opiniones, destacado, "más guardado", precio, distancia — hasta 5 criterios combinados
- 🟢 Vista de lista y **vista de mapa** (por área visible del mapa)
- 🟢 Ficha completa de alojamiento: galería de fotos, comodidades, ubicación
- 🟢 Alojamientos por destino · similares · los mejor puntuados del destino
- 🟢 Búsqueda global unificada: alojamientos + destinos + eventos + notas, todo junto
- 🟢 Buscador con IA en lenguaje natural — **visible para todos, pero pide login al usarlo**

### Destinos y lugares

- 🟢 Destinos con jerarquía navegable (país → región → ciudad), con ruta de navegación
- 🟢 **Clima y pronóstico a 16 días** + condiciones en vivo por destino
- 🟢 Mapa de destinos con coordenadas exactas
- 🟢 Atracciones del destino
- 🟢 **Puntos de interés (POI)** con mapa multi-marcador en la ficha del destino

### Contenido

- 🟢 Eventos: listado, próximos, por organizador y ubicación, con comentarios (lectura)
- 🟢 Blog y notas turísticas: destacadas, por categoría, relacionadas, con etiquetas
- 🟢 Gastronomía y experiencias: listados, ficha, opiniones y preguntas frecuentes
- 🟢 **Página pública de autor** `/autores/<slug>/` — quién escribe cada nota
- 🟢 Suscripción por RSS a eventos y publicaciones
- 🟢 Perfil público del anfitrión con todos sus alojamientos

### Confianza

- 🟢 Opiniones públicas (solo las aprobadas)
- 🟢 **Reputación externa agregada**: puntajes de Booking, Airbnb y Google en un solo lugar
- 🟢 Contador "N personas lo guardaron"
- 🟢 Ofertas y promociones del anfitrión, con un distintivo en el listado y en la ficha
- 🟢 Testimonios en la home

### Contacto sin cuenta

- 🟢 **Consulta anónima al anfitrión** — iniciar conversación sin registrarse
- 🟢 Seguir y responder el hilo **con un enlace que llega al mail**, sin crear cuenta
- 🟢 Formulario de contacto general (13 tipos: soporte, prensa, publicar, reportar…)
- 🟢 Formularios "Colaborar": reportar info, enviar fotos, postularse como editor
- 🟢 Reportar un problema o mandar una sugerencia con hasta 5 imágenes
- 🟢 Suscripción a novedades por mail, con confirmación y baja en un clic
- 🟢 Formulario "sumar mi negocio"

### Otros

- 🟢 Tres idiomas: **es / en / pt**
- 🟢 Conversión de moneda / tasas de cambio
- 🟢 Preparado para aparecer bien en Google y para verse lindo al compartir un link

**Ángulos de contenido**: "Mirá todo sin registrarte" · "Escribile al anfitrión sin crear cuenta" · "El clima de tu escapada, a 16 días" · "Booking, Airbnb y Google juntos en una sola ficha"

---

## 2. Turista con cuenta — Free / Plus / VIP

| Funcionalidad | Free | Plus | VIP |
|---|---|---|---|
| Guardar favoritos | 5 | 25 | ∞ |
| Colecciones (listas temáticas) | – | 10 | 25 |
| Comparar alojamientos lado a lado | – | 3 | 5 |
| Alertas de precio | – | 5 | ∞ |
| Historial de búsquedas | – | 50 | 200 |
| Recomendaciones personalizadas | – | 🟢 | 🟢 |
| Ofertas exclusivas | – | 🟢 | 🟢 |
| Acceso VIP a promociones | – | – | 🟢 |
| Ver WhatsApp del anfitrión | – | 🟢 | 🟢 |
| WhatsApp directo | – | – | 🟢 |
| Buscador con IA (consultas/mes) | 10 | 50 | 200 |
| Chat IA con el alojamiento (consultas/mes) | 10 | 50 | 200 |
| Soporte prioritario | – | – | 🟢 |

**Siempre gratis, en todos los planes**: escribir y leer reseñas · mensajes con anfitriones (bandeja, hilos, no leídos) · perfil, avatar y preferencias · ver mi plan y límites · gestionar newsletter · comentar y dar like en posts y eventos · novedades.

🔴 Adjuntar fotos a reseñas — el permiso existe, la pantalla no.

**Ángulos**: "Guardá tus favoritos gratis" · "Te avisamos cuando baja el precio" · "Compará 3 cabañas lado a lado" · "Preguntale en criollo: cabaña con pileta para 4 cerca del río"

---

## 3. Anfitrión — Básico / Pro / Premium

**El gancho**: 🟢 **30 días gratis sin tarjeta**. No se pide método de pago para arrancar y los datos se conservan al vencer.

> Los días de prueba se configuran en la base de datos, no en el código. El número que vale es el que está cargado en producción — verificar ahí antes de imprimir nada, no en el código fuente.

| Funcionalidad | Básico | Pro | Premium |
|---|---|---|---|
| Alojamientos publicables | 1 | 3 | 10 |
| Fotos por alojamiento | 15 | 30 | 50 |
| Promociones activas | 2 | 5 | ∞ |
| Descripción enriquecida y video | – | 🟢 | 🟢 |
| Estadísticas avanzadas | – | 🟢 | 🟢 |
| Aparecer destacado | con un adicional | 🟢 | 🟢 |
| Insignia de verificación | – | – | 🟢 |
| Identidad visual propia | – | – | 🟢 |
| Soporte prioritario | – | 🟢 | 🟢 |
| Importar ficha con IA (por mes) | 10 | 50 | 250 |
| IA para mejorar textos (por mes) | 50 | 250 | 1.250 |
| IA para traducir (por mes) | 200 | 1.000 | 5.000 |
| IA: chat para huéspedes (por mes) | 50 | 250 | 1.250 |

**Incluido en todos los planes**: editar datos, comodidades, preguntas frecuentes y ubicación · editar cómo se ve la ficha en Google · estadísticas básicas (vistas, tasa de respuesta, consultas) · conectar los puntajes que ya tenés en Google, Booking y otros · **el paquete completo de turista VIP** (favoritos ∞, comparador, alertas ∞, colecciones 25, historial 200, IA 200/mes).

**Adicionales que se pueden sumar**: Visibility Boost destacar un alojamiento por 7 o 30 días (pago único) · 20 fotos más · 5 alojamientos más.

🟢 **Calendario de disponibilidad con sincronización** (HOS-157) — se conecta con Google Calendar y con otros calendarios por archivo `.ics`. Las fechas ocupadas se bloquean solas y evita reservas dobles. **Existe y funciona.**

🟢 **WhatsApp del anfitrión** — el dato está en la ficha del alojamiento y las consultas pueden llegar por ahí.

🟡 **Directorio de proveedores y oficios** (HOS-376) — plomería, gas, electricidad, cerrajería, climatización, limpieza. Con registro de uso del beneficio y valoraciones. Confirmar si ya está disponible.

🔴 **Responder reseñas** — todavía no está. El permiso existe, la pantalla no. Confirmado el 11/08/2026.

**Ángulos**: "30 días gratis, sin tarjeta" · "Pegá el link de Airbnb y la IA completa tu ficha" · "Tu ficha en 3 idiomas con un clic" · "Sos anfitrión y además viajás VIP gratis"

---

## 4. Gastronomía y Experiencias

Dominio de facturación **separado** del de alojamientos. La ficha es pública mientras la suscripción esté activa. El alta la gestiona el equipo (todavía sin checkout self-service).

- 🟢 Ficha pública propia con fotos, descripción rica, horarios, contacto, redes, menú o precios
- 🟢 Aparecer en listados y búsquedas
- 🟢 Reseñas moderadas y FAQs propias
- 🟢 Edición autogestionada de todo el contenido operativo
- 🟢 SEO de la ficha con editor dedicado
- 🟢 Lead público "sumar mi negocio"

Diferencia: Experiencia usa precio "desde / a consultar" y se oculta del detalle si no tiene suscripción activa.

**Ángulos**: "Tu restaurante donde la gente planea el viaje" · "Ficha propia, reseñas y buen Google" · "Vos editás, sin depender de nadie"

---

## 5. Marcas auspiciantes — ACTUALIZADO (HOS-294 + HOS-278)

⚠️ **Todo lo que decía el catálogo viejo acá quedó obsoleto.**

- 🟢 Dos niveles: **oro y plata**. El bronce ya no existe.
- 🟢 **Solo el nivel oro tiene página propia** `/partners/<slug>/`. Es exactamente lo que separa un tier del otro.
- 🟢 Plata: presencia en el carrusel y el logo linkea **afuera**, al sitio propio del partner.
- 🟢 **Ya hay self-service**: catálogo de planes, alta, claim, baja. Ya no es 100% gestionado por el equipo.
- 🟢 Registro de menciones del partner (HOS-377)
- ❌ El directorio filtrado `/partners/` **fue retirado por decisión del dueño y hoy 404ea**. No linkearlo en ninguna pieza.
- El nivel nunca se muestra públicamente.

**Ángulos**: "Tu marca donde el turismo del Litoral se encuentra" · "Página propia dentro de Hospeda" (solo nivel oro)

---

## 6. Patrocinadores de contenido

- 🟢 Crear y editar patrocinios de posts y eventos, autogestionado
- 🟢 Panel propio: overview, sponsorships, analíticas, facturas
- 🟢 Niveles y paquetes a elegir (catálogo administrado por el equipo)

**Ángulos**: "Patrociná las notas que la región lee" · "Panel propio con analíticas y facturas"

---

## 7. Editores y autores de contenido — NUEVO (HOS-374 / 375 / 318 / 393)

Público que **no estaba** en el catálogo viejo y hoy tiene producto propio.

- 🟢 **Crear posts y eventos desde el sitio web**, sin entrar al admin (editor de confianza)
- 🟢 **Página pública de autor** `/autores/<slug>/` con sus notas y eventos
- 🟢 Cuenta de editor con identidad visual y navegación por secciones propia
- 🟢 Editor de FAQs asistido por IA, con visibilidad por canal
- 🟢 Postulación pública "quiero ser editor" desde los formularios de Colaborar

**Ángulos**: "Escribí sobre tu ciudad y firmá con tu nombre" · "Tenés tu página de autor" · convocatoria abierta de redactores

---

## 8. Transversal — todos los usuarios

- 🟢 Tres idiomas (es / en / pt), español por defecto
- 🟢 SEO en todas las entidades: título y descripción propios, OG, sitemap dinámico, llms.txt
- 🟢 Newsletter con doble opt-in y gestión desde la cuenta
- 🟢 Códigos promocionales: `LANZAMIENTO50`, `BIENVENIDO30`, `FREEMONTH`, y comp gratis-para-siempre
- 🟢 Clima y pronóstico por destino
- 🟢 Novedades / release notes filtradas por rol

---

## 9. 🔴 Definido pero NO construido — todo esto va a Prioridad 5

| Ítem | Estado real |
|---|---|
| Tarjeta turista | **No existe en el código.** Ni empezada. |
| Servicios turísticos (vertical) | Solo permisos reservados. Sin entidad ni pantallas. |
| Planes multi-propiedad / hotel | 3 planes completos en código pero **desactivados**. |
| Fotos en las reseñas | El permiso está, la pantalla no. |
| Asistente de IA para soporte | Definido, sin otorgar a ningún plan. |
| Responder reseñas | El permiso está, la pantalla no. Confirmado el 11/08/2026. |

> **Advertencia sobre esta lista.** El catálogo del que salió estaba fechado el 08/07/2026 y ya tenía tres errores: daba por inexistentes el calendario con sincronización, el WhatsApp en la ficha y decía 14 días de prueba en vez de 30. Los tres estaban construidos. Antes de descartar cualquier funcionalidad de esta tabla, verificarla contra la plataforma real — esta lista envejece rápido.

**Cada uno de estos ítems genera su publicación igual**, escrita y diseñada, con Prioridad 5. Quedan en la carpeta lista para disparar el día que la funcionalidad salga a producción. La única que puede publicarse antes es la categoría **Novedades**, y solo en clave de roadmap: "próximamente", nunca en tiempo presente.

Riesgo a tener presente: si una de estas se cancela o cambia de forma (los planes multi-propiedad, por ejemplo, están desactivados y podrían no volver), la pieza producida se descarta. Es trabajo de diseño que puede tirarse — vale la pena para calendario y WhatsApp, que están casi listos; menos para la tarjeta turista, que no tiene ni una línea escrita.
