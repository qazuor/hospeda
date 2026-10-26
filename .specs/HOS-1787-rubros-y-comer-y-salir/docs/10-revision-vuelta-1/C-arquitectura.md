---
title: Revisión vuelta 1 — Revisor C (arquitectura, genericidad, coherencia con HOS-1353)
linear: HOS-1787
created: 2026-10-25
---

# Revisión vuelta 1 · C · Arquitectura y genericidad

Lente: ¿el mecanismo de rubros es genérico de verdad, o deja ramas por vertical que obligan a
reescribir cuando llegue el segundo caso (alojamiento casa / hotel / complejo)? ¿Es coherente con
lo que HOS-1352/1353 dejó en `staging`? Base verificada: checkout `origin/staging` @ `2ebee74d0a`.

**Resumen**: 24 hallazgos · **1 CRÍTICA** · **10 ALTA** · **10 MEDIA** · **3 BAJA**.
Requieren decisión del owner: 001, 003, 005, 009, 018, 019.

La tesis en una línea: el diseño es genérico **en el catálogo**, pero no en los bordes. Alojamiento
queda afuera del editor, el gating público de alojamiento es por **campo** y no por sección, las
claves que viven *dentro* de una sección (fotos de plato, carta traducida, indicaciones) no tienen
lugar en el modelo, y los guards se pueden esquivar justo por donde el repo ya documentó fugas.

---

### F-V1-C-001 · Alojamiento conserva su registro propio: la genericidad queda en el papel · ALTA

**Dónde**: sub-spec 5 («Alojamiento conserva su registro propio salvo lo que el catálogo cubra (a
definir en la revisión)»); sub-spec 2 (tabla de contenido inicial: alojamiento `estandar` →
«todas las propias de la vertical», sin enumerarlas); DEC-FAC-004.

**Evidencia**:
- `apps/web/src/lib/editor/accommodation-editor-sections.ts:53-122`: 11 secciones propias
  (`capacityPricing`, `location`, `photos`, `seo`, `calendar`, `externalReputation`…), con ids
  distintos para el mismo concepto (`photos` acá, `media` en venue/experiencia).
- `apps/web/src/lib/editor/accommodation-editor-sections.ts:115-119` + `editor-registry.ts:135-136`:
  la sección `translations` de alojamiento ya se gatea por clave con `visibilityKey`, que **oculta**
  (falla cerrado), o sea un segundo mecanismo de «sección gateada por clave» que convive con
  `BLOQUEADA` (que **muestra con upsell**).
- `apps/web/src/lib/editor/listing-editor-registry.ts:30-36`: el tipo `GastronomyOrExperience`
  deja a alojamiento fuera del registro compartido por construcción.
- Rutas de alojamiento que gatean secciones con clave: `routes/accommodation/protected/addOccupancy.ts:45`,
  `calendarSync.ts:71` (`can_use_calendar`, `can_sync_external_calendar`).

**Problema**: el requisito 3 del PDR nombra a alojamiento como el segundo caso. Si alojamiento no
entra al catálogo de capacidades en esta spec, el día que se divida en rubros hay que: migrar su
registro, reconciliar `visibilityKey` con `BLOQUEADA`, mover sus rutas a `contentCapability`,
renombrar `photos`/`media`. Eso es exactamente la reescritura que el owner quiere evitar. Además,
G-FAC-02 regla 4 y el resolvedor no pueden probarse sobre alojamiento si su catálogo está vacío o
dice «todas».

**Escenario de falla**: en seis meses se agrega el rubro `complejo` con capacidad
`unitsInventory`. No hay dónde declararla: el editor de alojamiento no lee el catálogo, el
resolvedor nunca corrió para alojamiento, y la sección `calendar` sigue gateada por un literal en
cinco rutas.

**Propuesta**:
1. **(Recomendada)** Alojamiento y experiencia entran completos al catálogo en esta spec: cada
   sección actual es una capacidad (`comun: true` todas, rubro `estandar` sin capacidades propias),
   `visibilityKey` se retira y la sección de traducciones pasa a `entitlementKey` (con la decisión
   explícita de si pasa de oculta a `BLOQUEADA`), y el registro de alojamiento se deriva igual que
   los otros. Costo: más superficie en sub-spec 5; beneficio: el mecanismo queda probado en tres
   verticales.
2. Alojamiento entra sólo al catálogo y al resolvedor (API), y el editor se migra en un hijo
   aparte, con un guard que impida agregar secciones nuevas al registro manual.
3. Dejarlo como está. Contradice DEC-FAC-004.

`REQUIERE DECISIÓN DEL OWNER`.

---

### F-V1-C-002 · Las claves que viven DENTRO de una sección no tienen lugar en el modelo · ALTA

**Dónde**: sub-spec 2 (`ContentCapabilityDefinition.entitlementKey?` único); sub-spec 3 (rutas
declaran `contentCapability`, «la clave sale del catálogo»); G-FAC-04.

**Evidencia**:
- `apps/api/src/routes/gastronomy/protected/putMenu.ts:85-89`: la carta exige
  `manage_gastronomy_menu` **y**, según el cuerpo, `menu_item_photos` y `multilingual_gastronomy_menu`.
- `apps/api/src/routes/gastronomy/protected/uploadMenuItemPhoto.ts:81`: `menu_item_photos` como
  clave de ruta.
- `apps/api/src/routes/experience/protected/patch.ts:65-68`: `manage_experience_directions` sólo si
  el cuerpo trae `meetingPointDirections` (un campo dentro de la sección `meetingPoint`).
- `apps/api/src/routes/gastronomy/protected/menuQr.ts:153-157`, `menuQrScans.ts:105-109`:
  `menu_qr_scan_metrics` por `step6Key`, no por `capabilities`.
