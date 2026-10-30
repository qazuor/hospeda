---
title: Revisión vuelta 2 — Revisor C (arquitectura, genericidad, cadena de autorización, guards)
linear: HOS-1787
created: 2026-10-25
---

# Revisión vuelta 2 · C · Arquitectura y genericidad

Lente: ¿el mecanismo es genérico de verdad (cualquier vertical, más rubros, restricciones futuras) sin
ramas por vertical o por rubro? ¿La cadena de autorización, el contrato de errores y los guards
aguantan lo que la spec les pide? Base verificada: worktree `hospeda-hos-1795-claude-md` en
`origin/staging` @ `a44b8f05b4`. No se reabren hallazgos cerrados en la vuelta 1 salvo que el arreglo
esté mal o incompleto.

**Resumen**: 21 hallazgos · **0 CRÍTICA** · **7 ALTA** · **11 MEDIA** · **3 BAJA**.
Necesitan decisión del owner: **003, 004, 018**.

La tesis en una línea: el catálogo quedó bien, pero le falta una pieza (**qué campos son de cada
sección**), y sin esa pieza cada ruta, cada lector público y cada editor vuelve a escribir a mano lo
que el catálogo tendría que decir. Además, tres decisiones de la vuelta 1 chocan con el código tal cual
está: el borrado en `locked`, el QR de la carta y el `menuUrl` gratis.

---

### F-V2-C-001 · Al catálogo le falta «qué campos son de cada sección», y sin eso no hay nada genérico · ALTA

**Qué está mal**: `ListingSectionDefinition` (sub-spec 2, líneas 30-38) declara id, clave, rasgos,
orden y grupo, pero **no** los campos de la ficha que pertenecen a la sección. Tres piezas de la spec
dependen de ese dato y ninguna dice de dónde sale:
1. la detección del PATCH «por presencia de campos no nulos de esa sección» (DEC-FAC-021, sub-spec 3
   líneas 85-92);
2. la «proyección única por mapa de estados» del lector público (sub-spec 3, línea 115), que tiene que
   saber qué columnas sacar cuando `nightInfo` está `absent` o `locked`;
3. el editor derivado, que hoy restringe el cuerpo por sección.

**Evidencia**:
- El mapa sección → campos existe, pero sólo en el web:
  `apps/web/src/components/listing/editor/listing-section-payload.ts:47-90`
  (`LISTING_SECTION_PAYLOAD_KEYS`), con su invariante «cada campo pertenece a exactamente una sección»
  probada en `listing-section-payload.test.ts` (docblock :20-26).
- Las rutas detectan hoy a mano, una por una: `apps/api/src/routes/experience/protected/patch.ts:63-68`
  (`Object.hasOwn(body, 'meetingPointDirections')`), `apps/api/src/routes/gastronomy/protected/putMenu.ts:85-89`
  (`menuPayloadCarriesItemPhoto`, `menuPayloadCarriesTranslations`).
- Las proyecciones públicas son a mano por sección: `routes/gastronomy/public/menu-projection.ts`,
  `daily-specials-projection.ts`, `events-projection.ts`, `routes/experience/public/directions-projection.ts`.

**Escenario de falla**: el agente del sub-spec 4 agrega `entry_kind`… a `venues`. Para el 4b escribe
`listingSection: ({ body }) => (body.entryKind != null || body.minAge != null || …) ? ['nightInfo'] : []`
en el PATCH de venue; para lo público escribe `night-info-projection.ts`; para el editor suma las claves a
`LISTING_SECTION_PAYLOAD_KEYS`. Tres listas de los mismos siete campos, en tres paquetes. Al sumar
`dress_code_note_i18n` se actualizan dos de las tres: o se publica un campo de una sección `absent`, o el
PATCH lo escribe sin pasar por el 4b. Con un segundo rubro de alojamiento se repite todo. Es exactamente
el «código específico» que el owner quiere evitar.

Agravante: los campos traducibles. La sección común `translations` cubre `nameI18n`…`richDescriptionI18n`
(`listing-section-payload.ts:86`); el sub-spec 4 (líneas 53-55) deja abierto dónde se traducen
`entry_note` y `dress_code_note`. Si se editan desde `translations` (común), un dueño sin `nightlife`
escribe contenido de `nightInfo` por una sección que nunca es `absent`.

**Propuesta**: sumar a la definición de la sección `fields: readonly (keyof <UpdateInput de la vertical>)[]`
(tipado contra el schema de update, para que un campo renombrado no compile), incluidos sus `*I18n`. Con
eso: (a) un único detector genérico `sectionsTouchedByBody({ vertical, body })` en `@repo/schemas`
reemplaza las funciones por ruta del PATCH; (b) un único proyector genérico quita los `fields` de toda
sección no `available`; (c) `LISTING_SECTION_PAYLOAD_KEYS` se deriva del catálogo; (d) G-FAC-02 suma la
regla «cada campo del schema de update pertenece a exactamente una sección» (la invariante que hoy prueba
el web, movida a su dueño). Los subrecursos con tabla propia (carta, menú del día, eventos) siguen con su
ruta y su `listingSection` fijo; los rasgos que dependen del cuerpo (fotos de plato) siguen siendo código
de la sección, que está permitido.

**Decisión del owner**: no (técnica).

---

### F-V2-C-002 · «Borrar en `locked`» no se puede expresar: la cadena no distingue leer, escribir y borrar · ALTA

