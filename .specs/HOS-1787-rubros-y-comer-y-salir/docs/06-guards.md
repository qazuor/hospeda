---
title: Guards · HOS-1787
linear: HOS-1787
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (respuestas del owner a la vuelta 2)
---

# 06 · Guards

Lista cerrada. Cada guard dice qué prueba, dónde nace, cómo se registra y **cómo se rompe a
propósito** (la mutación que tiene que ponerlo en rojo). Convenciones del repo (discovery B §8): piso
mínimo de archivos escaneados, `run({root,…})` con árbol inyectado y test de control positivo,
sección «lo que NO verifica», script `check:<name>` en la cadena `check:guards` **y paso propio en
`.github/workflows/ci.yml`**.

Revisado en las resoluciones de las vueltas 1 y 2: los cambios citan su hallazgo (`F-V1-NNN` en
`10-revision-vuelta-1/00-consolidado.md`, `F-V2-NNN` en `12-revision-vuelta-2/00-consolidado.md`).

| id | nace en | qué prueba |
|---|---|---|
| G-FAC-R1 | sub-spec 1 | la palabra retirada no reaparece fuera de las exenciones contadas |
| G-FAC-R2 | sub-spec 1 | toda ruta pública retirada tiene su redirect de un salto, y los QR llegan en un salto |
| G-FAC-T1 | sub-spec 1 | frontera temporal de la etapa A: la lista contada de literales viejos sólo baja (se retira al nacer G-FAC-R1) |
| G-FAC-01 | sub-spec 2 | el CHECK de `business_lines` en base coincide con el catálogo de código (valores, matriz por tipo, default) |
| G-FAC-02 | sub-spec 2 | integridad del catálogo |
| G-FAC-03 | sub-spec 3 | (a) sólo el resolvedor decide secciones por rubro; (b) lista cerrada de lectores de rubros |
| G-FAC-04 | sub-spec 3 | ninguna ruta usa literales de clave de una sección o de un rasgo |
| G-FAC-05 | sub-spec 5 | sin despacho por vertical ni por id de sección en los archivos que el mecanismo reemplaza |
| G-FAC-06 | sub-spec 3 | toda ruta de subrecurso de contenido declara su sección, usa la cadena y declara su intención |
| G-FAC-07 | sub-spec 2 | billing no lee rubros (F-V1-032) |
| G-FAC-08 | sub-spec 5 | la lista manual de secciones de alojamiento está congelada y coincide con el catálogo |
| G-FAC-09 | sub-spec 2 | ninguna validación de rubros fuera del validador |
| G-FAC-10 | sub-spec 4 | toda columna de contenido de una ficha está en el `SET` del purge (F-V2-023) |

Además, guards **existentes** que este trabajo toca y que tienen que demostrarse vivos (ver «Guards
atados al nombre» al final).

## G-FAC-R1 · Palabra retirada
- **Prueba**: ninguna ocurrencia de la vertical retirada en contenido ni en rutas trackeadas fuera de
  las exenciones. Modelo: GUARD:G8 (`scripts/check-old-grouping-word.sh`). Escanea también `scripts/`,
  para que un regex con la palabra vieja en un guard sea rojo (F-V1-024).
- **Patrón** (F-V1-025, F-V2-015): no un `gastronom` pelado, sino reglas separadas:
  1. **forma de identificador**: `gastronomy`, `gastronomies`, `Gastronomy`, `Gastronomies`,
     `GASTRONOMY` y sus compuestos (`GASTRONOMY_OWNER`, `gastronomyId`, `gastronomy_id`…), con frontera
     de palabra;
  2. **ruta retirada**: `/(es|en|pt)/gastronomia(/|$)` y `(planes|presentacion|publicar)/gastronomia`;
  3. **prefijo corto** `gastro-` (cache tags, clases CSS): **incluido** (DEC-FAC-032 los renombra);
  4. **`restaurante`** en rutas y títulos de addon de la vertical (`publicar-restaurante`);
  5. **valor visible** (DEC-FAC-044): `[Gg]astronom[ií]a` en los **valores** de
     `packages/i18n/src/locales/**` y `packages/notifications/src/**` sólo en claves de una lista contada (las
     de la exención (a) y la etiqueta del rubro `food`). Las reglas 1-4 son de identificadores y rutas y no ven
     «Gastronomía» con tilde ni «Gastronomia» en pt.