- `apps/api/src/routes/gastronomy/public/getBySlug.ts:121-158`: la proyección pública de la carta
  usa las tres claves.

**Problema**: el modelo «una capacidad = cero o una clave» no puede expresar «la carta está
`DISPONIBLE`, pero las fotos de plato están `BLOQUEADA`». Quedan dos salidas, las dos malas: (a)
las subclaves siguen como literales en las rutas (dos fuentes de verdad: catálogo para `menu`,
literal para `menu_item_photos`), y G-FAC-04 no las ve porque «no pertenecen a una capacidad»; o
(b) el implementador las convierte en capacidades hermanas (`menuItemPhotos`) que el editor
mostraría como secciones. Tampoco está dicho qué pasa con el QR de carta en un boliche: la carta
es `AUSENTE` pero `menuQr` no declara capacidad.

**Escenario de falla**: un local `noche` sin `gastronomia` pide `GET .../menu-qr`: pasa (no hay
paso de capacidad en `READ_OWN_COMMERCIAL`) y genera un QR que lleva a una carta que la ficha
pública no muestra.

**Propuesta**: modelar **rasgos** dentro de una capacidad:
`features?: readonly { id; entitlementKey }[]` (p. ej. `menu.itemPhotos`, `menu.translations`,
`menu.qrMetrics`, `meetingPoint.directions`), que el resolvedor devuelve como sub-mapa y que la
ruta pide por id (`contentCapability: 'menu', contentFeatures: ({body}) => [...]`). G-FAC-04 se
extiende a `step6Key` y a todo literal de clave que aparezca en un rasgo. El QR de carta se
declara rasgo de `menu`, así hereda `AUSENTE`.

---

### F-V1-C-003 · El gating público de alojamiento es por CAMPO y alimenta 9 lectores; experiencia no es «una inconsistencia» · ALTA

**Dónde**: sub-spec 3, «Ficha pública: `getBySlug` de cada vertical reemplaza sus proyecciones a
mano (…, `entitlement-filter.ts`, el `false` literal de experiencia) por el resolvedor»;
discovery B §2.

**Evidencia**:
- `apps/api/src/utils/entitlement-filter.ts:16-21`: `PUBLIC_FIELD_KEYS` = `richDescription`,
  `video`, `verification`, `aiChat`. Son rasgos de campo (descripción enriquecida, video embebido,
  insignia), no secciones.
- `resolvePublicFieldGrants` (`entitlement-filter.ts:38-63`) se usa en 9 lectores públicos:
  `accommodation/public/{getBySlug,getById,list,getByDestination,getTopRatedByDestination,similar}.ts`,
  `destination/public/getAccommodations.ts`, `user/public/getAccommodations.ts`,
  `feature/public/getAccommodationsByFeature.ts`. Incluye **listados**, resueltos por dueño.
- `apps/api/src/routes/experience/public/getBySlug.ts:64-82`: el `false` está comentado
  «HOS-1049: keep directions hidden until replacement coverage exists»; y
  `experience/public/directions-projection.ts:100` también recorta **listados**.

**Problema**: (1) reemplazar sólo `getBySlug` deja ocho lectores con el mecanismo viejo: dos fuentes
para «qué publica este dueño». (2) El resolvedor es por ficha y necesita los rubros de cada una;
en un listado de 24 tarjetas eso es una consulta de rubros por página que nadie diseñó. (3) Los
campos de `PUBLIC_FIELD_KEYS` no son capacidades del catálogo; meterlos ahí exige el modelo de
rasgos de F-V1-C-002. (4) El `false` de experiencia es una decisión (HOS-1049), no un descuido:
reemplazarlo por el resolvedor **publica indicaciones pagas** que hoy están ocultas a propósito.

**Escenario de falla**: el implementador hace lo que dice la sub-spec; la ficha de alojamiento
muestra el video (resolvedor) y la tarjeta del mismo alojamiento en `/alojamientos/` no (filtro
viejo); en experiencia, las indicaciones aparecen en la ficha pública al día siguiente del merge.

**Propuesta**: (a) acotar sub-spec 3: el resolvedor gobierna **secciones**; los rasgos de campo
entran por F-V1-C-002 o quedan explícitamente fuera de alcance con su lista cerrada; (b) un único
lector público por vertical que todos los endpoints públicos (detalle y listados) usen, con carga
de rubros en lote; (c) decidir HOS-1049: ¿se levanta el ocultamiento de indicaciones con el
resolvedor o se mantiene? `REQUIERE DECISIÓN DEL OWNER` (punto c).

---

### F-V1-C-004 · El paso nuevo mezcla existencia y plan, no tiene número y duplica la lógica del paso 6 · ALTA

**Dónde**: sub-spec 3, «Paso nuevo en `resolve-listing-access.ts`, después del paso 4 (recurso) y
antes del 6», con `AUSENTE` → 404 y `BLOQUEADA` → `NO_CAPABILITY` en el mismo paso.

**Evidencia**:
- `packages/verticals/src/authorization/resolve-listing-access.ts:139-147`: entre el 4 y el 6 está
  el **paso 5 (cobertura)**, que devuelve `NO_COVERAGE`.
- `resolve-listing-access.ts:25`: `evaluatedSteps: readonly (3 | 4 | 5 | 6 | 7)[]`; los números
  están citados en V5.md §1.2, en `apps/api/docs/error-contract.md` («steps 3 through 7») y en
  `runListingContentCall` (`apps/api/src/middlewares/listing-access.ts:105`).
- `entitlement-step.ts:263-282`: la regla «valor efectivo > 0» ya existe; el resolvedor de sub-spec
  3 la reescribe («`BLOQUEADA` si su valor efectivo no es > 0»).