**Qué está mal**: DEC-FAC-025 (aceptada en 037) y el sub-spec 3 (líneas 102-105) dicen que la API acepta
el borrado de una sección `locked` y que las lecturas no se gatean por plan. Pero el mecanismo propuesto
es uno solo: la ruta declara la sección y su clave entra a `requiredKeys` del paso 6. Esa clave se evalúa
igual para cualquier operación.

**Evidencia**:
- `apps/api/src/routes/gastronomy/protected/deleteMenuFile.ts:39-44`: operación `EDIT` con
  `capabilities: ['manage_gastronomy_menu']`. Hoy un dueño bajado a básico **no puede** borrar su PDF.
- El mapa del sub-spec 3 (línea 99) asigna `deleteMenuFile` → `menu.file`. Un rasgo hereda la clave de su
  sección para `locked` (sub-spec 3, reglas líneas 32-35), así que el paso 6 pide `manage_venue_menu` y
  responde 403: lo contrario de DEC-FAC-025.
- `apps/api/src/types/authorization.ts` (`capabilities`) y `middlewares/listing-access.ts:175-178`: no
  hay forma de declarar «esta ruta borra».
- `putMenu` es un PUT de reemplazo (`putMenu.ts:81-89`): sacar tres platos o vaciar la carta es el mismo
  pedido que agregar uno. «Borrar» no tiene forma propia en esa ruta.

**Escenario de falla**: un dueño pasa de pro a básico con la carta cargada. El hub le muestra «bloqueada
con datos» y un botón de borrar (sub-spec 5, líneas 73-76). Lo aprieta y recibe 403
`ENTITLEMENT_REQUIRED`, con el upsell. El e2e del sub-spec 5 («borrado permitido y 403 al guardar») no se
puede poner verde sin inventar algo en la ruta.

**Propuesta**: la declaración de sección lleva una intención: `listingSection: { id, intent: 'read' |
'write' | 'delete' }` (o función del cuerpo que devuelve pares). `read` y `delete` corren sólo el 4b;
`write` corre 4b + clave en el paso 6. Para los PUT de reemplazo, la ruta clasifica el cuerpo: vacío =
`delete`; si no, `write` (borrar platos sueltos con la sección `locked` queda fuera, y se dice). G-FAC-06
verifica que toda ruta `DELETE` o de vaciado declare `delete`, y una mutación prueba que una ruta de borrado
con `write` pone rojo el e2e.

**Decisión del owner**: no (DEC-FAC-025 ya la tomó; falta el mecanismo).

---

### F-V2-C-003 · El QR de mesa: la spec lo vuelve gratis sin decirlo, y como está escrita la ruta tira 500 · ALTA

**Qué está mal**: el sub-spec 2 (línea 43) declara el rasgo `menu.qr` **sin clave**, y el sub-spec 3
(líneas 99-100) dice que `menuQr` → `menu.qr` «deja de usar `step6Key`».

**Evidencia**:
- `apps/api/src/routes/gastronomy/protected/menuQr.ts:153-158`: `operation: 'READ_OWN_COMMERCIAL'`,
  `step6Key: 'menu_qr_scan_metrics'`. Hoy el QR de mesa **y** sus métricas piden la misma clave.
- `packages/verticals/src/authorization/resolve-listing-access.ts:151-153`: `READ_OWN_COMMERCIAL` es
  `CALLER_KEY` y **lanza** `Error('READ_OWN_COMMERCIAL requires step6Key')` si falta. Sacar el
  `step6Key` sin cambiar la operación = 500 en cada pedido.
- `scripts/production-catalog/catalog.ts` (planes de gastronomía): `menu_qr_scan_metrics` está sólo en
  `-premium`; `manage_gastronomy_menu` en `-pro` y `-premium`.

**Escenario de falla**: el agente sigue el sub-spec al pie de la letra: quita `step6Key`, la ruta lanza,
y el widget del QR muestra error a todos. Lo corrige cambiando la operación a `READ_OWN` con sección
`menu`: ahora el QR de mesa, que hoy es premium, queda para pro (o para básico si `qr` se evalúa sin la
clave de la carta). Es un cambio de lo que se vende que ningún DEC registra, y que ningún test de la spec
mira (DEC-FAC-002: los precios y lo que incluye cada plan no cambian).

**Propuesta / opciones para el owner**:
1. **(Recomendada)** Sin cambio de producto: `menu.qr` lleva `entitlementKey: 'menu_qr_scan_metrics'` (como
   `qrMetrics`), y la ruta pasa a declarar sección + rasgo con una operación que no sea `CALLER_KEY`.
   Pro: nada cambia para nadie. Contra: dos rasgos con la misma clave (G-FAC-02 tiene que admitirlo).
2. QR de mesa incluido con la carta (pro y premium); métricas sólo premium. Pro: más valor en pro. Contra:
   cambio comercial, copy de la tabla de planes y What's New.

**Decisión del owner**: **sí**.

---

### F-V2-C-004 · El enlace externo de la carta (`menuUrl`) es gratis y vive en «precio»: el modelo «una sección, una clave» no lo puede ubicar · ALTA

**Qué está mal**: la carta tiene hoy una parte gratis (el enlace externo) y partes pagas (carta
estructurada, archivo, fotos, traducción). La spec modela `menu` como una sección con
`entitlementKey: manage_venue_menu` que se pone entera `locked`. No dice dónde va `menuUrl`.

**Evidencia**:
- `apps/api/src/routes/gastronomy/public/menu-projection.ts:101-103`: «`menuUrl` (the external link) is
  NOT a parameter here on purpose: it is the one fallback still free on every tier and is never gated».
- `apps/web/src/components/listing/editor/listing-section-payload.ts:88`: `price: ['priceRange',
  'menuUrl', …]`. El enlace se edita en la sección común `price`.
