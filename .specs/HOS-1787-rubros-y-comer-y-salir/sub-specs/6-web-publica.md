---
title: Sub-spec 6 · Web pública
linear: HOS-1807 (hijo de HOS-1787)
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (resolución de la vuelta 3)
---

# 6 · Web pública (`apps/web` + API pública)

Decisiones: DEC-FAC-011, 014, 022, 023, 031, 034, 035, 038, 039, de la vuelta 2: 042, 044, 050, 052, 053, y de las
respuestas del owner: 062 (enlace de carta pago), 065 (dimensiones de reseña), 066 (comodidades de noche), 068
(textos y tile de la home) y 069 (el copy del embudo va al **sub-spec 9**), y de la vuelta 3: 072 y 073 (reseñas) y
076. Depende de 3, 4 **y 9** (DEC-FAC-076: la colección `/rubro/noche/` no se mergea antes que el copy neutro), y
**está bloqueado por HOS-1797** (paginación compartida, DEC-FAC-039).

## Dependencia: paginación compartida (HOS-1797)

Un solo mecanismo de paginación para todas las verticales, siguiendo el patrón de alojamientos: ruta
`/page/N/` que responde 301 en la página 1 y hace `Astro.rewrite` a `?page=N`, con canónica autorreferente
`/page/N/` (SPEC-157). **HOS-1797 bloquea este sub-spec** para que `/comer-y-salir/` y sus colecciones
`/rubro/<rubro>/` nazcan ya sobre ese mecanismo, sin ruta ni canónica propias. Este sub-spec no construye
paginación; la consume.

## Ficha

- La ficha de cada vertical renderiza sus secciones en el orden del catálogo y sólo las `available` según
  el lector público único (sub-spec 3). URL independiente del rubro. Los datos de `nightInfo` van bajo el título
  «De noche» cuando el resolvedor devuelve `multiLine` (DEC-FAC-050); el componente no compara rubros.
- **Badge «abierto ahora»** (DEC-FAC-052, F-V2-014): el cálculo nuevo del sub-spec 4. En HTML cacheado
  (colecciones `/rubro/…`, listado general, cache class `catalog`) el badge se calcula **en el cliente** con una
  isla chica (`client:idle`); el SSR no lo emite, para que no quede congelado el TTL de la página. En la ficha,
  ídem si su respuesta es cacheable.
- **Breadcrumb sin rubro**: «Comer y salir › <local>» (la URL de la ficha no depende del rubro,
  DEC-FAC-011).
- **JSON-LD por tipo** (F-V1-040): `@type` sale de un `Record<Tipo, …>` exhaustivo: BAR, CERVECERIA y PUB →
  `BarOrPub`; BOLICHE → `NightClub`; CAFE → `CafeOrCoffeeShop`; HELADERIA → `IceCreamShop`; PANADERIA →
  `Bakery`; el resto → `Restaurant`. El tipo es descriptivo, no rubro, así que no viola la regla 1.
  `hasMenu` sólo con `menu` `available` y algún contenido; el enlace externo `menuUrl` también es contenido de
  `menu` (pago, DEC-FAC-062), así que en el plan básico no sale ni en el bloque de contacto ni en el JSON-LD.
- `/carta/` sin carta estructurada ni archivo en un `menu` `available` (incluido el caso de sólo enlace, que la ficha
  muestra) → **302 con `Cache-Control: no-store`** a la ficha (DEC-FAC-042,
  F-V2-013): plan, rubro y carta son reversibles, y un 301 queda grabado en el teléfono del comensal. Lo implementa
  y lo prueba el sub-spec 3 (`AC:3:10`); acá se consume.
- **Slugs reservados** (F-V2-052): `/comer-y-salir/rubro/…` y `/comer-y-salir/page/…` son segmentos estáticos que
  Astro prioriza, así que un local con slug `rubro` o `page` perdería su `/carta/`. El generador de slugs de ficha
  reserva `rubro` y `page` en venue (y los segmentos estáticos de cada vertical: `tipo`, `page`, … en las
  demás), con test.

## Chat de IA de la ficha (F-V1-039)