**Problema**: «después del 4 y antes del 6» admite dos posiciones. Si el paso va antes del 5, una
ficha de un dueño sin cobertura recibe `NO_CAPABILITY` (upsell «subí de plan») en lugar de
`NO_COVERAGE` (upsell «suscribite»): cambia la respuesta de rutas que hoy funcionan. Si va después
del 5, `AUSENTE` (existencia) queda detrás de una regla de negocio, contra el orden del propio
contrato. Además, dos implementaciones de «la clave está otorgada» (resolvedor y paso 6) van a
divergir (p. ej. en el manejo de `undefined` o del fallo de lectura).

**Escenario de falla**: un dueño con la suscripción vencida abre la carta en el editor: hoy ve
«necesitás una suscripción»; con el paso antes del 5 ve «necesitás el plan Pro», paga el Pro y la
vertical igual no lo cubre hasta que el cobro se acredite.

**Propuesta (recomendada)**: partir el paso. `AUSENTE` como **paso 4b** inmediatamente después del 4
(es existencia, no depende del sujeto ni del plan; sólo de los hechos de la ficha). `BLOQUEADA` **no**
es un paso nuevo: la clave de la capacidad se agrega a `requiredKeys` del paso 6, que ya la
evalúa sobre el sujeto (dueño, también en la acción 15). El resolvedor puro se reduce a «estado
estructural» (`AUSENTE`/presente) + delega el plan en `resolveEntitlementStep`, una sola regla.
Fijar el tipo de `evaluatedSteps` (`'4b'` o renumerar con decisión explícita) y actualizar
`error-contract.md`.

---

### F-V1-C-005 · `AUSENTE` → 404 al DUEÑO contradice la regla 3 del contrato de errores · ALTA

**Dónde**: sub-spec 3 («`AUSENTE` → 404 (la sección no existe para esta ficha)»), sub-spec 4
(«404 en las demás»).

**Evidencia**:
- `apps/api/docs/error-contract.md:277-281`: «A refusal aimed at the row's OWNER. Then the refusal
  is about the row's STATE, not its existence… The owner already knows the row exists; a 404 would
  replace an actionable reason with a lie. This is why the mask cannot simply rewrite every 403.»
- `apps/api/docs/error-contract.md:68`: el 404 del resolvedor tiene «body matches the entity
  ownership 404».
- `apps/api/src/middlewares/listing-access.ts:210-211`: `NOT_FOUND` → `HTTPException(404,
  '${vertical} not found')`.

**Problema**: el 404 del contrato existe para no revelar que una fila ajena existe. Acá el que
pregunta es el dueño, que sabe que la ficha existe y que eligió sus rubros: «la carta no aplica a
este local» es un estado de la ficha, no una inexistencia. Con el mismo cuerpo que «la ficha no
existe», el cliente no puede distinguirlos.

**Escenario de falla**: el editor recibe 404 al guardar `nightInfo` justo después de que el dueño
quitó `noche` en otra pestaña; el manejador genérico de 404 del web lo manda al listado de «mis
fichas» como si la ficha hubiera desaparecido.

**Propuesta**:
1. **(Recomendada)** 404 sólo para el camino ajeno (ya lo cubre el paso 4); para el dueño (o la
   acción 15), **409 `CAPABILITY_ABSENT`** con `{ capability }` en `details`: es un conflicto con el
   estado actual de la ficha y es accionable («agregá el rubro»). Se documenta en el contrato.
2. 404 con un `reason: 'CAPABILITY_ABSENT'` distinguible en `details` (rompe «body matches the
   ownership 404»).
3. 404 pelado como dice la spec, aceptando la ambigüedad.

`REQUIERE DECISIÓN DEL OWNER`.

---

### F-V1-C-006 · Un `contentCapability` por ruta no sirve para el PATCH de la ficha, y los hechos son pre-escritura · ALTA

**Dónde**: sub-spec 3 (`contentCapability: 'menu'`, singular); sub-spec 4 («Escritura del dueño por
el PATCH de la ficha con el paso de capacidad»); sub-spec 5 («Los rubros se editan dentro de la
sección de datos básicos»).

**Evidencia**:
- `apps/api/src/routes/gastronomy/protected/patch.ts:48`: el PATCH de la ficha escribe muchas
  secciones comunes (`basicInfo`, `price`, `contact`…) en una sola ruta.
- `apps/api/src/middlewares/listing-access.ts:144-147`: `loadFacts` lee la fila **antes** de la
  escritura; la cadena decide sobre el estado previo.

**Problema**: `nightInfo` viaja por el mismo PATCH que `basicInfo` y que los rubros. Un único id
de capacidad por ruta no lo expresa: hace falta una capacidad condicionada al cuerpo (como hoy
`patch.ts` de experiencia). Y si el mismo PATCH **agrega** `noche` y carga `nightInfo`, los hechos
pre-escritura dicen `AUSENTE` y la ruta rechaza un pedido válido; al revés, uno que **quita** `noche`
y escribe `nightInfo` pasa.

**Escenario de falla**: alta de un boliche en dos pasos desde el formulario de datos básicos: el
dueño tilda `noche` y completa la entrada en el mismo guardado → 404/409. Si el web manda el objeto
entero con `entryKind: null` en cada guardado, todo local sin `noche` recibe el rechazo al editar
su nombre.

**Propuesta**: (a) `contentCapability` acepta función del cuerpo (`({ body }) => ids[]`), detectada
por presencia de campos de la capacidad, ignorando `null`/ausentes; (b) regla explícita: la
capacidad se evalúa sobre los rubros **resultantes** del pedido (hechos + rubros del cuerpo), o
bien rubros y contenido de capacidades no comunes no pueden viajar en el mismo PATCH (400). Elegir
una y escribirla; recomiendo la primera de (b), con test de los dos órdenes.