- Sub-spec 3, líneas 119 y 122: el folleto «imprime la carta sólo con `menu` `available`» (hoy imprime
  `menuUrl`) y `hasMenu` «sólo con `menu` `available`».

**Escenario de falla** (dos caminos, los dos malos):
- Si `menuUrl` pasa a `menu`: todo dueño básico **pierde** el único enlace de carta que hoy publica gratis.
  Cambio visible en todos los locales básicos, sin decisión.
- Si se queda en `price` (común): un BOLICHE (`{nightlife}`, sin `menu`) carga y publica un enlace de
  carta por una sección que nunca es `absent`; el JSON-LD y el folleto tienen que decidir si lo muestran
  mirando `menu`, que dice `absent`. Lectores que se contradicen.

**Propuesta**: `menu` deja de llevar clave a nivel sección; sus partes pasan a rasgos: `link` (sin clave),
`structured` (`manage_venue_menu`), `file` (`manage_venue_menu`), `itemPhotos`, `translations`, `qr`,
`qrMetrics`. `menuUrl` se mueve de `price` a `menu` (con F-V2-C-001 eso es un cambio de dato). La sección
nunca queda `locked`; quedan `locked` sus rasgos. `/carta/` y `hasMenu` miran «algún rasgo con contenido
`available`», declarado en el catálogo, no en el lector.

**Decisión del owner**: **sí**, una pregunta de producto: ¿un local sólo de noche (BOLICHE) puede publicar
un enlace de carta de tragos?
1. **(Recomendada)** No: el enlace es parte de `menu`, que es del rubro `food`. Coherente con DEC-FAC-034
   («si tiene cocina, elige BAR»). Contra: un boliche con carta de tragos no tiene dónde ponerla.
2. Sí: el enlace pasa a una sección común propia (`menuLink`). Contra: `hasMenu` en un boliche.

---

### F-V2-C-005 · G-FAC-04 queda rojo sobre código que DEC-FAC-033 promete no tocar (y HOS-1049 está mal descripto) · ALTA

**Qué está mal**: G-FAC-04 prohíbe, en cualquier ruta, un literal de clave que pertenezca a una sección o
a un rasgo (`capabilities`, `step6Key`, `readEffectiveKeys` fuera del resolvedor). DEC-FAC-033 mete a
experiencia y alojamiento en el catálogo con sus secciones y rasgos, pero dice que su gating «no cambia».
Las dos cosas no pueden ser verdad a la vez.

**Evidencia**:
- Experiencia: `routes/experience/protected/patch.ts:63-68` (`['manage_experience_directions']`) y
  `routes/ai/protected/chat.ts:110-114` (`OWNER_CAPABILITY_KEYS_BY_ENTITY_TYPE`, con el literal de
  experiencia **y** el de gastronomía). El sub-spec 2 (línea 44) declara el rasgo
  `meetingPoint.directions` con esa clave → G-FAC-04 rojo en dos archivos que nadie va a tocar.
- Alojamiento: `routes/accommodation/protected/{addOccupancy:45, removeOccupancy:35, batchOccupancy:47,
  updateOccupancyEvent:48}.ts` (`can_use_calendar`) y `{calendarSync:71, calendarConnectGoogle:92,
  calendarConnectIcal:87}.ts` (`can_sync_external_calendar`). Si la sección `calendar` del catálogo de
  alojamiento declara su clave (lo correcto para que el resolvedor no mienta), siete rutas quedan rojas.
  `utils/entitlement-filter.ts`, `routes/accommodation/public/list.ts` y `getWhatsApp.ts` leen
  `readEffectiveKeys` directo.
- **HOS-1049 no oculta nada**: es un gate por clave de un campo. `directions-projection.ts:46-80` retira
  las indicaciones si el plan no otorga la clave y las devuelve si la otorga;
  `components/listing/editor/listing-edit-data.ts:101-116` las muestra en sólo lectura al dueño bajado.
  Es, byte por byte, la semántica de un rasgo `locked`. El sub-spec 3 (líneas 47-49: «sigue oculto hasta
  que HOS-1049 tenga su reemplazo; no se publica por efecto colateral») y DEC-FAC-033 lo describen como un
  ocultamiento incondicional, que no existe.

**Escenario de falla**: el agente del sub-spec 3 activa G-FAC-04 y CI queda rojo en nueve archivos fuera
de su alcance. Las salidas posibles son todas malas: migrarlos (contradice DEC-FAC-033 y el «sin cambios
visibles»), sumarles una exención que no está contada (el guard ya no prueba lo que dice), o declarar las
secciones de alojamiento y experiencia sin clave (el resolvedor dice `available` donde el plan no otorga:
mentira silenciosa para el primer consumidor futuro).

**Propuesta**:
- Experiencia: **migrarla** a `sectionTraits` en este trabajo. Por lo de arriba, el resultado es idéntico
  (mismo 403, misma proyección), así que no viola «sin cambios visibles»; se prueba con el test de no
  regresión que el sub-spec 3 ya exige. Corregir la descripción de HOS-1049 en DEC-FAC-033 (nueva DEC, no
  reescritura) y en el sub-spec 3.
- Alojamiento: secciones **con** su clave en el catálogo, y G-FAC-04 con una lista **cerrada y contada** de
  archivos de alojamiento exentos hasta el hijo 8 (mismo patrón que G-FAC-08), que el hijo 8 vacía.
- `chat.ts`: la fila del chat de IA del sub-spec 3 (línea 118) ya lo migra para venue; que la migración
  cubra el `Record` entero, no sólo la entrada de venue.