- Prompt neutral («local de comida o de salida») en vez de «dining assistant embedded in a restaurant
  detail page» (`default-prompts.ts:212,358`), con secciones de contexto armadas desde las secciones
  `available` (incluye `nightInfo`).
- **Reglas duras de edad y alcohol** (DEC-FAC-053, F-V2-017) en `DEFAULT_RULES.chat_venue` (código, no editable
  por el admin): no afirmar que alguien puede ingresar por debajo de la edad declarada; no dar consejos para
  eludirla; repetir textual la edad de la ficha y el texto legal de la Ley 24.788; derivar al local. La cláusula se
  mueve **entre** prompt y reglas (invariante de multiset de `test/default-rules-equivalence.test.ts`), no se
  duplica. Test de la regla presente.
- El prompt guardado en `ai_settings` se actualiza en la migración **sólo si sigue igual al default
  viejo**; una edición del admin no se pisa.

## Colecciones

- Ruta `/{lang}/comer-y-salir/rubro/[rubro]/`, con el patrón de `/alojamientos/tipo/[type]/` y la
  paginación compartida de HOS-1797. El segmento `[rubro]` es el **slug español** (`gastronomia`, `noche`),
  resuelto al valor interno (`food`, `nightlife`) por el mapa del catálogo; 404 si no existe o no es
  `public`. JSON-LD `CollectionPage`+`ItemList`+`BreadcrumbList`, cache class `catalog` con tag de
  colección por rubro.
- **Listado general** `/comer-y-salir/`: paginado por el mismo mecanismo compartido (HOS-1797); no se
  crea una ruta de paginación propia de la vertical.
- API pública de listado: filtro por rubro con un parámetro **en inglés** (`businessLine`, valores `food`,
  `nightlife`); `rubro` queda sólo en la URL pública del web. El listado general sigue mostrando todo.
- **Crawl** (F-V1-041): el parámetro de rubro entra a `FACET_QUERY_PARAM_KEYS`
  (`facet-crawl-policy.ts`) con `Disallow`, y a la canónica promovida (`promoted-facet-canonical.ts`)
  hacia `/rubro/<r>/`, para no repetir el crawl combinatorio medido en HOS-369. (Nota de vocabulario:
  *facet* ahí es el filtro de búsqueda del web y no se renombra, DEC-FAC-031.)
- **Sitemap**: sólo colecciones con ≥1 ficha publicada (precedente de atracciones, «no empty page is ever
  advertised»), con hreflang (`sitemap-xml.ts`, `SEOHead.astro`).
- **Colección vacía**: `noindex,follow`, copy de estado vacío en es/en/pt y CTA (ver todo Comer y salir, o
  publicar tu local). (No existe hoy una colección de venue por destino; esta spec no la crea, F-V2-049.)
- **Filtros de comodidades y características** (DEC-FAC-066, Q-17): en las colecciones y en el listado general se
  ofrecen **sólo los filtros con ≥1 ficha publicada en esa colección** (misma regla que los chips de tipo), calculado
  junto con la página y cacheado con su tag. Así la colección de noche no ofrece «Menú infantil» y la de gastronomía
  no ofrece «Pista de baile». El editor del dueño sigue viendo el catálogo entero de la vertical (aceptado).
- **Ítems de noche nuevos** (DEC-FAC-066; **lista propuesta por el agente**, ajustable en la tarea): comodidades
  `dance_floor` (Pista de baile), `vip_area` (Sector VIP), `cloakroom` (Guardarropa), `outdoor_smoking_area` (Espacio
  al aire libre para fumadores; fumar adentro está prohibido por la Ley 26.687); características `dj_sets` (DJ) y
  `karaoke` (Karaoke). `live_music`, `happy_hour` y `bar_service` ya existen y ya aplican a la vertical. Cada ítem:
  `applicable_verticals = ['venue']`, fila en el baseline (`packages/seed/src/data/{amenity,feature}/`) **y**
  data-migration (`pnpm db:seed:make`, dual-write, HOS-25), etiquetas `accommodations.amenityNames.<slug>` /
  `featureNames.<slug>` en es/en/pt.
- Chips de `?type=` en cada colección: derivados de los tipos **permitidos para ese rubro** con fichas
  reales en la colección (DEC-FAC-034: los filtros por tipo salen de la matriz).