---

### F-V1-C-007 · G-FAC-01 no es implementable como «una carga más de G18» · CRÍTICA

**Dónde**: `docs/06-guards.md` G-FAC-01 («una carga nueva en `scripts/generate-catalog-sql.ts`… no
un guard nuevo»); sub-spec 2 (`listing_facet` con PK `(vertical, slug)`).

**Evidencia**:
- `scripts/generate-catalog-sql.ts:51`: «Column names, in insert order. The first one is the
  primary key.»
- `scripts/check-catalog-sql.ts:307`: `const key = row[0] as string;` y `:276`: «inserted twice…
  the second insert would violate the primary key».
- `scripts/check-catalog-sql.ts:33-35` y `:225`: G18 falla ante cualquier `UPDATE`/`DELETE` sobre
  una tabla cargada.

**Problema**: con PK compuesta, la primera columna no identifica la fila. Si es `vertical`, las dos
filas de `venue` chocan; si es `slug`, `estandar` de alojamiento choca con `estandar` de
experiencia. G18 reporta «inserted twice» sobre un catálogo correcto. Además, como G18 prohíbe
`DELETE`, **no existe camino para retirar o renombrar un rubro** (incluido `estandar` el día que
alojamiento se divida), y la FK compuesta desde `r_<vertical>_facet` lo haría imposible igual sin
migrar las filas de relación.

**Escenario de falla**: el implementador agrega la carga, G18 queda rojo en el primer commit; para
pasarlo cambia el orden de columnas o mete un `id` ad hoc sin decisión, o agrega una excepción al
guard.

**Propuesta**: (a) surrogate `id` determinístico (UUIDv5 de `facet:<vertical>:<slug>`, el patrón de
`scripts/production-catalog/loads.ts:20-22`) como primera columna + `UNIQUE (vertical, slug)` para
la FK compuesta; o (b) enseñarle a G18 claves compuestas (`keyColumns`) con su test positivo.
Recomiendo (a): no toca G18. Y escribir en la spec el **procedimiento de retiro de un rubro**
(migración de relación + cómo se representa la baja frente a G18), aunque hoy no se use.

---

### F-V1-C-008 · Las tres tablas de relación ponen rojo a G-R9 y nadie decidió qué les pasa en `PURGED` · ALTA

**Dónde**: sub-spec 2 (`r_venue_facet`, `r_accommodation_facet`, `r_experience_facet`); sub-spec 4
(columnas `nightInfo` en `venues`). La spec no menciona `PURGED`, `PB9`, `PB12` ni G-R9.

**Evidencia**:
- `scripts/check-purged-closed-list.ts:1-12`: toda tabla con FK a una tabla de ficha necesita fila
  en `scripts/guards/purged-closed-list.json`; corre en CI (`.github/workflows/ci.yml:357`).
- HOS-1353 `docs/02-modelo-de-datos.md` §4.1 (lista cerrada): «una tabla nueva que cuelgue de
  `listing` entra acá en el mismo acto, con su fila».

**Problema**: el primer PR del sub-spec 2 queda rojo en G-R9 y el implementador tiene que inventar
el tratamiento. Hay una tensión real: si `PURGED` borra la relación, se rompe la invariante «≥1
rubro» sobre filas que siguen existiendo; si la conserva, hay que decirlo y justificarlo. Lo mismo
para `dress_code` (texto del dueño) y los demás campos de `nightInfo`: son contenido de la ficha y
`PB9`/`PB12` tienen que borrarlos.

**Escenario de falla**: se agrega la fila con `inPurged: "keep"` por defecto; `PB12` borra la carta
pero no `dress_code`, y un dato del dueño sobrevive al borrado que él pidió.

**Propuesta**: agregar a sub-spec 2 y 4 una sección «En `PURGED`»: relación de rubros **se
conserva** (no es contenido del dueño, es clasificación, y mantiene la invariante), `nightInfo` **se
borra** con el contenido (`PB9`/`PB12`, coordinado con V6/V9). Filas nuevas en
`purged-closed-list.json` y en la tabla de HOS-1353 §4.1 en el mismo PR.

---

### F-V1-C-009 · La afirmación «la base no puede expresar ≥1 rubro sin trigger» es falsa: columna array · MEDIA

**Dónde**: sub-spec 2 («≥1 rubro por ficha: lo exige el servicio… la base no lo puede expresar
sin trigger»).

**Evidencia**:
- `apps/api/src/utils/listing-access/ports.ts:92-120`: `loadFacts` ya hace `select()` de la fila
  entera por vertical; `readListingAccessFacts` (`packages/verticals/src/authorization/listing-facts.ts:16-27`)
  lee la fila «of any shape».
- Rutas de escritura que no pasan por el servicio de alta: `routes/gastronomy/admin/batch.ts`,
  seeds y data-migrations.

**Problema**: con tablas de relación, la invariante vive sólo en el servicio y cualquier camino que
no lo use (batch admin, seed, script) la rompe en silencio. Una columna `facets text[] NOT NULL`
por tabla de ficha con `CHECK (cardinality(facets) >= 1 AND facets <@ ARRAY[...])` la garantiza
en la base, viaja en la fila que `loadFacts` ya lee (cero código por vertical nuevo en el puerto,
cero consulta extra en la cadena y en los listados públicos), se indexa con GIN para las
colecciones, y no agrega tablas a G-R9. Contras: el CHECK duplica la lista del catálogo (hay que
vigilarlo: generado desde el código en el `dbschema`, como `vertical`, y cubierto por el drift
guard) y se pierde la FK a `listing_facet` (que pasa a ser innecesaria).