- **Exenciones (DEC-FAC-032, DEC-FAC-044): exactamente cinco, cada una contada por nombre** con auto-chequeo
  exacto en el script; agregar una sexta, o cambiar el conteo de una, sin actualizar el script es rojo:
  | # | exención | cómo se cuenta |
  |---|---|---|
  | a | gastronomía como **tema**: categoría «Gastronomía» de eventos, posts y POI (`EventCategoryEnum`/`PostCategoryEnum.GASTRONOMY`, tag de blog, slugs de `facet-slugs.ts`), **dimensión `gastronomy` del rating de destino** (`destination.rating.schema.ts`, `error:destination.rating.gastronomy.*`, etiquetas de `destination.json`; no se renombra ni se migra), `footer.categoryGastronomy`. **La tile de la home salió de la lista** (DEC-FAC-068: se renombra a `foodEvents`, «Eventos gastronómicos») | lista cerrada de archivos y conteo de ocurrencias por archivo; para valores i18n, lista contada de claves (regla 5) |
  | b | la palabra como tema en prosa y la etiqueta y el slug público del rubro `food` (mapa `food` ↔ `gastronomia`) | el archivo del mapa de slugs y las claves i18n contadas; **no** ampara la palabra cuando nombra a la vertical (eso se renombra); el valor en código es `food` y no está exento |
  | c | el mapa de redirects legacy `/gastronomia/…` → `/comer-y-salir/…` y sus tests (`legacy-redirects.ts`, `public-redirect-paths.guard.test.ts`), más la regex tolerante de QR de códigos MANUAL | archivos nombrados; la regex de QR con marcador en línea `legacy-name-allowed: <motivo>` contado |
  | d | el propio guard y su test | archivos nombrados |
  | e | eventos pasados de PostHog y correos ya enviados (historia externa) | sólo donde un archivo del repo tiene que nombrar el evento o el correo histórico; marcador en línea contado |
- **Fuera del escaneo** (historia, no son exenciones del código; F-V2-015, F-V3-001, DEC-FAC-070): todas las
  migraciones versionadas anteriores a la de renombrado **incluidas las cinco editadas** (0129, 0132, 0139, 0144 y
  0176) y sus `meta/` (describen un esquema donde la tabla se llama `gastronomies`: la 0132 hace `ALTER TABLE
  "gastronomies"`, `:26-29`); **la migración de renombrado y su `meta/`** (tiene que nombrar `gastronomies` para
  renombrarla); **los módulos de data-migration del seed** (`packages/seed/src/data-migrations/`, que el paso 6 del
  corte borra); los **tests de historia**, lista cerrada y contada que el guard **deriva** (no se escribe a mano): un
  test entra si aplica migraciones hasta un tag anterior al renombrado (`journal.entries` o tag fijo, p. ej.
  `cut-migration-over-data.test.ts`, `retire-user-impersonate-over-data.test.ts`) o importa un módulo de
  `src/data-migrations/` (p. ej. `whats-new-seen-ids-rename.integration.test.ts` y el test de la data-migration de
  seen-ids nueva); todas las carpetas de `.specs/` (DEC-FAC-086). Con el corte V6 la historia de migraciones se reemplaza
  por el baseline.
- **Chequeo de valores de las cinco editadas** (DEC-FAC-070): en 0129, 0132, 0139, 0144 y 0176 no queda ningún
  literal de **valor** viejo: `'gastronomy'` como vertical, `{gastronomy}`, claves `*_gastronomy_*` y
  `*_gastronomies*`, slugs `gastronomy-*`/`*-gastronomy-*`/`*-gastronomies-*`, títulos «Gastronomía»/«Gastronomy».
  Los nombres de tabla, columna, índice y enum quedan permitidos (todavía no se renombraron).