- Menú: «Comer y salir» como ítem, con acceso a las colecciones. Textos (DEC-FAC-068, Q-19, **aprobados tal cual**):

  | clave | es | en | pt |
  |---|---|---|---|
  | vertical | Comer y salir | Food & nightlife | Comer e sair |
  | rubro `food` | Gastronomía | Food & drink | Gastronomia |
  | rubro `nightlife` | Noche | Nightlife | Vida noturna |
  | tipo BOLICHE | Boliche | Nightclub | Balada |
  | tipo BAR / PUB | Bar / Pub | Bar / Pub | Bar / Pub |
  | título «De noche» | De noche | At night | À noite |
  | dress code | Informal (sin ojotas ni musculosa) · Sport elegante · Elegante · Sin restricciones | Casual · Smart casual · Formal · No dress code | Casual · Esporte fino · Social · Sem restrições |
  | texto legal +18 | Prohibida la venta de bebidas alcohólicas a menores de 18 años (Ley 24.788). | Sale of alcoholic beverages to persons under 18 is prohibited (Argentine Law 24.788). | Proibida a venda de bebidas alcoólicas a menores de 18 anos (Lei argentina 24.788). |
  | title colección noche | Boliches, bares y pubs en {{destino}} · Hospeda | Nightclubs, bars and pubs in {{destino}} · Hospeda | Baladas, bares e pubs em {{destino}} · Hospeda |
  | title colección gastronomía | Dónde comer en {{destino}} · Hospeda | Where to eat in {{destino}} · Hospeda | Onde comer em {{destino}} · Hospeda |

  Description, H1, intro y OG de cada colección siguen la misma línea y se escriben en la tarea.
- **Tile de la home** (DEC-FAC-068): pasa a «Eventos gastronómicos» / «Food events» / «Eventos gastronômicos» y sigue
  llevando a la categoría de eventos. Su clave (`home.categoryTiles.tiles.gastronomy`) y su imagen se renombran en
  el **sub-spec 1** (`foodEvents`, propuesto) porque **salen de la exención (a) de G-FAC-R1**; la URL de destino
  (`/eventos/categoria/gastronomia/`) sigue exenta como slug de categoría. Así «Gastronomía» en la home es sólo el
  rubro.
- **Copy del embudo**: va al **sub-spec 9** (DEC-FAC-069), no acá.

## Planes y reseñas (DEC-FAC-035)

- **Comparativa de planes generada desde el catálogo**: las filas de la tabla salen del catálogo de
  secciones y rasgos; las propias de un rubro se **marcan por rubro** (p. ej. «sólo para locales con
  carta»). El cruce clave → sección → rubro se hace **en el web** con `@repo/schemas`
  (`PlanComparisonTable.astro`, `plan-comparison-table.helpers.ts`), nunca en la respuesta de
  `routes/plan-catalog` (lado billing del API); G-FAC-07 lo vigila (F-V2-057). El **upsell nombra lo que
  desbloquea** (la sección o el rasgo), no el plan genérico. Los precios no cambian.
- **Reseñas con dimensiones opcionales** (DEC-FAC-065, Q-16 = 2). Punto de partida verificado: el formulario
  público pide sólo `overallRating` (`GastronomyReviewForm.client.tsx:7-10`); nadie muestra dimensiones; el recálculo
  de venue **imputa** `overallRating` a las cuatro dimensiones en su propio servicio de reseñas
  (`gastronomy.review.service.ts:671-684`) y después llama a la base compartida con experiencia
  (`base-listing.service.ts:1021-1040`), que suma `null` como 0 (DEC-FAC-073). Lo nuevo, todo leído del catálogo
  (sub-spec 2, `ReviewRules`):
  - **Formulario**: además de la calificación general (obligatoria, como hoy), ofrece cada dimensión de la vertical
    como **opcional**. Una dimensión ligada a una sección se ofrece sólo si el mapa público de estados de la ficha
    dice que esa sección **no** es `absent` (`food` ↔ `menu`: un BOLICHE no ve «Comida», un RESTAURANT básico sí);
    las no ligadas (`service`, `ambiance`, `value`), siempre. El componente lee el mapa del lector público; nunca
    compara rubros ni tipos (G-FAC-03, G-FAC-05).
  - **Servidor, recálculo y test golden**: viven en el **sub-spec 3** (DEC-FAC-073), no acá: no dependen de la
    paginación de HOS-1797. Venue pasa a `votedOnly` (sin imputación); experiencia declara su `ReviewRules` con
    `legacyNullAsZero` y no cambia. Formas de datos: sub-spec 2 (DEC-FAC-071).
  - **Ficha**: muestra el promedio de cada dimensión con al menos un voto (clave presente en el agregado, DEC-FAC-071),
    con su etiqueta i18n (`review.dimensions.<id>`), **salvo** las ligadas a una sección `absent` de la ficha, que no
    se publican aunque tengan votos (DEC-FAC-072: el lector público las saca); `value` se rotula «Relación
    precio-calidad».
  - Prod tiene cero fichas de la vertical (DEC-FAC-027): no hay promedios que recalcular.