**Decisión del owner**: no (técnica; la corrección de la premisa de DEC-FAC-033 se registra como DEC).

---

### F-V2-C-006 · G-FAC-03(a) se ancla en los valores `food`, `nightlife` y `standard`, que el repo ya usa para otras cosas · ALTA

**Qué está mal**: G-FAC-03(a) prohíbe en `apps/*` y `packages/*` «un literal de valor de rubro del
catálogo en una comparación, `includes`, `switch`, clave de objeto o índice». DEC-FAC-031 eligió valores en
inglés para sacar los choques en español, pero no midió los choques de los valores nuevos.

**Evidencia** (`origin/staging`, excluidos tests y JSON):
- `standard`: `apps/api/src/middlewares/rate-limit.ts:25,58` (`style === 'standard'`),
  `apps/api/src/utils/env-schema.ts:237`, `packages/schemas/src/enums/exchange-rate-type.enum.ts:18`,
  `packages/schemas/src/enums/sponsorship-tier.enum.ts:13`, cuatro archivos de `apps/admin`.
- `nightlife`: dimensión de rating de destino (`apps/web/src/components/destination/destination-rating.ts:21,94`,
  `packages/service-core/src/services/destinationReview/destinationReview.helpers.ts:39`,
  `destinationReview.service.ts:335`) y categoría POI (`packages/icons/src/domain/poi-category.ts:159`).
- `food`: bucket POI (`poi-category.ts:87,157-160`) y **la dimensión de reseña del propio venue**
  (`GastronomyRatingSchema`: food / service / ambiance / value,
  `packages/schemas/src/entities/gastronomy/subtypes/gastronomy.review.schema.ts:12-13,59`). El sub-spec 6
  justamente toca esa dimensión (reseñas opcionales) → `{ food: … }` es «clave de objeto» con el literal.

**Escenario de falla**: G-FAC-03(a) nace rojo en ~15 archivos que no hablan de rubros. Para ponerlo verde
se agrega una lista de exenciones o se angosta el escaneo; desde ahí un `businessLines.includes('food')`
en un archivo exento pasa. Es el mismo caso de G1(b), que se angostó a dos literales por 21 falsos positivos
medidos (`scripts/check-vertical-axis-items.ts:36-43`).

**Propuesta**: no anclar en el texto del valor. Opciones técnicas, en orden: (1) **(Recomendada)** anclar en
el **operando**: el guard busca usos de propiedades/variables tipadas `BusinessLine` (`businessLines`,
`business_lines`, parámetros del tipo) dentro de comparación/`includes`/`switch`/índice, vía el AST de TS
(como ya hacen los guards de `check-listing-clock.ts`); (2) tipo marcado (`BusinessLine` como unión de
`` `bl:${…}` `` o *branded*), que hace imposible comparar contra un literal sin importar la constante del
catálogo, y el guard prohíbe importar esas constantes fuera del resolvedor y del mapa de slugs. Cualquiera
de las dos con su mutación (`listing.businessLines.includes('nightlife')` en un componente → rojo) y su
control negativo (`style === 'standard'` en `rate-limit.ts` → verde).

**Decisión del owner**: no.

---

### F-V2-C-007 · Las secciones de alojamiento y experiencia no están enumeradas en ningún lado: puntero circular · ALTA

**Qué está mal**: el sub-spec 2 (líneas 89-90 y 105-107) dice «lista cerrada que fija el sub-spec 3»; el
sub-spec 3 (línea 45) dice «sus secciones enumeradas (no "todas")» y no las enumera. F-V1-014 se marcó
resuelto, pero el arreglo es un puntero que no apunta a nada.

**Evidencia**: `rg 'capacityPricing|practicalInfo' sub-specs/` sólo encuentra el ejemplo de `meetingPoint`
en el tipo (2-catalogos:31) y la guía de G-FAC-05. La lista real sólo está en el discovery
(`05-discovery-b-superficies.md:28-29`), que la spec misma declara registro de vuelta.

**Escenario de falla**: dos agentes en paralelo (sub-spec 2 y sub-spec 3) re-derivan las listas desde el
código, con nombres distintos (`photos` en alojamiento vs `media` en venue/experiencia,
`accommodation-editor-sections.ts`), y deciden cada uno si llevan clave. Esa decisión es la de F-V2-C-005:
de ella depende si G-FAC-04 queda rojo o el resolvedor miente.

**Propuesta**: tabla cerrada en el sub-spec 2, por vertical: id, `common`, `entitlementKey`, rasgos,
`fields` (F-V2-C-001), orden, grupo. Para alojamiento, los ids son **los mismos** de
`accommodation-editor-sections.ts` (sin renombrar `photos`; eso es del hijo 8), con sus claves reales
(`translations` con su `visibilityKey` actual como clave, `calendar` con `can_use_calendar`, etc.).

**Decisión del owner**: no.

---

### F-V2-C-008 · «El camino ajeno termina en 404 en el paso 4» no es cierto para dos operaciones: el 4b le respondería 409 a un visitante · MEDIA

**Qué está mal**: DEC-FAC-018 y el sub-spec 3 (líneas 76-81) justifican el 409 porque «el camino ajeno ya
termina en 404 en el paso 4». El 4b se define como dependiente sólo de los hechos de la ficha, no del
sujeto.