- **No son exenciones** (se renombran, DEC-FAC-032): ids y semillas de fixtures, carpetas de Cloudinary,
  cache tags y clases `gastro-`, propiedad PostHog, ids de What's New y del tour (con su migración de ids
  vistos, DEC-FAC-054). Ya no hay marcadores para semillas congeladas ni para alias de `catalogId`.
- **Se rompe**: agregar `const x = 'gastronomy'` en cualquier archivo de `packages/*/src` → rojo;
  agregar una **sexta** exención sin actualizar el auto-chequeo → rojo; agregar un marcador en línea sin
  subir el conteo → rojo; agregar `/es/gastronomia/` a un componente → rojo; volver a escribir
  `gastro-<slug>` como cache tag o `seedKey: 'gastronomy:…'` → rojo; dejar `"gastronomy": "Gastronomía"` como
  valor de `nav.json` → rojo (regla 5); renombrar la dimensión de destino a `venue` → la lista de (a) no
  cierra → rojo; volver a escribir `home.categoryTiles.tiles.gastronomy` → rojo (regla 1, ya no exento); devolver `'gastronomy'` al `ck_vertical_id` de la 0129 → rojo (chequeo de valores);
  `const x = 'gastronomy'` en un test que no aplica migraciones ni importa una data-migration → rojo. **Control
  negativo**: la migración de renombrado (`ALTER TABLE "gastronomies" RENAME TO …`), el `ALTER TABLE "gastronomies"`
  de la 0132 y `entityType: 'gastronomy'` en `cut-migration-over-data.test.ts` → verde.

## G-FAC-T1 · Frontera temporal del renombrado (etapa A)
- **Prueba**: durante la etapa A del sub-spec 1 (DEC-FAC-030), las ocurrencias de la forma de identificador de la
  vertical vieja (regla 1 de G-FAC-R1) fuera de las exenciones y de lo fuera del escaneo de G-FAC-R1 coinciden
  **exactamente** con un inventario JSON contado por archivo, y ningún PR sube un conteo ni agrega un archivo. Cada PR de
  la etapa A baja el inventario en lo que renombró; un alias temporal (`export type Gastronomy = Venue`) también cuenta.
- **Nace** en la primera hoja de la etapa A (`1.A1` del árbol). **Se retira** en el tramo de la etapa B que hace nacer
  G-FAC-R1 (`1.B5`): el inventario llega a cero y se borran script, test y paso de CI en el mismo tramo.
- **Lo que NO verifica**: rutas, URLs y valores persistidos (todavía viejos por diseño en la etapa A) ni los valores
  visibles de i18n (regla 5 de G-FAC-R1, que nace después).
- **Se rompe**: agregar `GastronomyFoo` en `packages/*/src` sin subir el inventario → rojo; subir el conteo de un archivo
  → rojo; un alias temporal nuevo → rojo; un archivo que bajó a cero y sigue en el inventario → rojo.

## G-FAC-R2 · Redirects de rutas retiradas
- **Prueba**: para cada ruta pública retirada (`/{lang}/gastronomia/`, `/{lang}/gastronomia/<slug>/`,
  `/{lang}/gastronomia/<slug>/carta/`, `/planes/gastronomia/…`, `/presentacion/gastronomia/`,
  `/publicar/gastronomia/`, `/mi-cuenta/comercio/gastronomy/…`, `publicar-restaurante`) existe un redirect de un salto.
  Extiende `public-redirect-paths.guard.test.ts`. Fuentes aceptadas: `apps/web/src/lib/legacy-redirects.ts`
  **y** los redirects declarados en la propia página (`publicar-restaurante/index.astro` ya redirige
  así), para que una regla definida en la página no quede ni roja ni invisible (F-V1-045).