**Propuesta**:
1. **(Recomendada)** Columna array con CHECK generado del catálogo; `listing_facet` desaparece; G-FAC-01
   pasa a ser «el CHECK de cada tabla de ficha coincide con el catálogo».
2. Tablas de relación como dice la spec + trigger de restricción diferible para ≥1 (carril extras).
3. Tablas de relación sin garantía en base (la spec actual).

`REQUIERE DECISIÓN DEL OWNER` (cambia DEC-FAC-007 en su parte de base).

---

### F-V1-C-010 · G-FAC-03 contradice a los sub-specs 5, 6 y 7, y no ve comparaciones por literal · ALTA

**Dónde**: `docs/06-guards.md` G-FAC-03 («sólo el módulo del resolvedor… lee las tablas de relación
o importa el catálogo de rubros… Se rompe: importar el catálogo de rubros desde un componente del
web → rojo»).

**Evidencia** (en la propia spec):
- sub-spec 5: «Al elegir el tipo se preseleccionan sus rubros (derivado del catálogo)» → el
  formulario de alta del web importa el catálogo.
- sub-spec 6: colección «slug resuelto contra el catálogo»; «API pública de listado: filtro por
  rubro (`?rubro=`)» → una consulta de listado lee la tabla de relación.
- sub-spec 7: «grupo de checkboxes derivado del catálogo», «columna y filtro por rubro» → el admin
  importa el catálogo y su listado lee la relación.

**Problema**: tal como está escrito, G-FAC-03 prohíbe lo que tres sub-specs exigen; el implementador
lo va a llenar de excepciones (inventario JSON con conteos), que es la «escape hatch que esconde el
fail-open». A la vez, el guard está anclado en **imports**: el web va a recibir `facets: string[]`
en el detalle del dueño (lo necesita para los checkboxes) y puede escribir
`listing.facets.includes('noche') && <NightInfo/>` sin importar nada. Eso es exactamente la regla 1
del paraguas violada, y el guard queda verde.

**Propuesta**: partir G-FAC-03 en dos predicados con nombre propio: (a) **decidir secciones**: sólo
el resolvedor convierte rubros en estados (prohibido en `apps/*` y `packages/*` fuera de
`packages/verticals/src/facets/` comparar contra un slug de rubro: literales del catálogo
`'gastronomia'|'noche'|'estandar'` en comparaciones, `includes`, `switch`, claves de objeto); (b)
**leer la relación**: lista cerrada de módulos (resolvedor, repositorio de hechos, filtro de
listado, admin) en el inventario. Importar el catálogo para mostrar opciones queda permitido. Ver
también F-V1-C-019: con slugs no ambiguos el predicado (a) es mucho más fácil de anclar.

---

### F-V1-C-011 · Falta el guard que obliga a declarar la capacidad; G-FAC-04 sólo prohíbe el literal · ALTA

**Dónde**: `docs/06-guards.md` G-FAC-04; sub-spec 3 («Las rutas de carta, menú del día, eventos y
`nightInfo` pasan por el paso nuevo»).

**Evidencia**:
- Rutas de subrecurso de contenido sin clave hoy, que igual dependen de una capacidad no común:
  `routes/gastronomy/protected/getMenu.ts`, `getDailySpecials.ts`, `getEvents.ts` (lecturas que
  según la spec deben dar `AUSENTE`), `menuQr.ts`, `menuQrScans.ts` (por `step6Key`).
- `apps/api/src/types/authorization.ts:61-63`: `capabilities` admite función; un `const KEY = '…'`
  o un `enforceUserGate({ keys: [...] })` dentro del handler (`utils/listing-access/user-gate.ts:9-28`)
  no son «`listingAccess.capabilities` con literal».
- Precedente del repo: `scripts/check-step5-declared.ts` fija qué operaciones pasan el paso 5.

**Problema**: el riesgo real no es un literal sobrante, es una **ruta nueva que se olvida** de
declarar `contentCapability`: queda abierta en fichas donde la sección es `AUSENTE`, y ningún guard
lo nota (fail-open por omisión). G-FAC-04 además se esquiva con una constante, con `step6Key` o con
el gate de usuario.

**Propuesta**: guard nuevo **G-FAC-06 «toda ruta de subrecurso de contenido declara su capacidad»**:
inventario cerrado `ruta → capacidad` (como `check-step5-declared.ts`), red si una ruta bajo
`routes/<vertical>/{protected,admin}/` que toca una tabla de subrecurso de una capacidad no común
no declara `contentCapability`, y red si una ruta declara una capacidad común pudiendo declarar la
propia. G-FAC-04 se amplía a `step6Key`, a identificadores que resuelvan a un literal de clave de
capacidad y a `enforceUserGate`/`readEffectiveKeys` con claves de capacidad fuera del resolvedor.

---

### F-V1-C-012 · Extender G1(b) no atrapa las ramas que la spec quiere eliminar · MEDIA

**Dónde**: `docs/06-guards.md` G-FAC-05.

**Evidencia**:
- `scripts/check-vertical-axis-items.ts:19-25`: G1(b) detecta **una** forma: comparación con literal
  de vertical alimentando un ternario. `:33-39`: «An `if (x === 'gastronomy') return A; return B;`
  chain, a lookup with a default, or a ternary on a variable that already holds the comparison is
  invisible to it».
- Ramas listadas en discovery B §1: `ListingEditor.client.tsx` ~880/897
  (`sectionId === 'meetingPoint' && vertical === 'experience'`, un `&&`, no un ternario),
  `owner-listings.ts`, `PriceSection.client.tsx:65`, el tipo `GastronomyOrExperience`.