**Evidencia**: `packages/verticals/src/authorization/listing-operation.ts:84-85`:
`FOREIGN_ADMITTING_STATES.READ_PUBLIC` y `.WRITE_ABOUT_LISTING` admiten `PUBLISHED`. Un ajeno (incluso el
invitado, `resolve-listing-access.ts:96`) pasa el paso 4 en esas dos. Hoy ninguna ruta las usa (`rg
"operation: '(READ_PUBLIC|WRITE_ABOUT_LISTING)'" apps/api/src/routes` → 0), pero la spec obliga a que
«una lectura de una sección `absent` responda como el paso 4b» (sub-spec 3, línea 103).

**Escenario de falla**: alguien pasa la lectura pública de la carta a la cadena con `READ_PUBLIC` (lo
natural para el «lector público único»). Un visitante anónimo pide la carta de un boliche y recibe 409
`ALREADY_EXISTS` con `reason: SECTION_ABSENT` — un 409 «de estado» dirigido a quien no es el dueño, que es
justo lo que la regla 3 del contrato reserva al dueño.

**Propuesta**: el 4b devuelve `SECTION_ABSENT` sólo si el paso 4 resolvió «dueño» (incluida la acción 15,
donde el sujeto es el dueño); para un sujeto ajeno, `NOT_FOUND`. Una línea en el resolvedor y un caso en
el test de matriz. Documentarlo en el contrato junto a la fila nueva.

**Decisión del owner**: no.

---

### F-V2-C-009 · El 4b en el alta no tiene dónde correr, y falta la firma nueva del resolvedor de acceso · MEDIA

**Qué está mal**: el sub-spec 3 (líneas 91-92) dice «en el alta no hay hechos previos: los rubros
resultantes son los del cuerpo». Pero el 4b está definido «inmediatamente después del paso 4», y en
`CREATE` el paso 4 no corre.

**Evidencia**: `resolve-listing-access.ts:125-126` (`CREATE` salta el paso 4 y **lanza** si recibe
`facts`); `middlewares/listing-access.ts:144-147` (en `CREATE`, `facts: null`). La función no recibe hoy ni
secciones pedidas ni rubros; su resultado no tiene la razón `SECTION_ABSENT`, y el `switch` del
middleware es exhaustivo con `never` (`listing-access.ts:262-264`).

**Escenario de falla**: un agente agrega `businessLines` a `ListingAccessFacts` (lo que la spec dice) y
calcula el 4b con `facts.businessLines`. En el alta `facts` es `null`: o el 4b no corre (un alta de
HELADERIA con campos de `nightInfo` los guarda sin pasar por nada) o el agente le pasa hechos al alta y
el resolvedor lanza.

**Propuesta**: fijar en el sub-spec 3 la firma: `resolveListingAccess({ …, sections?: { requested:
readonly { id, intent }[]; resultingBusinessLines: readonly BusinessLine[] } })`, donde
`resultingBusinessLines` lo calcula el middleware (hechos + cuerpo, o sólo cuerpo en `CREATE`); el 4b corre
también en `CREATE`; la razón nueva entra a `ListingAccessResult` y a la tabla del contrato. Así nadie
re-deriva dónde vive el cálculo.

**Decisión del owner**: no.

---

### F-V2-C-010 · La regla tipo ↔ rubros quedó fuera del CHECK, y DEC-FAC-026 promete una garantía que no da · MEDIA

**Qué está mal**: DEC-FAC-026 elige la columna con CHECK porque «la base garantiza la regla donde no se
puede saltear (cargas masivas, seeds, scripts, dos pedidos simultáneos)». Pero el CHECK sólo cubre «no
vacío» y «valores de la vertical»; los permitidos por tipo los aplica el validador (sub-spec 2, líneas
127-129), en el servidor.

**Escenario de falla** (concurrencia): ficha BAR `{food, nightlife}`. Pedido A cambia el tipo a BOLICHE y
los rubros a `{nightlife}` (el editor lo propone, sub-spec 5 línea 52); pedido B, en otra pestaña, deja
rubros `{food}`. Cada uno valida contra la fila que leyó; los dos pasan; la fila queda BOLICHE `{food}`, que
DEC-FAC-034 prohíbe. Como «una ficha vieja nunca bloquea un guardado que no los toca» (sub-spec 2, línea
145), queda así para siempre y aparece en la colección equivocada. Lo mismo con un script que escribe la
columna sin pasar por el servicio.

**Propuesta**: la matriz `allowed` es estática y por vertical: el generador la suma al CHECK
(`CASE type WHEN 'BOLICHE' THEN business_lines <@ ARRAY['nightlife'] … END`). G-FAC-01 ya compara el CHECK
con el catálogo; se extiende a la matriz. El validador sigue existiendo para dar el error tipado antes de
llegar a la base. Bonus: el «test que compara el CASE del backfill con `typeRules`» pasa a ser el mismo
generador.

**Decisión del owner**: no.

---

### F-V2-C-011 · El validador sólo dice «inválido»; la UI necesita «qué se puede elegir», y G-FAC-09 le prohíbe calcularlo · MEDIA

**Qué está mal**: el selector del alta y del admin está «limitado a los permitidos del tipo» y bloquea
«quitar el rubro que deja huérfano al tipo» (sub-spec 5, líneas 40-55; sub-spec 7, líneas 14-17). Con un
`excludes` futuro, las opciones habilitadas dependen de lo ya marcado. `validateBusinessLines` (sub-spec 2,
línea 75) devuelve un error, no un conjunto de opciones. G-FAC-09 pone rojo cualquier comparación de
`businessLines` contra un permitido, máximo o exclusión fuera de `packages/schemas/src/catalog/`.

**Escenario de falla**: el editor y el admin reimplementan `allowed ∩ ¬excluidos(seleccionados) ∧ |s| <
max` cada uno (rojo de G-FAC-09, o exención), o prueban cada combinación contra el validador. El día que se
declare `excludes`, la UI deja marcar algo que el servidor rechaza.