- **Casos obligatorios**:
  - los redirects de `/mi-cuenta/comercio/gastronomy/<id>/editar/<seccion>/` conservan la ruta profunda
    y el query (F-V1-045);
  - **QR de un salto** (F-V1-007, F-V2-051): el escaneo de `/qr/<slug>/` (la ruta real,
    `apps/web/src/pages/qr/[slug].astro`) de un código GENERATED de menú o de folleto llega en **un** salto a
    `/comer-y-salir/…`, porque `qr_codes.target_url` se migró; el redirect legacy de
    `/gastronomia/<slug>/carta/` es la red para enlaces y códigos MANUAL, no lo que protege al sticker;
  - el código de estado de las rutas retiradas es **302 durante el soak** y 301 después (DEC-FAC-030); el
    guard verifica el código vigente declarado en el mapa, no uno fijo;
  - el redirect **de estado** de `/comer-y-salir/<slug>/carta/` a la ficha (sin carta disponible) no es una
    ruta retirada y es siempre **302 con `no-store`** (DEC-FAC-042): el guard lo verifica aparte y es rojo un
    301 o una respuesta cacheable.
- **Se rompe**: borrar la regla de `/carta/` → rojo; dejar sin migrar una fila GENERATED de un fixture
  de QR → rojo (dos saltos); perder el query en el redirect de `mi-cuenta` → rojo; servir el redirect de
  estado de `/carta/` como 301 → rojo.

## G-FAC-01 · El CHECK de `business_lines` coincide con el catálogo
Con DEC-FAC-026 no hay tabla espejo (`listing_business_line` no existe), así que G18 no se toca (F-V1-004
queda resuelto por no tener tabla que identificar por primera columna).
- **Prueba**: el CHECK `<tabla>_business_lines_valid` de cada tabla de ficha (`venues`, `accommodations`,
  `experiences`), **generado desde el catálogo** en el `dbschema` (como `ck_vertical_id`), coincide con los
  valores del catálogo de esa vertical y exige `cardinality >= 1`; en `venues`, además, el `CASE type::text`
  coincide con `typeRules[*].allowed` (DEC-FAC-047); y el default de cada tabla es el del catálogo
  (`ARRAY['standard']` en las verticales de un rubro, ninguno en `venues`, DEC-FAC-046). Lo cubre la guarda de
  drift de migraciones y un test que compara el SQL del CHECK de la última migración con el catálogo. También
  prueba que cada tabla de ficha con vertical tiene la columna y el índice GIN. Retirar o renombrar un rubro =
  una migración que reescribe las filas y regenera el CHECK; si una regla estática futura (máximo N,
  exclusión) se suma al CHECK, el mismo test la cubre.
- **Se rompe**: agregar un valor al catálogo sin migración → rojo; CHECK de una tabla de ficha sin el rubro
  nuevo → rojo; quitar `cardinality >= 1` del CHECK → rojo; tabla de ficha nueva sin columna → rojo; permitir
  `food` a BOLICHE en `typeRules` sin regenerar el CHECK → rojo; poner un default en `venues` → rojo.

## G-FAC-02 · Integridad del catálogo
Test de `@repo/schemas`. Prueba que:
1. toda vertical con ficha tiene ≥1 rubro;
2. los valores de rubro son únicos por vertical;
3. un rubro sólo referencia secciones de su vertical;
4. toda sección no común está en ≥1 rubro;
5. todo valor del enum de tipo de la vertical tiene `typeRules` con `allowed` no vacío, `allowed` ⊆ rubros
   de la vertical y `preselect` ⊆ `allowed` y no vacío (DEC-FAC-034);
6. toda `entitlementKey` de una sección o de un rasgo existe en el catálogo de claves con scope
   `vertical`, y aparece en ≥1 plan de **esa** vertical del catálogo de producción
   (`scripts/production-catalog/catalog.ts`). La vertical de una clave se **deriva** de los planes donde
   aparece; no se agrega un atributo al catálogo de claves (F-V1-030; DEC-FAC-008 descartó reabrir
   HOS-1353 cap. 15);