- La razón de la exención del 2026-10-07 (`check-vertical-axis-items.ts:37-43`): 21 falsos positivos
  medidos al ensanchar.

**Problema**: G-FAC-05 promete «reintroducir el ternario → rojo», pero las ramas reales son `&&`,
`if` y lookups. El guard queda verde con la mayoría de la ramificación intacta (lección del repo:
un guard anclado en una forma deja pasar cinco).

**Propuesta**: G-FAC-05 por **lista cerrada de archivos** (los que el mecanismo reemplaza:
registro, hub, resolve-page, managers, create form) con un predicado más ancho dentro de ellos:
cualquier comparación contra un literal de vertical **o de id de capacidad** (`sectionId ===
'meetingPoint'`), cualquier `Record<Vertical, Section[]>`, y la reaparición de
`GastronomyOrExperience`/`*_ONLY_SECTIONS`. Cerrar el «Abierto» del guard con esa opción.

---

### F-V1-C-013 · «Cambiar de rubro oculta, no borra» filtra por consumidores que la spec no lista · ALTA

**Dónde**: paraguas regla 5; sub-spec 3 («Ficha pública: `getBySlug`…»).

**Evidencia**:
- `apps/api/src/routes/ai/protected/chat.ts:112`, `:301`, `:333`: el chat de IA decide incluir la
  carta en el contexto por `manage_gastronomy_menu`, sin rubro
  (`services/ai-context/gastronomy-ai-context.ts:116`).
- `routes/gastronomy/protected/menuQr.ts:118` (QR de mesa con `purpose` de carta),
  `apps/web/src/pages/[lang]/gastronomia/[slug]/carta.astro` (página de carta de los QR impresos,
  que G-FAC-R2 redirige «para siempre»).
- `routes/experience/public/directions-projection.ts:100` (listados públicos de experiencia).

**Problema**: el contenido de una capacidad `AUSENTE` se conserva en base, así que cualquier lector
que no pase por el resolvedor lo publica. La spec sólo nombra `getBySlug`. El chat de IA es el caso
más claro: un local que quitó `gastronomia` sigue respondiendo con su carta vieja. Y la página
`/carta/` de un local sin `gastronomia`: ¿404, o redirige a la ficha? Los QR impresos van a seguir
llegando.

**Escenario de falla**: un resto que se convirtió en boliche quita `gastronomia`; la ficha ya no
muestra la carta, pero el asistente de IA de la ficha cita los platos y precios de hace un año.

**Propuesta**: inventario cerrado de **lectores de contenido de capacidad** (detalle público,
listados, `/carta/`, chat de IA, QR, brochure, sitemap/JSON-LD `hasMenu` si aplica) en sub-spec 3,
cada uno con su paso por el resolvedor y su comportamiento ante `AUSENTE`; `/carta/` sin la
capacidad → 301 a la ficha (no 404: el QR impreso sigue sirviendo). Un guard de G-FAC-03(b) cubre
que nadie más lea esas tablas.

---

### F-V1-C-014 · La purga por cambio de plan no existe para fichas que siguen publicadas · MEDIA

**Dónde**: sub-spec 6, «Verificar que la invalidación de cobertura existente ya dispare la
revalidación de las fichas del dueño».

**Evidencia**:
- `packages/verticals/src/publication/coverage-recalculation.ts:249-255`: la revalidación se pide
  sólo para `[...decision.lowered, ...decision.restored]`.
- `apps/api/src/utils/listing-publication/coverage-listener.ts:21-46`: el aviso de cobertura llama
  a `recalculateCoverage`, nada más.
- `packages/verticals/src/effective-set-cache/coverage-invalidation.ts:4-11`: invalida el conjunto
  efectivo en Redis, no la cache pública.
- `routes/gastronomy/public/getBySlug.ts:170-173`: `cacheTTL: 300` en la API; la página Astro tiene
  su propia cache.

**Problema**: un cambio Pro → Básico deja las fichas publicadas (no bajan ni se restauran) y no
dispara revalidación: la capa web sigue sirviendo la carta paga hasta que su cache expire por sí
sola. La verificación que pide la spec ya tiene respuesta: no lo hace. Esto es así hoy, pero esta
spec convierte la condición en contrato (regla 4: «un cambio de plan purga la cache»).

**Propuesta**: diseñarlo en sub-spec 6: ante el aviso de cobertura/cambio de conjunto efectivo de
`user + vertical`, revalidar todas las fichas `PUBLISHED` del dueño en esa vertical (un tercer task
en `publicationAfterCommit` o un oyente propio), con test de que un cambio de plan sin cambio de
estado de publicación pide la revalidación.

---

### F-V1-C-015 · G-FAC-02 regla 6 no se puede verificar: las claves no dicen de qué vertical son · MEDIA

**Dónde**: `docs/06-guards.md` G-FAC-02 regla 6 («toda `entitlementKey` de una capacidad existe en
el catálogo de claves, con scope de vertical y para la misma vertical»).

**Evidencia**: `packages/schemas/src/catalog/entitlement-keys.ts:28`, `:34-35`, `:41`: la tupla es
`[key, scope, aggregation, enforcement, class]`; `scope` vale `'vertical'` sin decir **cuál**. No
hay atributo clave → vertical.

**Problema**: «para la misma vertical» no tiene fuente. El implementador va a inventar una
(prefijo del nombre, `manage_venue_*`) que se rompe con claves sin vertical en el nombre
(`menu_item_photos`, `can_use_calendar`).

**Propuesta**: derivar la vertical de la clave del catálogo de planes (la clave aparece sólo en
planes de esa vertical, `scripts/production-catalog/catalog.ts`) y escribir esa derivación en la
regla; o bajar la regla a «existe y tiene scope `vertical`». No agregar un atributo al catálogo de
claves (reabre HOS-1353 cap. 15, descartado en DEC-FAC-008).