**Propuesta**: segundo helper puro en el mismo módulo: `resolveBusinessLineOptions({ vertical, type,
selected }) → { value, selectable, reason? }[]`, que comparte el código de las reglas con el validador.
Web y admin lo usan; G-FAC-09 lo cuenta en su inventario.

**Decisión del owner**: no.

---

### F-V2-C-012 · La spec misma escribe lógica por rubro y por tipo: «De noche» y «18 para BOLICHE» · MEDIA

**Qué está mal**: la regla 1 («ningún código pregunta por un rubro concreto») choca con dos reglas de
presentación que la spec da en términos de rubros y tipos:
- sub-spec 4, líneas 47-49 y sub-spec 6, línea 26: «en una ficha híbrida (con `food` y `nightlife`) los
  datos van bajo "De noche"; en una ficha sólo `nightlife` no hace falta el título»;
- sub-spec 4, línea 41: «18 sugerido para BOLICHE».

**Escenario de falla**: el agente escribe `businessLines.includes('food') && businessLines.includes('nightlife')`
en la ficha (rojo de G-FAC-03(a), si F-V2-C-006 se arregla; invisible si no), y `type === 'BOLICHE' ? 18 :
null` en el editor. El primer rubro nuevo de alojamiento con una sección «de temporada» copia el patrón.

**Propuesta**: dato en el catálogo. Sección: `headingWhenMultiLineKey?` («si la ficha tiene más de un rubro,
esta sección se titula con esta clave i18n»): genérico, no nombra rubros. Tipo: `typeRules[type].fieldDefaults?:
Partial<UpdateInput>` (p. ej. `{ minAge: 18 }` en BOLICHE), que el editor aplica como sugerencia. Si se
prefiere no sumar atributos, entonces la regla de «De noche» es «más de un rubro» y lo dice la spec.

**Decisión del owner**: no.

---

### F-V2-C-013 · Ids de rasgo y claves de `typeRules` tipados `string`: un error de tipeo se descubre en producción · MEDIA

**Qué está mal**: el sub-spec 2 tipa `SectionTraitDefinition.id: string` (línea 26) y
`BusinessLineRules.typeRules: Record<string, …>` (línea 68); `BusinessLine` es una unión plana de todas las
verticales (línea 50) aunque `ListingSectionId<V>` sí es por vertical. El resolvedor «lanza» ante un id
desconocido (sub-spec 3, línea 39).

**Escenario de falla**: `sectionTraits: ['itemPhoto']` (sin la `s`) en `uploadMenuItemPhoto` compila; el
primer pedido lanza → 500 `INTERNAL_ERROR` al dueño. `typeRules: { BOLICHES: … }` compila y sólo lo agarra
el test de G-FAC-02 regla 5. Un venue con `businessLines: ['standard']` pasa el schema Zod y lo rechaza el
validador como regla de negocio en vez de 400.

**Propuesta**: uniones literales derivadas del catálogo (`SectionTraitId<V, S>`, `BusinessLineValue<V>`,
`Record<ListingTypeOf<V>, …>`), y validación al **arrancar**: `createProtectedRoute` ya se niega a levantar
una ruta que viola el contrato de errores (CLAUDE.md, «API error contract»); que se niegue también a una
ruta que declara una sección o rasgo inexistente. El schema de entrada de cada vertical usa el enum de su
vertical (400 por forma).

**Decisión del owner**: no.

---

### F-V2-C-014 · El catálogo de alojamiento no tiene consumidor y puede divergir en silencio de la lista congelada · MEDIA

**Qué está mal**: alojamiento entra al catálogo (G-FAC-02 regla 8 exige ≥1 sección) pero su editor lee la
lista manual congelada por G-FAC-08, y su público sigue en `entitlement-filter.ts`. Nadie compara catálogo
con lista.

**Escenario de falla**: alguien agrega una sección al catálogo de alojamiento (verde: no hay consumidor) o
el hijo 8 encuentra que el catálogo dice otra cosa que el editor. El hijo 8 arranca reescribiendo el
catálogo, que es el «rehacer» que se quería evitar.

**Propuesta**: G-FAC-08 suma un predicado: el conjunto de ids de secciones de alojamiento del catálogo es
**igual** al de `accommodation-editor-sections.ts` (mismo orden y grupo). Una mutación en cada lado → rojo.

**Decisión del owner**: no.

---

### F-V2-C-015 · El punto de extensión «límite por plan de cantidad de rubros» no tiene contrato y no cubriría todos los caminos · MEDIA

**Qué está mal**: DEC-FAC-026 dice que una regla dependiente del plan sería «una clave de límite leída por
el resolvedor de HOS-1353». Está bien como principio, pero:
- el paso 7 se alimenta de `limit: ({ ctx, listingId, subjectId }) => { key, requested }`
  (`apps/api/src/types/authorization.ts`, campo `limit`): no recibe el cuerpo, que es donde viene la
  cantidad nueva de rubros;
- el paso 7 sólo corre en rutas con `listingAccess`; seed, importaciones y scripts no pasan por ahí, así que
  «todo camino de escritura» (G-FAC-09) no aplica a esa regla;
- no se dice qué pasa al **bajar** de plan con más rubros de los que el nuevo admite (¿`enforcement:
  UNPUBLISH`? ¿se ignoran los sobrantes? ¿se ocultan las secciones del rubro sobrante?).