7. los ids de sección y de rasgo son únicos por vertical (F-V1-031);
8. toda vertical con ficha declara ≥1 sección (evita un catálogo vacío que pase la regla 4 por
   vacuidad, F-V1-014);
9. una vertical con un solo rubro no lo declara `public` (F-V1-036);
10. las restricciones declaradas (`maxPerListing`, `excludes`) referencian rubros de su vertical y la
    preselección de cada tipo las cumple (DEC-FAC-026);
11. cada campo del schema de update de la vertical pertenece a **exactamente una** sección (`fields`,
    DEC-FAC-040); es la invariante que hoy prueba `listing-section-payload.test.ts` en el web, movida a su
    dueño. Dos rasgos **pueden** compartir clave (`menu.qr` y `menu.qrMetrics`, DEC-FAC-051): la regla 7
    exige ids únicos, no claves únicas. `menuUrl` es de `menu`, no de `price` (DEC-FAC-062);
12. dimensiones de reseña (DEC-FAC-065, 071, 073): ids únicos por vertical; toda `boundSection` existe en su
    vertical y **no** es común; toda dimensión tiene `labelKey` con valor en es/en/pt; **toda vertical cuyas reseñas
    recalcula la base compartida (hoy venue y experiencia) declara `ReviewRules`** (no hay default implícito); el
    schema del desglose de una vertical `votedOnly` se deriva de sus dimensiones.
- **Se rompe**: una mutación por regla (sacar `menu` de `food`, agregar un valor de tipo sin
  `typeRules`, apuntar una sección a una clave inexistente o de otra vertical, duplicar un id, vaciar las
  secciones de una vertical, declarar público un rubro único, una preselección que viole un `excludes`, un
  campo del schema de update sin sección o en dos, `menuUrl` de vuelta en `price`, ligar `food` a una sección
  común o inexistente, borrar el `ReviewRules` de experiencia) → cada una en rojo por separado.

## G-FAC-03 · Rubros: quién decide y quién lee
Partido en dos predicados con nombre propio (F-V1-018). El de antes («sólo el resolvedor importa el
catálogo») prohibía lo que los sub-specs 5, 6 y 7 exigen, y no veía `listing.businessLines.includes('nightlife')`.
- **(a) Decidir secciones** (DEC-FAC-043, F-V2-011): fuera de `packages/verticals/src/listing-sections/` nadie
  compara un rubro. El guard **no se ancla en el texto** de los valores (`food`, `nightlife` y `standard` ya son
  claves y comparaciones en POI, rating de destino, reseña del venue, rate limit, sponsorship): con el checker
  de TypeScript (modelo: los guards de `check-listing-clock.ts`), es rojo toda comparación,
  `includes`/`some`/`indexOf`, `switch`, clave de objeto o índice cuyo **operando sea de tipo `BusinessLine`**
  (o arreglo de él), en `apps/*` y `packages/*`. Además, las constantes de valor de rubro del catálogo sólo se
  importan desde los módulos de (b) y del mapa de slugs. Importar el catálogo **para mostrar opciones**
  (selector del alta, checkboxes del admin, chips de colección, vía `resolveBusinessLineOptions`) queda
  permitido.
- **(b) Leer los rubros de una ficha**: lista cerrada de módulos que leen la columna `business_lines`
  (resolvedor, repositorio de hechos `loadFacts`, lector público por vertical, filtro de listado, admin),
  en inventario JSON con conteos exactos. Modelo: `check-listing-clock.ts`.
- **Lo que NO verifica**: un rubro copiado a una variable `string` (sin el tipo) y comparado después; lo frena
  la revisión y la regla de importación de constantes.
- **Se rompe**: `listing.businessLines.includes('nightlife') && <NightInfo/>` en un componente del web → rojo
  (a); `lines.some((l) => l === nightlifeValue)` con `lines: BusinessLine[]` → rojo (a); una lectura nueva de
  `business_lines` desde un servicio fuera del inventario → rojo (b). **Control negativo**: `style === 'standard'`
  en `rate-limit.ts` y `{ food: … }` en el rating de la reseña → verde.