---

### F-V1-C-016 · Ids de capacidad tipados como `string`, y sin regla para un id desconocido · MEDIA

**Dónde**: sub-spec 2 (`id: string`, `capabilities: readonly string[]`); sub-spec 3
(`contentCapability: 'menu'`, `ReadonlyMap<CapabilityId, …>`).

**Evidencia**: precedente de fallo cerrado ante clave desconocida:
`packages/verticals/src/authorization/entitlement-step.ts:254-271` (`UnknownStepKeyError`).

**Problema**: un typo en una ruta (`contentCapability: 'menú'`) o en un rubro sólo se detecta si el
test de integridad lo cubre; en la cadena, `map.get('menú')` devuelve `undefined` y la spec no dice
si eso es `AUSENTE`, `DISPONIBLE` o un error. Si el implementador lo trata como «sin restricción»,
es fail-open. Tampoco se exige unicidad de `id` por vertical en G-FAC-02.

**Propuesta**: ids como unión literal por vertical derivada del catálogo
(`ContentCapabilityId<V>`), `contentCapability` tipado con la vertical de la ruta, el resolvedor
**lanza** ante un id desconocido (como `UnknownStepKeyError`), y G-FAC-02 suma «id único por
vertical».

---

### F-V1-C-017 · La regla 2 («billing no lee rubros») no tiene guard · MEDIA

**Dónde**: paraguas regla 2; DEC-FAC-003.

**Evidencia**: `scripts/check-billing-verticals-boundary.ts:9-12`: G14 sólo mira imports entre
`packages/payments` y `packages/verticals`. El catálogo de rubros vive en `@repo/schemas`, que
ambas mitades importan libremente.

**Problema**: nada impide que billing importe el catálogo de rubros desde `@repo/schemas` (p. ej.
para un addon «rubro extra» futuro, DEC-FAC-006) y G14 queda verde. La regla está escrita y no
vigilada.

**Propuesta**: predicado chico (o caso en G14): ningún archivo de `packages/payments` importa el
módulo de rubros de `@repo/schemas` ni lee `listing_facet`/la columna de rubros. Barato y cierra
la regla.

---

### F-V1-C-018 · Dos choques de nombre: *facet* (web) y *capacidad* (HOS-1353) · MEDIA

**Dónde**: DEC-FAC-013, OD-07; sub-spec 2 (`ContentCapabilityDefinition`), sub-spec 3
(`contentCapability`).

**Evidencia**:
- *facet*: `apps/web/src/lib/filters/facet-config.ts`, `lib/facet-slugs.ts`,
  `lib/seo/promoted-facet-canonical.ts`, `lib/filters/facet-crawl-policy.ts` (17 archivos del web
  con `FacetId`/`facet-*`). Sub-spec 6 construye las colecciones de rubro **con ese mismo
  andamiaje** (patrón `/alojamientos/tipo/[type]/`), así que en los mismos archivos convivirán
  «promoted facet» (filtro) y «listing facet» (rubro).
- *capacidad*: HOS-1353 `docs/15-entitlements-y-limits.md:36,190` usa «capacidad» para una clave
  booleana; en código, `ListingAccessConfig.capabilities` son claves
  (`apps/api/src/types/authorization.ts:61`) y `NO_CAPABILITY` es «falta la clave»
  (`resolve-listing-access.ts:33`).

**Problema**: `contentCapability: 'menu'` al lado de `capabilities: ['manage_venue_menu']` en la
misma ruta, y `NO_CAPABILITY` respondiendo a `BLOQUEADA` de una «capacidad de contenido», es una
trampa de lectura permanente. Y `facet` en el web pasa a significar dos cosas en los archivos que
más se van a tocar.

**Propuesta**:
1. **(Recomendada)** Capacidad de contenido → **`ListingSection`** («sección», que es lo que es en
   la UI); rubro → **`BusinessLine`** (inglés correcto de «rubro»; tablas `listing_business_line` /
   columna `business_lines`). Ninguno choca.
2. Mantener `ListingFacet` y renombrar el concepto del web a `FilterFacet` (17 archivos, fuera de
   alcance natural); capacidad → `ListingSection`.
3. Mantener ambos nombres y documentar la ambigüedad.

`REQUIERE DECISIÓN DEL OWNER` (toca DEC-FAC-013).

---

### F-V1-C-019 · Slugs de rubro en español como identificadores de código y base · MEDIA

**Dónde**: DEC-FAC-015 («un nombre por rubro (slug = UI = URL)»: `gastronomia`, `noche`,
`estandar`); G-FAC-R1 («Un `gastronom` pelado no sirve si… el rubro `gastronomia` se queda»).

**Evidencia**: precedente del repo para valores de dominio con URL en español:
`apps/web/src/lib/facet-slugs.ts` (`ACCOMMODATION_TYPE_SLUG_BY_ENUM`): enum en inglés, mapa a slug
español en el web, 301 del slug inglés. Regla del repo: identificadores en inglés.

**Problema**: los slugs pasan a ser literales en el catálogo, en `CHECK`s, en fixtures, en filas de
base y en comparaciones (que F-V1-C-010 quiere prohibir). `gastronomia` como valor persistido es
justo lo que complica el guard del renombrado (OD-03/OD-05): hay que distinguir «la palabra
retirada» de «el valor vivo» en todo el repo.

**Propuesta**:
1. **(Recomendada)** Valor de código/base en inglés (`food`, `nightlife`, `standard`) + mapa
   `slug español` en el web, como `facet-slugs.ts`. G-FAC-R1 queda limpio: `gastronomia` sólo vive
   en el mapa de slugs y en los redirects.