**Escenario de falla**: el owner pide «básico = 1 rubro» en seis meses. El agente agrega la clave, descubre
que `limit` no ve el cuerpo, lo lee del `ctx`, y decide la bajada de plan por su cuenta. Si elige «ocultar
el segundo rubro», el resolvedor empieza a depender del orden del arreglo, que DEC-FAC-026 declara sin
significado.

**Propuesta**: no implementarlo, pero escribir el contrato en el sub-spec 2: (a) la clave sería un limit de
scope `vertical` evaluado en el paso 7 con `requested = |rubros resultantes|`; (b) `limit` recibe el cuerpo
validado; (c) la bajada de plan nunca toca los rubros (sólo frena agregar); (d) los caminos sin cadena no la
aplican, y eso se dice. Una línea por punto.

**Decisión del owner**: no (es documentar el límite de lo ya decidido).

---

### F-V2-C-016 · Las lecturas de carta, menú del día y eventos no pasan por la cadena: G-FAC-06 obliga a una migración que no está en la spec · MEDIA

**Qué está mal**: G-FAC-06 «cubre lecturas (`getMenu`, `getDailySpecials`, `getEvents`)» y el sub-spec 3
(línea 103) dice que la lectura de una sección `absent` responde como el 4b. Esas rutas hoy no declaran
`listingAccess`.

**Evidencia**: `routes/gastronomy/protected/getMenu.ts:35,59-60`: `createCRUDRoute` y chequeo a mano
`hasViewAll || ownerId === actor.id`. Lo mismo `getDailySpecials.ts`, `getEvents.ts` (sin `listingAccess`,
según `rg -n listingAccess routes/gastronomy/protected`).

**Escenario de falla**: el agente agrega `listingSection` a `getMenu` y no hace nada, porque la sección se
evalúa en el middleware de la cadena que esa ruta no usa; G-FAC-06 queda verde por la declaración. O pasa la
ruta a `READ_OWN`, y el personal con `GASTRONOMY_VIEW_ALL` que hoy la lee pasa a depender de la acción 15
(permiso distinto), cambio que nadie decidió.

**Propuesta**: listar en el sub-spec 3 las tres lecturas como «pasan a la cadena con `READ_OWN`», decir qué
pasa con `VIEW_ALL` (¿acción 15 o se mantiene el atajo?) y coordinarlo con V8 (HOS-1362). G-FAC-06 verifica
que la ruta **use** la cadena, no sólo que declare la sección.

**Decisión del owner**: no (coordinación con V8).

---

### F-V2-C-017 · El orden de los hijos tiene dos dependencias al revés y le falta un bloqueante · MEDIA

**Qué está mal**:
1. El sub-spec 4 depende sólo del 2 (`spec.md:49`), pero su criterio de aceptación es «en las demás, 409
   `SECTION_ABSENT`» (4-tipos-y-noche:69), que es el 4b del sub-spec 3.
2. El sub-spec 2 escribe la matriz y el backfill por tipo con `PUB` y `BOLICHE` (2-catalogos:97-100,
   138-142) y G-FAC-02 regla 5 recorre «todo valor del enum de tipo», pero esos valores nacen en el sub-spec
   4 (con su `ADD VALUE` en migración propia). Es por eso que `typeRules` quedó `Record<string, …>`
   (F-V2-C-013).
3. HOS-1798 (reescribir el bloque de billing del CLAUDE.md) **bloquea el arranque** de HOS-1787 en Linear
   (relación `blocks`, estado Backlog); la spec no lo menciona en `spec.md` ni en el handoff.

**Escenario de falla**: el sub-spec 4 se arranca en paralelo al 3 (la tabla lo permite) y no puede cerrar;
o el 2 mete `PUB` en la matriz antes de que exista y G-FAC-02 se escribe tolerante a tipos inexistentes.
Los agentes de implementación leen el CLAUDE.md viejo de billing (QZPay) como fuente de verdad.

**Propuesta**: (a) el `ADD VALUE` de `PUB`/`BOLICHE` pasa al sub-spec 2 (o el 4 se parte: tipos antes del
2, `nightInfo` después del 3); (b) 4 → depende de 2 **y** 3; (c) agregar HOS-1798 a la tabla de fases como
bloqueante de inicio.

**Decisión del owner**: no.

---

### F-V2-C-018 · El contenido de una sección `absent` queda inalcanzable para su dueño: ni leer, ni borrar, ni exportar · MEDIA

**Qué está mal**: «cambiar de rubro oculta, no borra» (regla 5). Con el 4b sobre lecturas y escrituras, el
dueño que quitó `food` no puede ver ni borrar su carta hasta volver a agregar el rubro. La lista cerrada de
lectores (sub-spec 3, líneas 109-122) no incluye la **exportación** del dueño (`EXPORT`, que el modelo de
HOS-1353 ya tiene, `listing-operation.ts:34-40`) ni la vista previa de purga (`purgePreview.ts`).

**Escenario de falla**: un dueño que cerró la cocina quiere borrar la carta vieja (tiene precios y fotos de
platos) y no puede; pide la exportación y la carta no está (o está, según qué haga el agente: nadie lo
decidió). G-FAC-03(b) no tiene fila para la exportación.

**Propuesta / opciones para el owner**:
1. **(Recomendada)** Mismo trato que `locked` (DEC-FAC-025): el dueño ve un resumen «guardado y oculto» y
   puede **borrar** (intención `delete` de F-V2-C-002 admitida en `absent`); la exportación incluye todo
   lo guardado. Pro: el dueño controla sus datos. Contra: un poco más de UI en el hub.
2. Inalcanzable hasta volver a agregar el rubro; la exportación sí lo incluye. Pro: nada nuevo. Contra: no
   se puede limpiar sin re-agregar el rubro.