## G-FAC-04 · Sin literales de clave para secciones ni rasgos
- **Prueba**: las rutas de subrecursos de contenido declaran el **id de sección** (y, si el cuerpo lo
  pide, ids de **rasgo**) y la clave sale del catálogo. Ninguna ruta, gate de cuerpo ni handler usa un
  literal de clave que pertenezca a una sección o a un rasgo, en ninguna de estas formas (F-V1-019):
  `listingAccess.capabilities`, `step6Key`, una constante que resuelva al literal,
  `enforceUserGate({ keys })` o `readEffectiveKeys` fuera del resolvedor.
- **Alcance** (DEC-FAC-049, F-V2-010): venue y **experiencia** (que migra su gate de indicaciones al
  resolvedor: `routes/experience/protected/patch.ts` y el `Record` de `routes/ai/protected/chat.ts` dejan sus
  literales). **Alojamiento** declara sus claves en el catálogo pero su código no se migra en esta spec: lista
  **cerrada y contada** de archivos exentos (`routes/accommodation/protected/{addOccupancy,removeOccupancy,
  batchOccupancy,updateOccupancyEvent,calendarSync,calendarConnectGoogle,calendarConnectIcal}.ts`,
  `utils/entitlement-filter.ts`, `routes/accommodation/public/list.ts`, `getWhatsApp.ts`), con auto-chequeo
  exacto como G-FAC-08; el hijo 8 la vacía. Agregar un archivo a la lista sin subir el conteo → rojo.
- **Se rompe**: volver a escribir `capabilities: ['manage_venue_menu']` en `putMenu` → rojo;
  `step6Key: 'menu_qr_scan_metrics'` en `menuQr` → rojo; `const KEY = 'menu_item_photos'` usado en un
  gate → rojo; `['manage_experience_directions']` en el PATCH de experiencia → rojo; una ruta nueva de
  alojamiento con un literal de clave fuera de la lista → rojo.

## G-FAC-05 · Sin despacho por vertical ni por sección en web y admin
- **Prueba** (cierra el «Abierto» anterior, F-V1-028): **lista cerrada de archivos** que el mecanismo
  reemplaza (registro del editor **para venue y experiencia**, hub, `resolve-listing-editor-page.ts`, managers de secciones,
  `ListingCreateForm.client.tsx`, `ListingEditor.client.tsx`, `PriceSection.client.tsx`,
  `BasicInfoSection.client.tsx`, `owner-listings.ts`, `mi-cuenta/comercio/index.astro`, config consolidada
  del admin, **y desde DEC-FAC-065 el formulario de reseña de venue, el recálculo de reseñas de la base compartida,
  la vista de moderación de reseñas del admin y, desde DEC-FAC-064, el aviso de bajada de plan**), con un
  predicado ancho **dentro** de ellos: cualquier comparación contra un literal de vertical, **de id de sección, de
  tipo de ficha o de id de dimensión de reseña** (`sectionId === 'meetingPoint'`, `dim === 'food'`), en ternario, `&&`, `if` o lookup;
  cualquier `Record<Vertical, Section[]>`; y la reaparición de `GastronomyOrExperience` o de
  `*_ONLY_SECTIONS`. No se ensancha G1(b) a todo el web (21 falsos positivos medidos el 2026-10-07).
- **Se rompe**: reintroducir el ternario de `listing-editor-registry.ts` → rojo; reintroducir
  `sectionId === 'meetingPoint' && vertical === 'experience'` → rojo; `type !== 'BOLICHE' && <FoodRating/>` o
  `dim === 'food' && hasMenu` en el formulario de reseña → rojo; `vertical === 'experience' ? legacy : voted` en el
  recálculo → rojo (el modo sale de `ReviewRules`).