2. Mantener DEC-FAC-015 y aceptar la excepción en G-FAC-R1 y en la regla de inglés.

`REQUIERE DECISIÓN DEL OWNER` (toca DEC-FAC-015).

---

### F-V1-C-020 · Qué hace el resolvedor sin rubros o sin conjunto efectivo no está escrito · MEDIA

**Dónde**: sub-spec 3 (firma pura con `facets` y `effectiveSet` ya resueltos).

**Evidencia**: `apps/api/src/utils/listing-access/user-gate.ts:47-81`: en lo público, un fallo de
lectura del conjunto efectivo devuelve todo `false` (fail-closed) y se loguea como `warn`; esa
respuesta se cachea en el borde (`getBySlug.ts:170-173`).

**Problema**: tres casos sin regla: (1) ficha con cero rubros (backfill incompleto, camino que
saltea el servicio; ver F-V1-C-009): con la regla actual todas las no comunes salen `AUSENTE` y la
carta desaparece **sin error**; (2) fallo del conjunto efectivo en lo público: todo `BLOQUEADA`,
cacheado; (3) fallo en el endpoint del editor: ¿500 o mapa degradado? Un fallo cerrado silencioso
y cacheado es indistinguible de «el dueño no pagó».

**Propuesta**: escribir la tabla: cero rubros = error de integridad (log `error` + métrica, la
ficha se trata con los rubros derivados del tipo como red de seguridad o se niega con 500 en
escrituras); fallo del conjunto efectivo en público = `BLOQUEADA` **sin** cache de borde larga
(`no-store` o TTL corto en esa respuesta); en el editor = 503, nunca un mapa degradado.

---

### F-V1-C-021 · La coordinación con HOS-1362 depende de dónde viva `BLOQUEADA` · MEDIA

**Dónde**: sub-spec 3 («en la acción 15… por la regla de HOS-1362 de evaluar sobre el dueño»);
sub-spec 7 («la acción 15 consulta el resolvedor evaluado sobre el dueño»); sub-spec 3 «Editor
(dueño): endpoint protegido por ficha que devuelve el mapa».

**Evidencia**: `packages/verticals/src/authorization/resolve-listing-access.ts:100-124`: la cadena
ya fija `subjectId` = dueño cuando corre la acción 15 y los pasos 4-7 corren sobre él;
`apps/api/src/middlewares/listing-access.ts:200-203` expone `subjectId` al handler.

**Problema**: si `BLOQUEADA` se implementa fuera de la cadena (como sugiere «consulta el
resolvedor»), cada superficie tiene que acordarse de pasar el conjunto efectivo del **dueño** y no
el del actor; el endpoint del mapa, llamado por soporte, devolvería el plan del empleado. Con
F-V1-C-004 (`BLOQUEADA` dentro del paso 6) la coordinación con V8 es automática.

**Propuesta**: el endpoint del mapa declara `listingAccess` (`READ_OWN`, admite acción 15) y calcula
con `ctx.get('listingAccess').subjectId`; la sub-spec 7 deja de describir una «consulta» aparte y
pasa a «las rutas de la acción 15 heredan el paso». Test: soporte con plan propio Premium sobre un
dueño Básico ve `BLOQUEADA`.

---

### F-V1-C-022 · La entrada de rubros no puede llevar una propiedad `vertical` (G2c) · BAJA

**Dónde**: sub-spec 2 (relación con `facet_vertical` + `facet_slug`); sub-spec 5/7 (edición de
rubros en datos básicos y en el admin).

**Evidencia**: `scripts/check-vertical-immutable.ts:15-18`: en esquemas `update|patch` bajo rutas
de ficha, una propiedad llamada `vertical` es roja.

**Problema**: si el esquema de edición modela un rubro como `{ vertical, slug }` (el par de la FK),
G2(c) se pone rojo con un falso positivo o, peor, alguien lo «arregla» exceptuándolo.

**Propuesta**: escribir que la entrada es `facets: slug[]` y que `facet_vertical` lo pone el
servidor desde la tabla.

---

### F-V1-C-023 · La parte de presentación del catálogo queda partida sin decirlo · BAJA

**Dónde**: sub-spec 2 (`order`, `group` en `@repo/schemas`); sub-spec 5 («las secciones salen del
catálogo… (orden y grupo del catálogo)»).

**Evidencia**: `apps/web/src/lib/editor/editor-registry.ts` (`EditorSection = {id, slug, group,
labelKey, visibilityKey?}`); discovery B §1: una página Astro por slug con el slug hard-codeado.

**Problema**: `slug` (español), `labelKey` y el componente siguen en el web; `order`/`group` pasan
a `schemas`. Sin un mapa web **exhaustivo por tipo** (`Record<ContentCapabilityId<V>, {slug,
labelKey, Component}>`), una capacidad nueva compila sin página y cae al hub en silencio.

**Propuesta**: declararlo: dominio en `schemas`, presentación en un `Record` exhaustivo en el web
(la exhaustividad de TS es el guard), y evaluar si `order`/`group` no pertenecen también al web.

---

### F-V1-C-024 · El parámetro público `?rubro=` rompe la convención de la API · BAJA

**Dónde**: sub-spec 6 («filtro por rubro (`?rubro=`)»).

**Evidencia**: la API pública filtra por `?type=` (discovery B §2), en inglés.

**Problema**: parámetro en español en una API cuyo vocabulario es inglés; el nombre de código del
concepto (`ListingFacet` o el que salga de F-V1-C-018) y el parámetro divergen.

**Propuesta**: `?facet=` (o el nombre que decida F-V1-C-018); `rubro` queda en la URL pública del
web, que ya es española.
