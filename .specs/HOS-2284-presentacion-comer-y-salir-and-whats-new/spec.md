---
title: Presentación de Comer y salir y Novedades con lo nuevo de los planes
linear: HOS-2284
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - content
  - web
---

# Presentación de Comer y salir y Novedades con lo nuevo de los planes

## 1. Resumen

La página `/presentacion/comer-y-salir/` tiene que contar lo que se va habilitando en los planes
y **no prometer lo que todavía no existe**. Hoy ya promete cosas falsas, entre ellas
«videos si tenés». El trabajo se hace **por bloque**: cada vez que se mergea una issue de
concesiones de planes, un PR chico suma ese bloque a la página (con un texto para Gastronomía y
otro para Noche) y deja su entrada en Novedades.

## 2. Hallazgos que cambian el plan

1. **La página es solo en español por diseño.** `index.astro:1-90` lo declara: «NOT TRANSLATED»,
   `noindex, nofollow`, fuera del sitemap, «el mismo copy en español sirve bajo `/en/` y `/pt/`».
   El criterio «textos en es, en y pt» de la issue **choca** con eso.
   **Decidido (owner, 16/11/2026):** la página de presentación queda solo en español;
   «es, en y pt» aplica a Novedades (What's New) y a las claves de i18n (pregunta 1).
2. **La página ya promete cosas que hoy no se cumplen** (sección 5). Hay un error de fondo,
   no de detalle: dice que el destacado lo maneja el dueño y lista funciones de plan como
   complementos. **Decidido (owner, 16/11/2026):** «Destacar tu local por 7 o 30 días» y la
   frase de «desde Mi cuenta» **quedan como están**: pasan a ser verdaderas cuando salga
   HOS-2179 (pago único comprable por web). Las otras 3 afirmaciones falsas **sí** se
   corrigen: el video (L390), el destacado «Vos» (L434) y las funciones de plan bajo
   «Complementos que vienen» (L309-328).
3. **El comentario de cabecera está vencido.** Su lista «ahead of the code as of 2026-10-31»
   nombra como no construidos `PUB`/`BOLICHE` (ya existen en `VenueTypeEnum`,
   `packages/schemas/src/enums/venue-type.enum.ts:13-26`) y `contactInfo` público (ya está,
   `venue.access.schema.ts:147`, HOS-2042). Hay que revisar cada uno al tocar la página.
4. **Hay un test que congela tres cadenas** de esta página
   (`apps/web/test/pages/listing-amenities-render.test.ts`, HOS-1071/1072): «Lo que ofrece el
   local», «delivery o take away», y la primera fila de «Quién manda sobre qué». No se reescriben.
5. El mecanismo de Novedades ya está resuelto y es automático por tanda (`smoke-tanda`, fase 2b);
   esta issue no lo reinventa, define **qué** entradas salen.

## 3. Alcance y fuera de alcance

Dentro: corregir lo falso hoy; plan de copy por bloque (Gastronomía / Noche); regla de
actualización por PR; entradas de Novedades por bloque; tests de la página.

Fuera: las concesiones en sí (HOS-2280, HOS-2253 y sus hijas), la página pública de planes
(`/planes/comer-y-salir/`, HOS-1967 la lee del catálogo), `/funcionalidades`, las páginas
hermanas `presentacion/alojamientos` y `presentacion/experiencias`.

## 4. Estado actual del código

- Archivo: `apps/web/src/pages/[lang]/presentacion/comer-y-salir/index.astro` (509 líneas).
  Estático, caché de borde clase `static` (`:92-100`), sin sesión ni llamadas a la API.
- La tabla de planes es **texto escrito a mano** (L255-278), no sale del catálogo. A propósito
  no imprime precios (cabecera) y apunta a `/planes/comer-y-salir/precios/` (`:107-110`).
- Datos del catálogo contra los que se verifica (línea base `0144_production_plan_catalog.sql`;
  el estado vivo se confirma con las SQL de HOS-2290 §7):
  - `venue-basico` `54a6f750…`: `edit_venue_info`, `publish_venue`, `view_basic_stats`; `max_venues 1`.
  - `venue-pro` `3b701ee3…` (+ `manage_venue_menu`, `manage_venue_daily_special`,
    `manage_venue_events`); `max_venues 3`.
  - `venue-premium` `8e4b0c4e…` (+ `menu_item_photos`, `multilingual_venue_menu`,
    `menu_qr_scan_metrics`, `download_listing_pdf`); `max_venues 5`;
    `max_ai_chat_venue_per_month 1250` (basico y pro: 0).
  - Ningún plan de venue otorga `featured_listing`, `can_embed_video` ni `create_promotions`.
- Otros hechos: `ENTITY_GALLERY_CAPS.venue = 30` (`packages/schemas/src/common/media-upload.schema.ts:37`);
  la compra web de complementos solo admite recurrentes
  (`apps/web/src/lib/billing/addon-purchase.ts:10-13`, HOS-2179).

## 5. Qué dice la página hoy: verdadero y falso (con línea)

Referencia: `apps/web/src/pages/[lang]/presentacion/comer-y-salir/index.astro`.

### 5.1 Falso hoy (hay que corregir)

| Línea | Afirmación | Realidad |
|---|---|---|
| 390 | «...Descripción con formato, **y videos si tenés**.» | El local no tiene editor de video ni la ficha pública lo muestra (`VideoSection` solo se monta en el editor de alojamiento: `mi-cuenta/propiedades/[id]/editar/fotos.astro`; ningún componente de `components/venue` ni del editor de comercio lo usa). Ningún plan de venue otorga `can_embed_video`. La habilita HOS-2280. |
| 434 | «Si tu local aparece destacado — **Vos**.» | El destacado no tiene interruptor (decisión del owner 2026-08-29, HOS-929) y lo da un plan o un complemento. Ningún plan de venue lo da hoy. |
| 309-328 | Bajo «Complementos que vienen. Todavía no se pueden pedir» figuran la agenda, la carta, el especial del día, la foto por ítem, la carta en inglés/portugués, el PDF con QR, el QR de mesa y el chat de IA como «Hoy, desde Profesional/Premium». | Son **funciones de plan**, no complementos; contradice el propio encabezado del bloque. Quitarlas de ahí. |
| 477 | «La carta es del plan Profesional para arriba.» | Cierto hoy. **Dejará de serlo si** la carta pasa a otro plan (no está decidido): se verifica contra el catálogo al implementar. |

### 5.1b Falso hoy pero se conserva por decisión del owner (16/11/2026)

| Línea | Afirmación | Por qué se queda |
|---|---|---|
| 297-302 | «Destacar tu local por 7 o 30 días», en «Estos son los que hay para vos». | Hoy no se puede comprar por web (pago único, HOS-2179). Se vuelve verdadero cuando salga HOS-2179; no se toca. |
| 304 | «Desde Mi cuenta > Complementos... Ves qué hay disponible, elegís el que necesitás y listo.» | Mismo motivo: falso para el pago único hasta HOS-2179, verdadero para «1 local más». |

### 5.2 Verdadero hoy (se conserva)

| Línea | Afirmación | Respaldo |
|---|---|---|
| 262 | Locales publicados 1 / 3 / 5 | `max_venues` 1/3/5 (`0144`) |
| 263 | Fotos por local 30/30/30 | `ENTITY_GALLERY_CAPS.venue` |
| 268 | Agenda de eventos solo Pro y Premium | `manage_venue_events` en pro y premium (`0144:187, :209`). **Dejará de ser cierto** con la decisión 1/2 (básico 1 evento único) |
| 269-270 | Carta y menú del día: Pro y Premium | `manage_venue_menu`, `manage_venue_daily_special` |
| 271-274 | Foto por ítem, carta en inglés/portugués, ficha PDF con QR, QR de mesa con panel: solo Premium | `menu_item_photos`, `multilingual_venue_menu`, `download_listing_pdf`, `menu_qr_scan_metrics` (`0144:206`) |
| 275 | Chat IA, 1250 consultas por mes, Premium | `max_ai_chat_venue_per_month 1250` |
| 280, 446 | Estadísticas de visitas en los 3 planes | `view_basic_stats` en los 3; rutas `routes/venue/protected/viewStats.ts` |
| 479 | «No hay promociones ni cupones para el cliente» | No existe tabla ni ruta de promos de venue. **Dejará de ser cierto** con la decisión 5 de HOS-2253 |
| 301, 304 | «1 local más», complemento por mes | Recurrente, visible en la web (`purchasableOffers`) |

### 5.3 No verificado en esta spec (revisar al implementar cada bloque)

Los puntos de la cabecera 1-4 (rubros y «De noche», enlace de carta pago, contacto, traducción
por IA con visto bueno del dueño), las reseñas por dimensión (L384-396 y siguientes), la fila
«Las estadísticas día por día» de «Lo que se viene» (L463: la ruta
`routes/venue/protected/viewStatsDailySeries.ts` ya existe, HOS-734, y la web tiene
`ListingViewsWidget`; puede estar subestimada) y el trial de 30 días.

## 6. Diseño

### 6.1 Regla de trabajo: un PR por bloque, en el mismo orden de las concesiones

Cada issue de concesión de planes que se mergee abre un PR a `staging` con título
`[HOS-2284] docs(web): …` (no lleva `Closes HOS-2284`: es parcial, regla de la magic word) que:

1. Cambia la fila de la tabla de planes y/o suma el bloque.
2. Saca de «Lo que se viene» o de «Complementos que vienen» lo que ya existe.
3. Actualiza la cabecera del archivo (lista de lo «ahead of the code»).
4. Corre el test de la página y el de veracidad.
Una afirmación **no entra al texto hasta que la concesión está en staging** (decisión de la
issue: «lo que no está habilitado no se promete»).

### 6.2 Limpieza inicial (PR 0, no depende de nada)

Corrige 5.1: sacar «y videos si tenés» (L390; vuelve cuando HOS-2280 otorgue
`can_embed_video`, en el PR del bloque «Video»); cambiar la fila de destacado de L434 a «Lo
define tu plan o un complemento» o quitarla; mover las funciones de plan fuera de
«Complementos que vienen». **No se toca** «Destacar tu local por 7 o 30 días» ni la frase de
«Desde Mi cuenta» (5.1b, decisión del owner: se vuelven verdaderas con HOS-2179). Es el único
PR que se puede hacer **ya**.

### 6.3 Plan de copy por bloque

Cada bloque tiene una variante Gastronomía y otra Noche (regla de neutralidad: la página habla
de «tu local», los ejemplos van por rubro). Los textos son **borradores en español**; el owner
los aprueba en el PR.

| Bloque (issue de origen) | Gastronomía | Noche | Fila de tabla |
|---|---|---|---|
| **Eventos** (tope por plan, HOS-2263/2264/2280): Básico 1 evento de fecha única; Pro 10 y recurrencia; Premium sin tope | «Publicá la noche de pizzas, el menú del domingo o la cena maridaje. Con fecha, o todos los martes.» | «La fecha del DJ, la noche temática, la fiesta de fin de año. Con fecha, o todos los jueves.» | 3 filas: «Eventos de fecha única» (1 / 10 / sin tope), «Eventos que se repiten» (— / sí / sí), «Cantidad de eventos activos a la vez» |
| **Lista de invitados** (solo rubro «noche»; Pro 100 por evento; Premium sin tope) | no aplica: **no se menciona** en Gastronomía | «Armá la lista de tu noche: cada persona se anota y vos ves quién viene. Hasta 100 anotados por evento en Profesional, sin tope en Premium.» | Fila marcada «solo locales de noche» |
| **Promos** (Pro 5, Premium sin tope, happy hour = promo) | «Cargá tus promos del día o de la semana: el 2x1 de los martes, el menú ejecutivo.» | «Tu happy hour es una promo: horario, qué incluye y hasta cuándo.» | «Promos activas a la vez» (— / 5 / sin tope). Sacar la viñeta de L479 |
| **Métricas** (estadísticas de eventos HOS-2265, día por día) | «Cuánta gente mira cada evento.» | «Cuánta gente mira cada fecha.» | Mover «estadísticas día por día» de «Lo que se viene» a la tabla si ya existe |
| **Video** (HOS-2258 construye, HOS-2280 otorga) | «Mostrá tu cocina y tu salón con un video.» | «Mostrá cómo se vive la noche en tu local.» | Fila «Videos de tu local» con los planes que lo reciban; hasta el grant la fila no existe (igual que en la tabla pública de planes, HOS-2262) |
| **Destacado premium** (HOS-2279) | «Premium aparece primero en la lista de su rubro.» | igual | Fila «Aparecés primero en el listado» (— / — / sí). **No nombrar el plan en la ficha**; en la presentación comercial sí se nombra el plan |
| **Evento destacado, complemento** (HOS-2288, elegibilidad en HOS-2292) | «Destacá el evento de esta semana por 7 días.» | igual | Pasar de «Complementos que vienen» a la tabla de complementos, **solo cuando HOS-2179 permita pagarlo**. El complemento se aplica al local (alcance listing, guarda el `event_id` de la compra) y **no se ofrece a Premium**: la presentación no lo lista en la columna Premium |
| **Baja de plan** (decisión 6 de HOS-2253) | Párrafo «Si bajás de plan, no perdés nada»: lo cargado se guarda, los eventos únicos siguen hasta su fecha, los semanales vuelven a borrador y vuelven si subís; lo confirmado se respeta. | igual | Sin fila |

Durante el trial las funciones nuevas corren con límites mínimos (1 promo activa, 10 lugares
de lista, 1 evento activo; HOS-2280 a HOS-2283): la página no promete que el trial incluya
las funciones con los topes de Pro o Premium.

Reglas de redacción: frases cortas, sin números que salgan del catálogo (los topes se leen del
catálogo en la página de planes; la presentación **cita las cifras de cada plan** (decidido el 18/11/2026, #50), siempre con el test de veracidad que las compara con el catálogo; ver pregunta 3), sin «próximamente» con fecha, sin nombrar rubros que no son del bloque.

### 6.4 Novedades

Una entrada por bloque, la escribe el flujo del smoke (`smoke-tanda`, fase 2b) **sin preguntar**,
con `publishedAt: 'on-promotion'`, audiencia `['VENUE_OWNER']` en
`apps/api/src/data/whats-new/whats-new.ts`. **Decidido (owner, 16/11/2026):** cada entrada
sale en es, en y pt (la página de presentación no, ver pregunta 1). Las que salen con
traducción automática llevan `translations: { en: 'machine', pt: 'machine' }` y la compuerta
de promoción exige revisarlas. Los ids siguen el patrón `YYYY-MM-DD-slug`. Entradas
previstas: `venue-events-by-plan`, `venue-guest-list`, `venue-promos`, `venue-event-stats`,
`venue-video`, `venue-premium-featured`, `venue-featured-event-addon`.
Cada PR de bloque lleva exactamente **una** etiqueta: `whats-new-done` o `whats-new-none`.

### 6.5 Tests de la página

- `apps/web/test/pages/presentacion-comer-y-salir-claims.test.ts` (nuevo): por cada afirmación
  de plan de la tabla, lee el catálogo de producción (`scripts/production-catalog/catalog.ts`) y
  falla si la página promete una clave que el plan no tiene (mismo espíritu que
  `apps/web/src/lib/__tests__/features-content-veracity.test.ts`).
- Mantener `listing-amenities-render.test.ts` (3 cadenas congeladas).
- Un test de que la página **no** contiene «videos si tenés» ni «Si tu local aparece destacado»
  con «Vos» (regresión de 5.1). El test **no** prohíbe «Destacar tu local por 7 o 30 días»
  (5.1b).

## 7. Criterios de aceptación

- AC-1. Dada la página tras el PR 0, entonces no contiene «videos si tenés» ni atribuye el
  destacado al dueño, y «Complementos que vienen» no lista funciones de plan (las otras 3
  falsedades se corrigen; 5.1b queda intacto).
- AC-2. Dado un bloque habilitado en staging, cuando se mergea su PR de presentación, entonces la
  página lo describe con texto de Gastronomía **y** de Noche (salvo lista de invitados, solo Noche).
- AC-3. Dado un bloque **no** habilitado, entonces la página no lo menciona en presente.
- AC-4. Dada cada fila de la tabla, entonces la clave de catálogo correspondiente existe en el
  plan indicado (test de veracidad).
- AC-5. Dado cada bloque, entonces existe una entrada de Novedades `VENUE_OWNER` con es, en y
  pt, y las traducciones automáticas marcadas `machine` hasta su revisión.
- AC-9. La página de presentación sigue solo en español (sin copias en/pt) y mantiene
  «Destacar tu local por 7 o 30 días» y la frase de «Desde Mi cuenta» tal como están.
- AC-6. Las tres cadenas congeladas siguen pasando.
- AC-7. La página sigue `noindex, nofollow`, fuera del sitemap, sin sesión, y cacheable (guard
  `cacheable-pages-are-session-blind`).
- AC-8. Ningún PR parcial lleva `Closes HOS-2284`.

## 8. Plan de pruebas

Unit/estático: los tres tests de 6.5 y `presentacion-mobile.test.ts` (ya existe,
`apps/web/test/pages/`). Manual: abrir la página en es, en y pt (misma copia) y revisar móvil y
PDF (la página se exporta). Sin e2e. Guards: `pnpm check:guards`.

## 9. Riesgos

- R-1. **Desincronización silenciosa**: la tabla es texto a mano y el catálogo cambia. Mitiga el
  test de veracidad (6.5).
- R-2. Prometer antes de tiempo: los PR de bloque se abren **después** del merge de la concesión.
- R-3. La página ya se entregó a prospectos con afirmaciones falsas (5.1). Conviene avisar al
  owner qué cambió respecto de la versión entregada. **No** se avisa a los prospectos que ya la recibieron (decidido el 18/11/2026, HOS-2252 ronda 2, #51 ✱; pregunta 4).
- R-4. Mezclar rubros: la lista de invitados solo es de Noche; un texto genérico confunde.

## 10. Preguntas abiertas para el owner

1. **Decidido (owner, 16/11/2026): idiomas.** La página de presentación queda solo en
   español, por diseño. Novedades (What's New) sale en es, en y pt. Se aclara en la issue
   que «es, en y pt» aplica a Novedades y a las claves de i18n, no a la página.
2. **Decidido (owner, 16/11/2026): «Destacar tu local por 7 o 30 días».** Queda como está en
   la página; se vuelve verdadero cuando salga HOS-2179. Las otras 3 afirmaciones falsas sí
   se corrigen (PR 0).
3. **¿La presentación cita cifras (1 / 10 / sin tope eventos, 5 promos, 100 anotados) o solo
   describe?** Las cifras vienen de las decisiones de HOS-2253.
   - A) Citarlas: es lo que busca el prospecto. Contra: si cambian, la página miente (R-1).
   - B) Solo describir y mandar a `/planes/` donde el catálogo manda. Contra: menos concreta.
   - **Recomiendo A con el test de veracidad que lee el catálogo**, así una cifra desfasada rompe CI.
   - **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #50): opción A.** La presentación cita las cifras de cada plan, con un test que las compara con el catálogo.
4. **¿Se avisa a los prospectos que ya recibieron la versión anterior?** Recomiendo sí, con el
   resumen de cambios del PR 0.
   **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #51 ✱): no.** No se avisa a los prospectos que ya recibieron la presentación anterior (se aparta de la recomendación). El resumen de cambios del PR 0 queda solo para el owner.

## 11. Dependencias

- HOS-2280 (habilitar eventos, métricas y video): bloqueante declarada; es el primer bloque.
- Las demás issues de concesiones de la épica HOS-2252/HOS-2253 (promos, lista de invitados,
  topes de eventos): un PR de bloque por cada una.
- HOS-2279 y HOS-2288 (destacado; elegibilidad del add-on en HOS-2292), HOS-2179 (pago
  único): condicionan dos filas. HOS-2179 además vuelve verdadero lo que 5.1b conserva.
- HOS-2258 (video) y HOS-2262 (tabla de planes con filas ocultas hasta tener grant).
- HOS-2290: informe que sostiene las correcciones de 5.1.

## 12. Smoke y Novedades

- Etiqueta: `status-needs-smoke-staging` **solo** en los PR que describen una función de
  checkout o de caché (destacado y evento destacado); el resto es copy puro sin smoke.
- Novedades: **sí**, una por bloque (6.4).

## 13. Desglose de tareas

1. PR 0: corregir lo falso hoy (5.1) y mover funciones de plan fuera de «Complementos que
   vienen». (0,5 d)
2. Test de veracidad de la página + test de regresión de 5.1. (0,75 d)
3. Actualizar el comentario de cabecera (cuáles puntos ya están construidos). (0,25 d)
4. PR de bloque «Eventos» tras HOS-2280. (0,5 d)
5. PR de bloque «Métricas» y «Video» tras HOS-2280 y HOS-2265. (0,5 d)
6. PR de bloques «Lista de invitados» y «Promos» cuando se mergeen. (0,5 d c/u)
7. PR de bloques «Destacado premium» y «Evento destacado» (HOS-2279/2288/2094). (0,5 d)
8. Entradas de Novedades por bloque vía smoke. (0,25 d c/u)

## 14. Linear

Canonical tracking:
HOS-2284