- **Nace incremental** (arreglo del árbol de PRs): G-FAC-05 nace en el sub-spec 5 (`5.8`) con los archivos del editor y
  los de otras superficies ya migradas. Los archivos de su lista que cambian en los sub-specs 6 y 7 (formulario de reseña
  de venue, config consolidada y moderación de reseñas del admin) y el aviso de bajada de plan (post-MVP,
  DEC-FAC-083), que no están upstream de `5.8`, entran al escaneo en el
  PR que los migra si G-FAC-05 ya existe, o los incluye `5.8` al nacer si ya están migrados. La lista cerrada final es
  la misma; sólo cambia cuándo entra cada archivo.

## G-FAC-06 · Toda ruta de contenido declara su sección
- **Prueba** (F-V1-019): inventario cerrado `ruta → sección` (modelo `scripts/check-step5-declared.ts`).
  Rojo si una ruta bajo `routes/<vertical>/{protected,admin}/` que toca una tabla de subrecurso de una
  sección no común no declara `listingSection`, y rojo si declara una sección común pudiendo
  declarar la propia. Cubre lecturas (`getMenu`, `getDailySpecials`, `getEvents`) y escrituras. Además
  (F-V2-007, F-V2-040): rojo si la ruta **no usa la cadena** (`listingAccess`) aunque declare la sección
  (declarar sin cadena no hace nada), y rojo si una ruta `DELETE` o de vaciado no declara intención `delete`
  (DEC-FAC-041).
- **Se rompe**: quitar `listingSection` de `putDailySpecials` → rojo; agregar una ruta nueva de la
  carta sin declararla → rojo; `getMenu` con `listingSection` pero con `createCRUDRoute` y chequeo a mano →
  rojo; `deleteMenuFile` con intención `write` → rojo (y su e2e de borrado en `locked` también).

## G-FAC-07 · Billing no lee rubros
- **Prueba** (F-V1-032, F-V2-057): ningún archivo de `packages/payments`, de `apps/api/src/routes/plan-catalog/`
  ni de las rutas `billing-*` del API importa el módulo de rubros de `@repo/schemas` ni lee la columna
  `business_lines`. Se implementa como caso de G14 (`scripts/check-billing-verticals-boundary.ts`, cuyo
  `HALVES.billing` hoy es sólo `packages/payments`). La comparativa por rubro se arma en el web.
- **Se rompe**: un import del catálogo de rubros desde `packages/payments` → rojo; una marca de rubro en la
  respuesta de `routes/plan-catalog` → rojo.

## G-FAC-08 · Lista manual de secciones de alojamiento congelada
- **Prueba** (DEC-FAC-033): el editor de alojamiento conserva su lista de secciones escrita a mano
  (`apps/web/src/lib/editor/accommodation-editor-sections.ts` y la rama de alojamiento del registro). Un
  inventario JSON con el **conteo exacto** y los ids de sección de esa lista, comparado contra el código;
  cualquier alta, baja o reordenamiento es rojo hasta que lo haga el hijo 8 (migración de alojamiento al
  catálogo), que reemplaza este guard por G-FAC-05 extendido. Piso mínimo de archivos escaneados y test
  de control positivo. Además (F-V2-038): el conjunto de ids de secciones de alojamiento del **catálogo**
  (sub-spec 2) es igual al de la lista manual, con el mismo orden y grupo, para que el hijo 8 no arranque
  reescribiendo el catálogo.
- **Lo que NO verifica**: el gating por campo de alojamiento (video, descripción enriquecida, insignia;
  `entitlement-filter.ts`); eso lo cubren sus tests de no regresión (sub-spec 3).
- **Se rompe**: agregar una sección a la lista de alojamiento → rojo; quitarla → rojo; derivar la lista del
  catálogo antes del hijo 8 → rojo; agregar una sección de alojamiento sólo al catálogo → rojo.