- El diferencial de noche para pro/premium es **post-MVP** (HOS-1796); no entra acá.

## Cache (F-V1-029)

- Un cambio de rubros de una ficha purga su detalle, las colecciones de los rubros **viejos ∪ nuevos**
  (quitar un rubro también saca la ficha de esa colección) y el listado general. (Hoy ninguna página de destino
  lista locales, `destinos/[...path].astro:349-352`; si alguna lo hace después, entra acá, F-V2-049.)
- **La purga por cambio de plan no existe hoy** (bug previo HOS-1793, post-MVP): la invalidación de
  cobertura sólo revalida fichas que bajan o se restauran (`coverage-recalculation.ts:249-255`) y la del
  conjunto efectivo sólo toca Redis. Se diseña acá lo mínimo que esta spec necesita: ante un cambio del
  conjunto efectivo de `user + vertical`, revalidar todas las fichas `PUBLISHED` del dueño en esa vertical
  (un tercer task en `publicationAfterCommit` o un oyente propio). Si HOS-1793 se resuelve antes, se
  reutiliza y se quita de acá.

## Criterio de aceptación

- **AC:6:1** — Un resto-bar aparece en `/comer-y-salir/rubro/gastronomia/` y en `/comer-y-salir/rubro/noche/`; un
  boliche sólo en la segunda; `/comer-y-salir/` muestra todo; ambas paginan con el mecanismo de HOS-1797
  (`/page/N/`, página 1 con 301, canónica autorreferente).
- **AC:6:2** — Las colecciones con fichas están en el sitemap con hreflang; las vacías no, y responden `noindex`; un
  rubro inexistente responde 404; `?businessLine=` del listado no es rastreable.
- **AC:6:3** — Test: «quitar `nightlife` saca la ficha de `/rubro/noche/` en la siguiente lectura sin cache».
- **AC:6:4** — Test: «un cambio de plan sin cambio de estado de publicación pide la revalidación de las N fichas del
  dueño».
- **AC:6:5** — JSON-LD de un BOLICHE es `NightClub`; sin `hasMenu` si `menu` no tiene contenido `available`.
- **AC:6:6** — Un local con slug `rubro` no se puede crear.
- **AC:6:7** — El badge «abierto ahora» de una colección cacheada se calcula en el cliente (el HTML no lo trae).
- **AC:6:8** — El chat de un boliche con `min_age: 18` no afirma que un menor puede entrar (test de la regla).
- **AC:6:9** — La tabla de planes de la vertical se genera desde el catálogo en el web; la fila de la carta incluye el enlace
  externo (pago, DEC-FAC-062).
- **AC:6:10** — Reseñas: el formulario de un BOLICHE no ofrece «Comida» y el de un RESTAURANT sí; una dimensión sin votos no se
  muestra; un boliche que fue restaurante no muestra «Comida» aunque tenga votos viejos (servidor y golden: sub-spec 3).
- **AC:6:11** — La colección de noche no ofrece filtros sin fichas.
- **AC:6:12** — Los ítems de noche existen en un entorno vivo después de `db:seed:migrate` (dual-write).
- **AC:6:13** — La home muestra «Eventos gastronómicos» y G-FAC-R1 queda verde sin la tile en la exención (a).