**Decisión del owner**: **sí** (roza producto, como DEC-FAC-025).

---

### F-V2-C-019 · Cita vieja: `entitlement-step.ts:263-282` no existe · BAJA

**Evidencia**: sub-spec 3, línea 37. `packages/verticals/src/authorization/entitlement-step.ts` tiene 39
líneas; la regla «valor efectivo > 0» está en `:21-38` (`resolveEntitlementStep`). Además, el resolvedor de
secciones no puede «delegar en el paso 6» tal cual: `resolveEntitlementStep` lee el conjunto efectivo por
llamada; con secciones × rasgos serían N lecturas por ficha y por listado.

**Propuesta**: citar `:21-38` y exponer desde ese módulo un predicado puro `isGranted({ effective, key })`
que usen el paso 6 y el resolvedor de secciones sobre un conjunto efectivo ya leído (una implementación,
una lectura).

---

### F-V2-C-020 · G-FAC-07 mira sólo `packages/payments`; la comparativa «por rubro» no dice dónde se arma · BAJA

**Evidencia**: `scripts/check-billing-verticals-boundary.ts:72-75` (`HALVES.billing = ['packages/payments']`).
DEC-FAC-035 genera la tabla de planes «desde el catálogo, con filas marcadas por rubro»; hoy se arma en el
web (`apps/web/src/components/billing/PlanComparisonTable.astro`, `plan-comparison-table.helpers.ts`)
con datos de `routes/plan-catalog`.

**Escenario de falla**: el agente agrega la marca de rubro en la respuesta de `routes/plan-catalog` (lado
billing del API, raíz de composición exenta de G14): billing pasa a «conocer» rubros (DEC-FAC-003) y
G-FAC-07 sigue verde.

**Propuesta**: el sub-spec 6 dice que el cruce clave → sección → rubro se hace en el web con
`@repo/schemas`; G-FAC-07 suma `apps/api/src/routes/plan-catalog/` y las rutas `billing-*` a su escaneo.

---

### F-V2-C-021 · «Section» ya significa otra cosa en el admin · BAJA

**Evidencia**: `apps/admin/src/features/listing/config/listingSections.ts` (secciones del formulario
consolidado: identidad, operativa), exportado en `features/listing/index.ts:37`; en el web,
`EditorSection` (`apps/web/src/lib/editor/editor-registry.ts:48`) incluye secciones que no son del catálogo
(`seo`, `calendar` de alojamiento). La propiedad nueva de ruta `listingSection` suma un tercer sentido.
`ListingSection`, `SectionTrait`, `BusinessLine`: cero ocurrencias hoy (sin choque).

**Propuesta**: nota de vocabulario en DEC-FAC-031: «sección del catálogo» (`ListingSection`) ≠ «sección
del formulario del admin» ≠ `EditorSection` (presentación). La propiedad de ruta podría llamarse
`contentSection` para que el grep no mezcle. Sin decisión del owner.

---

## Lo que se verificó y está bien

- La acción 15 hereda 4b y 6 sobre el dueño sin código extra: `middlewares/listing-access.ts:148-171`
  fija `subjectId` = dueño para todo ajeno con permiso, en protected **y** admin (el PATCH de admin,
  `routes/gastronomy/admin/patch.ts:30`, pasa por la cadena), y `resolveResourceStep` lo trata como dueño.
  DEC-FAC-019 y la coordinación con V8 del sub-spec 7 son correctas.
- 409 `ALREADY_EXISTS` con `reason` está en la tabla del contrato (`apps/api/docs/error-contract.md:44`)
  y el 4b antes del paso 5 no altera `NO_COVERAGE` (`resolve-listing-access.ts:139-147`).
- La carrera «quitar rubro» vs «escribir sección» es benigna: en el peor caso se guarda contenido oculto,
  que la regla 5 ya admite.
- El CHECK generado sigue un patrón existente (`packages/db/src/schemas/vertical/vertical.dbschema.ts:26-29`,
  `ck_vertical_id` con `quotedList`).

## Key Learnings:

1. HOS-1049 no es un ocultamiento: es un gate por clave de un campo con sólo lectura para el dueño bajado
   (`directions-projection.ts`, `listing-edit-data.ts:101-116`), idéntico a un rasgo `locked`; migrarlo al
   resolvedor no cambia nada visible.
2. `READ_OWN_COMMERCIAL` exige `step6Key` y lanza sin él (`resolve-listing-access.ts:151-153`); quitar el
   `step6Key` de `menuQr` sin cambiar la operación es un 500.
3. El QR de mesa hoy es premium (`menu_qr_scan_metrics` sólo en `gastronomy-premium`); declararlo rasgo
   sin clave lo regala a pro.
4. `menuUrl` es la parte gratis de la carta y vive en la sección `price` del editor; el modelo «una
   sección = cero o una clave» no puede representar una sección con partes gratis y pagas.
5. El mapa sección → campos existe sólo en el web (`listing-section-payload.ts`); es la pieza que falta en
   el catálogo para que detección del PATCH, proyección pública y editor salgan de un solo lugar.
6. Los valores `food`, `nightlife` y `standard` ya existen en el repo con otro sentido (POI, rating de
   destino, reseña del venue, rate limit, sponsorship): un guard anclado en el texto del valor nace rojo.
7. `FOREIGN_ADMITTING_STATES` admite `PUBLISHED` para `READ_PUBLIC` y `WRITE_ABOUT_LISTING`: no todo
   camino ajeno muere en el paso 4.
8. HOS-1798 bloquea el arranque de HOS-1787 en Linear y la spec no lo registra.