## G-FAC-09 · Ninguna validación de rubros fuera del validador
- **Prueba** (DEC-FAC-026, reformulado por DEC-FAC-046 y 047): **ninguna validación de rubros vive fuera del
  validador**. Fuera de `packages/schemas/src/catalog/` nadie compara `businessLines` contra un conjunto
  permitido, un máximo o una exclusión, ni recalcula opciones (la UI usa `resolveBusinessLineOptions`).
  Inventario cerrado de llamadores de `validateBusinessLines` y `resolveBusinessLineOptions` con conteo exacto
  (modelo `check-listing-clock.ts`). No exige que **todo** camino de escritura llame al validador: tests,
  fábricas y scripts insertan directo, y la garantía ahí es la base (CHECK con la matriz y default).
- **Se rompe**: un servicio con `if (businessLines.length > 2)` propio → rojo; un componente que filtra opciones
  con `allowed.includes(x)` propio → rojo; un llamador nuevo del validador fuera del inventario → rojo.

## G-FAC-10 · El purge cubre las columnas de contenido
- **Prueba** (F-V2-023): el purge de `PURGED` limpia el contenido con un `SET` escrito a mano por vertical
  (`packages/db/src/models/listing/listing-purge.model.ts`) y G-R9 cuenta tablas, no columnas. Este guard
  lee las columnas de `venues`, `accommodations` y `experiences` desde su `dbschema` y exige que cada una esté
  en el `SET` del purge de su vertical **o** en una lista cerrada y contada de columnas de
  sistema/clasificación (`id`, `owner_id`, `type`, `business_lines`, `publication_status`, `created_at`, …).
  Además (F-V3-007, DEC-FAC-074): las columnas de contenido del `SET` del purge coinciden con
  `LISTING_SUPPORT_EDIT_CONTENT_FIELDS` (`packages/service-core/src/services/listing/listing-support-edit.ts`, la lista
  de la acción 15, copia a mano del purge) y `business_lines` está en `LISTING_NON_CONTENT_FIELDS`.
  Piso mínimo de columnas por tabla y test de control positivo.
- **Lo que NO verifica**: el contenido en tablas hijas (lo cubre G-R9) ni en el almacenamiento externo.
- **Se rompe**: agregar `entry_note_i18n` a `venues` sin sumarla al `SET` → rojo; sumarla al `SET` y no a la lista
  de la acción 15 → rojo; agregar una columna a la lista de sistema sin subir el conteo → rojo.

## Guards existentes que tocan las tablas nuevas
- **G-R9** (`scripts/check-purged-closed-list.ts`): toda tabla nueva con FK a una ficha entra a
  `scripts/guards/purged-closed-list.json` y a la tabla de HOS-1353 `docs/02-modelo-de-datos.md` §4.1 en
  el mismo PR, con su tratamiento en `PURGED` (F-V1-017). Con la columna `business_lines` (DEC-FAC-026) no hay tabla
  nueva; las columnas nuevas de `nightInfo` viven en la fila de la ficha, su borrado lo hacen PB9/PB12 y lo
  garantiza G-FAC-10.

## Guards atados al nombre (sub-spec 1)
Si no se actualizan, **no fallan**: el piso de archivos se sigue cumpliendo y dejan de mirar la
vertical renombrada (F-V1-024). El criterio de aceptación de cada uno es una **mutación posterior al
renombrado** sobre un archivo de venue que lo ponga en rojo:

| guard | anclaje con el nombre | mutación posterior al renombrado |
|---|---|---|
| G2c `scripts/check-vertical-immutable.ts:15,17` | `LISTING_PATH`, `LISTING_TABLE` | agregar `vertical` al schema de update de venue → rojo |
| G-R9 `scripts/check-purged-closed-list.ts:23` | `LISTING_TABLES` | tabla nueva con FK a `venues` sin fila → rojo |
| G1(b) `scripts/check-vertical-axis-items.ts:72` | `DISPATCH_LITERALS` | `x === 'venue' ? A : B` en `packages/*/src` → rojo |
| G18 `scripts/check-catalog-sql.ts` | cargas del catálogo | fila de catálogo de venue sin migración → rojo |
| resto de discovery A §8 | según el script | una mutación por script, listada en el PR |
