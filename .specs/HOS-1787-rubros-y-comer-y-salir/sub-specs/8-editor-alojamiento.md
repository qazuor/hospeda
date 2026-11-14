---
title: Sub-spec 8 · Editor de alojamiento al catálogo de secciones y listas exentas en cero
linear: HOS-1809 (hijo de HOS-1787)
statusSource: linear
created: 2026-11-14
status: approved
revised: 2026-11-14 (decisiones del owner Q-1, Q-2, Q-3)
type: refactor
areas:
  - api
  - web
parent: HOS-1787
blockedBy:
  - HOS-1803
smokeGates:
  - status-needs-smoke-staging
---

# 8 · Editor de alojamiento al catálogo de secciones

> **Estado**: aprobada por el owner (14/11/2026); decisiones en la sección final. Verificado contra `origin/staging` (HEAD `bc2abd8c26`, 2026-11-14).
> Hijo 8 de HOS-1787 (etapa `post_v1`, DEC-FAC-082). Bloqueado por HOS-1803 (resolvedor, hijo 3), que ya está en `staging`.
> Esta spec **no vuelve a decidir** lo que HOS-1787 ya decidió (§2). Lo que estaba abierto (Q-1 a Q-3) lo resolvió el owner el 14/11/2026 (sección final).

## 1. Problema

Después de HOS-1787, alojamiento es la **única vertical con la lista de secciones escrita a mano**: venue y experiencia derivan la suya del catálogo (`LISTING_SECTIONS`) y del resolvedor. Hoy:

- El editor de alojamiento usa `ACCOMMODATION_EDITOR_SECTIONS` (`apps/web/src/lib/editor/accommodation-editor-sections.ts:51-127`, 11 secciones), **congelada** por el guard G-FAC-08 (`scripts/check-accommodation-editor-frozen.ts`, inventario `scripts/guards/accommodation-editor-sections.json`, paso de CI `ci.yml:338-341`).
- Alojamiento está en el catálogo con claves reales sólo para que el resolvedor «no mienta» (`packages/schemas/src/catalog/listing-sections.ts:263-382`), pero **ninguna superficie lo lee**. No hay `GET /api/v1/protected/accommodations/:id/sections` (existen sólo `routes/venue/protected/sectionStates.ts` y el de experiencia), y el proyector público sólo admite `venue | experience` (`apps/api/src/utils/public-listing-projector.ts:19`).
- El gating por **campo** (descripción enriquecida, video, insignia) vive en un archivo propio, `apps/api/src/utils/entitlement-filter.ts`, fuera del resolvedor.
- Hay una **lista cerrada y contada de 10 archivos exentos** de G-FAC-04 que escriben claves de sección como literales (`scripts/check-no-section-key-literals.ts:8-19`, inventario `scripts/section-key-literal-inventory.json`, `MIN_FILES = 10`).

**Nota sobre el nombre del issue**: HOS-1809 habla de «la lista exenta de G-FAC-08». Hay **dos guards distintos** en juego y los dos se cierran acá:

| Guard | Qué congela | Cómo se cierra |
|---|---|---|
| G-FAC-08 | la lista manual de 11 secciones del editor | el guard se **elimina** (su header dice «until the child 8 migration replaces this guard», `check-accommodation-editor-frozen.ts:1-22`) y sus archivos entran a G-FAC-05 |
| G-FAC-04 | los 10 archivos exentos de usar literales de clave | la lista de exentos queda **vacía** (`ALLOWED_EXEMPTIONS = []`, `inventory.count = 0`) |

## 2. Lo que HOS-1787 ya decidió (no se reabre)

Del decision log (`.specs/HOS-1787-rubros-y-comer-y-salir/docs/01-decision-log.md`), sub-specs 2, 3 y 5, y `docs/06-guards.md`:

| Decisión | Qué dice | Dónde |
|---|---|---|
| DEC-FAC-033 | Alojamiento entra al catálogo con rubro `standard` **sin cambios visibles**; su editor queda congelado y su migración es el hijo 8 | log :477-491 |
| DEC-FAC-049 | Alojamiento declara claves en el catálogo; G-FAC-04 lleva la lista cerrada de exentos (las 7 rutas de calendario/ocupación, `entitlement-filter.ts`, `public/list.ts`, `getWhatsApp.ts`) y **el hijo 8 la vacía**. Aclara que el gating público por campo «son rasgos de campo, no secciones» | log :685-697; sub-spec 3 :178 |
| DEC-FAC-082 | HOS-1809 es `post_v1` | log :1075 |
| Sub-spec 2 :155-160 | Las claves de campo de alojamiento (video, descripción enriquecida, insignia) «son del hijo 8». El renombrado de `photos` también «es del hijo 8» (:123) | `2-catalogos.md` |
| G-FAC-08 (`06-guards.md:258-271`) | El guard lo reemplaza **G-FAC-05 extendido**; el catálogo de alojamiento ya es igual a la lista manual (mismo orden y grupo) para que el hijo 8 no empiece reescribiendo el catálogo | `06-guards.md` |
| Sub-spec 3 :60-70, 3 «Alojamiento» | El resolvedor gobierna **secciones**; los **rasgos de campo** de alojamiento hay que modelarlos | `3-resolvedor.md` |

Estado real de los guards en `staging`: **G-FAC-05 ya existe** (`scripts/check-no-listing-dispatch.ts`, lista cerrada `scripts/guards/no-listing-dispatch-files.json`, `ci.yml:342-346`) y hoy **no incluye ningún archivo de alojamiento**. G-FAC-06 (`scripts/check-content-routes-declare-section.ts`) sólo escanea `routes/venue/{protected,admin}`; su inventario no tiene ninguna ruta de alojamiento.

## 3. Alcance

### Dentro

1. **Editor**: derivar la lista de secciones del editor de alojamiento del catálogo + resolvedor, igual que `listing-editor-registry.ts` (`buildListingEditorSections`, :48-73) hace con venue y experiencia.
2. **API**: `GET /api/v1/protected/accommodations/:id/sections` (mapa de estados `absent | locked | available`, con rasgos), espejo de `venue/protected/sectionStates.ts`.
3. **Gating por campo → rasgos del catálogo**: descripción enriquecida, video (y su gemelo en `description`), insignia de verificación. Reemplaza `resolvePublicFieldGrants` / `filterPublicPaidFields` (`entitlement-filter.ts:16-64,173-204`) por el proyector.
4. **Rutas de alojamiento que declaran su sección** (extender G-FAC-06) en lugar de literales: las 7 rutas de calendario/ocupación y `getWhatsApp.ts`, `public/list.ts`.
5. **Guards**: vaciar la lista de exentos de G-FAC-04; eliminar G-FAC-08 (script, inventario, paso de CI, script de `package.json`, tests) y sumar los archivos de alojamiento a `no-listing-dispatch-files.json`; extender G-FAC-06 a alojamiento.
6. **Tests de no regresión** del público (golden, §9) y smoke propio.

### Fuera

- El `Record` de claves por vertical de `routes/ai/protected/chat.ts`: ya lo migra HOS-1787 completo (DEC-FAC-049, G-FAC-04 lo cubre hoy).
- Rubros distintos de `standard` para alojamiento (no hay; `BUSINESS_LINES.accommodation` tiene un solo valor, y la columna ya existe con `CHECK`: `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:48-56,168-176`).
- El **flag viewer-gated de WhatsApp** (`CAN_CONTACT_WHATSAPP_DISPLAY`): es una capacidad del **turista que mira**, no del dueño ni de una sección; `getWhatsApp.ts` sólo sale de la lista de exentos si se resuelve (ver Q-2).
- Cambiar planes, claves o precios; el aviso de bajada de plan para alojamiento (HOS-1787 5.5, post-MVP).
- Las páginas web-only «Preguntas a la IA» (`ACCOMMODATION_AI_QUESTIONS_SECTION`, `accommodation-editor-sections.ts:152-157`) y «Políticas» (`ACCOMMODATION_POLICIES_SECTION`, :173-178): no son secciones del catálogo (el propio comentario lo dice: «NOT in ACCOMMODATION_EDITOR_SECTIONS»). Siguen siendo páginas del registro, igual que `LISTING_AI_QUESTIONS_SECTION` en venue/experiencia (`listing-editor-registry.ts:81-86`).

## 4. Modelo de datos

**Ningún cambio estructural ni de datos esperado.** `accommodations.business_lines` ya existe (`NOT NULL`, `CHECK` y índice GIN, `accommodation.dbschema.ts:48-56,168-176`), y las claves que usan los rasgos ya están en el catálogo (`can_use_rich_description`, `can_embed_video`, `has_verification_badge`, `can_use_calendar`, `can_sync_external_calendar`; `entitlement-filter.ts:16-21` y `listing-sections.ts:352-361`). El catálogo es **código** (`packages/schemas/src/catalog/`).

Si durante la implementación se descubre que falta una clave: carril estructural + SQL generado (`scripts/check-catalog-sql.ts`, G18) y `check-catalog-key-usage` (G3); no se escribe SQL a mano.

El único cambio en `packages/schemas` es en `listing-sections.ts`: **rasgos nuevos** en las secciones de alojamiento, con `fields` y `entitlementKey`:

| Sección | Rasgo nuevo | Clave | Campos que retira si está `locked` |
|---|---|---|---|
| `basicInfo` | `richDescription` | `can_use_rich_description` | `richDescription`, `richDescriptionI18n` (**siempre juntos**, ver `entitlement-filter.ts:112-168`) |
| `photos` | `videos` | `can_embed_video` | `videos`, `media.videos` |
| (insignia) | `verification` (Q-1 = 1) | `has_verification_badge` | `isVerified` → `false` |

Hoy `richDescription` está en `basicInfo.fields` y `videos` en `photos.fields` sin clave (`listing-sections.ts:270-289,314-317`); sin el rasgo, el proyector **no** los quitaría. Moverlos a un rasgo es el cambio central, y G-FAC-08 (que compara ids de sección, no campos) no lo ve: por eso el test dorado del §9 es obligatorio.

## 5. API

Tres capas (`apps/api/docs/route-architecture.md`), orden del contrato de errores (401 → 403 → 400 → 404 → reglas; `apps/api/docs/error-contract.md`), permisos por `PermissionEnum`, nunca por rol.

| Tier | Ruta | Cambio |
|---|---|---|
| Protected | `GET /api/v1/protected/accommodations/:id/sections` | **Nueva.** Misma forma que venue/experiencia (`VenueListingSectionStatesSchema` → un `AccommodationListingSectionStatesSchema` en `@repo/schemas`). `listingAccess: { vertical: ACCOMMODATION, operation: 'READ_OWN', idParam: 'id' }`, `emailUnverifiedOperation: 'READ_OWN'`. Ficha ajena o inexistente → **404** (nunca 403). `id` no-UUID → 400 antes de tocar la base |
| Public | `GET /api/v1/public/accommodations*` (`getById`, `getBySlug`, `list`, `similar`, `getByDestination`, `getTopRatedByDestination`), `destination/public/getAccommodations`, `feature/public/getAccommodationsByFeature`, `user/public/getAccommodations` | Pasan de `filterPublicPaidFieldsForOwner(item, grants)` a `projectPublicListings`, extendido a `accommodation`. **Mismo cuerpo de respuesta** (criterio 1) |
| Protected | `getById`, `list`, `patch`, `update`, `create`, `createDraft`, `publish`, `reactivate`, `unpublish` | Hoy usan `stripRichDescriptionFields` (9 sitios). Quedan como están salvo que el rasgo `richDescription` los absorba; no se tocan en esta spec si no hace falta |
| Protected | las 7 rutas de ocupación/calendario | Reemplazan `listingAccess.capabilities: ['can_use_calendar']` / `['can_sync_external_calendar']` por la **declaración de sección** (`calendar`, intent `write`/`dynamic-write-delete`/`read`), como `venue/protected/putMenu.ts` en el inventario de G-FAC-06 |

Notas técnicas que el implementador debe respetar:

- Las respuestas públicas están **cacheadas sin auth en la clave** (`entitlement-filter.ts:4-9`): el estado se calcula por el **dueño de la ficha**, nunca por quien mira. El proyector ya lo hace así para venue (`public-listing-projector.ts`); no introducir nada derivado del espectador.
- `stripVideoEmbeds` sobre `description` (`entitlement-filter.ts:181-183`, `apps/api/src/lib/content-detection.ts`) **no es una remoción de campo**: transforma texto. El proyector no la expresa; queda como paso explícito posterior al proyector, con su test.
- El proyector hoy resuelve por `ownerId` con el conjunto efectivo (`rehydrateEffectiveSet`); para alojamiento se verifica que el resultado coincide con `readEffectiveKeys` (`utils/listing-access/user-gate`) caso por caso (criterio 2).
- Una consulta N+1 en listados: `resolvePublicFieldGrants` ya agrupa por dueño distinto (`:39-64`); el proyector debe conservar esa propiedad.

## 6. UI

- **Web (CSS Modules, no Tailwind)**: `accommodation-editor-sections.ts` deja de exportar una lista estática y pasa a un `buildAccommodationEditorSections({ sectionStates })` que usa `LISTING_SECTIONS.accommodation` + `LISTING_SECTION_PRESENTATION` (extender el `Record` de presentación con `accommodation`). Se conserva el mecanismo `visibilityKey` de `translations` (`ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY`, :37) porque no es dispatch por vertical y el registro compartido ya lo soporta.
- **Estados de sección** (comportamiento ya definido para venue en HOS-1787 leaf 5.2): `absent` no aparece; `locked` aparece con el tratamiento de upsell; `available` normal. Para alojamiento `absent` no ocurre nunca (rubro `standard` ofrece todas las secciones).
- Los archivos de alojamiento de G-FAC-05 (la lista que hoy no los incluye) pierden toda comparación contra un literal de vertical, id de sección o tipo: el registro, el hub (`.../propiedades/[id]/editar/index.astro`), `resolve-editor-page.ts`, `use-accommodation-section-form.ts` y `EditorSectionLayout.astro` (los que hoy importan `accommodation-editor-sections`).
- **Admin (Tailwind)**: sin cambios previstos (su config consolidada de alojamiento usa `entitlementKey` por campo, p. ej. `basic-info.consolidated.ts:98`, `gallery.consolidated.ts:58`, y no está en esta migración; si G-FAC-05 la pidiera, se abre issue aparte).

## 7. i18n (es / en / pt)

- Se reutilizan las etiquetas de sección existentes `host.properties.editor.section.*` (`es/host.json`). Si `photos` se renombra (Q-3), sólo cambia el **id** interno; la etiqueta y el slug de URL `fotos` se mantienen, así que **no hay clave nueva ni ruta nueva**.
- El upsell de sección `locked` reutiliza las claves ya creadas para venue/experiencia (HOS-1787 leaf 5.2); si alguna es específica de vertical, se agrega su equivalente en **es, en y pt**.
- Test existente que resuelve cada clave contra el JSON real (`accommodation-editor-sections.test.ts`) se conserva.

## 8. Cambios visibles al público

Lista completa. La meta es **cero diferencias de payload salvo donde se indique**; cada fila tiene un test dorado.

| # | Qué ve hoy el público | Después de migrar | ¿Cambia? |
|---|---|---|---|
| V-1 | Descripción enriquecida (`richDescription` + `richDescriptionI18n`): visible sólo si el dueño tiene `can_use_rich_description` | Rasgo `richDescription` de `basicInfo`; mismo resultado | No (debe ser idéntico) |
| V-2 | Video: `videos`, `media.videos` y URLs de video **dentro de `description`** quitados si falta `can_embed_video` | Rasgo `videos` de `photos` para los campos; el texto de `description` lo sigue limpiando `stripVideoEmbeds` | No (debe ser idéntico) |
| V-3 | Insignia: `isVerified` forzado a `false` si falta `has_verification_badge` | Rasgo `verification` de `basicInfo` (Q-1 = 1); mismo resultado | No (debe ser idéntico) |
| V-4 | `contactInfo.whatsapp` nunca sale en la respuesta cacheada; sólo `hasWhatsapp` | Sin cambios; se conserva el paso aparte | No |
| V-5 | Ocupación/calendario público: `GET /public/accommodations/:id/occupancy` **no tiene gate de entitlement** (`routes/accommodation/public/getOccupancy.ts:10`) | Si el proyector tratara `calendar` como sección y la ocultara cuando está `locked`, el público **dejaría de ver** la disponibilidad de dueños sin `can_use_calendar` | No (Q-2 = 1: la lectura pública no se proyecta por la sección) |
| V-6 | `hasAiChat` (`public/list.ts:~248`) sale de la clave `ai_chat` | Sin cambios: el chat es una capacidad, no una sección | No |
| V-7 | Orden y agrupación de secciones en el editor del dueño (no público) | Igual: el catálogo y la lista manual son iguales por G-FAC-08 | No |

Cambios visibles **al dueño** (no al público): una sección con clave no concedida (`calendar` sin `can_use_calendar`) pasa de «página con su propio gate» a «sección `locked` con upsell», el mismo tratamiento que venue/experiencia. Es un cambio de presentación consistente con HOS-1787; se lista acá para el smoke.

## 9. Criterios de aceptación

1. **Dorado de respuestas públicas**: para cada rasgo (V-1, V-2, V-3, V-4) y cada combinación de claves {con, sin} del dueño, el JSON de `getById`, `getBySlug`, `list`, `similar`, `getByDestination`, `getTopRatedByDestination`, `destination/getAccommodations`, `feature/getAccommodationsByFeature` y `user/getAccommodations` es **byte a byte** igual antes y después (los fixtures se capturan sobre `staging` ANTES de migrar y se commitean).
2. Para cada dueño del test, `projectPublicListing` con `accommodation` produce el mismo recorte que `filterPublicPaidFields` (propiedad: ambos implementados en paralelo en el PR intermedio y comparados).
3. `GET /protected/accommodations/:id/sections`: 200 para el dueño con el mapa completo de 11 secciones; 404 para ficha ajena y para inexistente; 400 para id no-UUID; 401 sin sesión.
4. El editor de alojamiento muestra las mismas secciones, en el mismo orden y grupos, que la lista manual de hoy (11 + Políticas + Preguntas a la IA), derivadas del catálogo.
5. `ALLOWED_EXEMPTIONS` de G-FAC-04 queda vacío, `section-key-literal-inventory.json` con `count: 0`, y `pnpm check:no-section-key-literals` verde sin ninguna exención.
6. G-FAC-08 eliminado por completo (script, inventario JSON, test, paso de `ci.yml`, script de `package.json`), y los archivos de alojamiento que importan el registro están en `no-listing-dispatch-files.json` y verdes.
7. G-FAC-06 escanea `routes/accommodation` y su inventario lista las rutas de calendario/ocupación con `section: "calendar"`.
8. Un dueño sin `can_use_calendar` recibe de las rutas de ocupación **el mismo código y cuerpo** que hoy (`ENTITLEMENT_REQUIRED` 403) para `addOccupancy`, `batchOccupancy`, `removeOccupancy`, `updateOccupancyEvent`; y sin `can_sync_external_calendar`, para `calendarSync`, `calendarConnectGoogle`, `calendarConnectIcal`.
9. V-5: la lectura pública de ocupación sigue visible aunque el dueño no tenga `can_use_calendar` (Q-2 = 1), fijado con un test.
10. Los rasgos mueven los campos a **un solo lugar**: `entitlement-filter.ts` ya no define `PUBLIC_FIELD_KEYS` con literales de las claves de campo (la lista de G-FAC-04 está vacía).
11. Todos los textos nuevos existen en es, en y pt.

## 10. Tests

- **Golden / caracterización** (lo más importante): `apps/api/test/golden/accommodation-public-fields/` con la matriz de claves del criterio 1, capturada **antes** del cambio.
- **Unit**: `projectPublicListing` con `accommodation` por rasgo (`richDescription` quita los dos campos juntos; `videos` quita ambos; sección `locked` quita sus campos); `buildAccommodationEditorSections`.
- **Integración API**: `/sections` (200/404/400/401), rutas de ocupación con y sin clave, público con y sin clave del dueño.
- **Guards**: tests de `check-no-section-key-literals` con inventario vacío, de `check-no-listing-dispatch` con los archivos de alojamiento, y de G-FAC-06 con el inventario nuevo; **control negativo** de cada uno (reintroducir un literal de clave de sección en `addOccupancy.ts` debe romper G-FAC-04).
- **Web**: `accommodation-editor-sections.test.ts` (reescrito para la lista derivada), nav/hub/breadcrumbs (`editor-route-nav-model.test.ts`, `editor-hub-status-model.test.ts`) sin regresión.
- Correr siempre con `CI=true` y sólo los paquetes tocados.

## 11. Smoke

Label: **`status-needs-smoke-staging`** (el propio issue dice «cambia lo que ve el público… necesita su propio smoke»). Hace falta entorno real porque las claves salen del conjunto efectivo (plan real vía el sandbox de MercadoPago).

Matriz mínima: un dueño por combinación de {rich description, video, insignia, calendario, sync externo} con y sin la clave, **comparando la ficha pública y el editor antes y después del deploy**:

1. Ficha pública (es/en/pt): descripción enriquecida, video, insignia y WhatsApp iguales a la captura previa.
2. Editor del dueño: las 11 secciones + Políticas + Preguntas a la IA, mismo orden; `calendar` `locked` con upsell para quien no tiene la clave.
3. Disponibilidad pública (V-5) según Q-2.
4. Listados de destino, de rasgo y del dueño (los 9 lectores públicos) sin diferencia.
5. What's New: decisión del owner (en principio no es una novedad para el dueño).

## 12. Riesgos

- **R-1 Regresión silenciosa del público.** Ningún guard compara payloads; sólo el dorado del criterio 1 lo cubre. Capturarlo **antes** de tocar nada.
- **R-2 `richDescription` e `richDescriptionI18n` separados.** Quitar uno solo equivale a no quitar ninguno (el web resuelve el idioma desde el i18n; `entitlement-filter.ts:131-134`). Ambos van en el mismo rasgo.
- **R-3 El proyector no hace transformaciones de texto.** Si se pierde `stripVideoEmbeds`, un dueño sin plan de video vuelve a mostrar videos incrustados en la descripción (V-2).
- **R-4 Cache compartida.** Cualquier estado derivado del espectador se replica a todos (HOS-19, HOS-353).
- **R-5 Fail-open del filtro.** El filtro actual es fail-open ante un throw (`entitlement-filter.ts:240-254`): un error al resolver publica campos premium. El proyector debe fallar **cerrado** (o igual de abierto, pero entonces dejarlo documentado y testeado); decidirlo en la tarea.
- **R-6 Se corre el resolvedor por ficha en listados largos.** Mantener el agrupado por dueño.
- **R-7 Orden de PRs.** El dorado y el proyector extendido deben entrar **antes** de borrar el filtro viejo; el borrado de G-FAC-08 y el vaciado de G-FAC-04 son el último PR.
- **R-8 Etapa.** Está en `post_v1`: si el lanzamiento v1 sale antes, el editor de alojamiento queda como única isla escrita a mano, con su guard congelado. Es el estado actual y es estable.

## Decisiones del owner (14/11/2026)

Finales; no se reabren.

- **Q-1 = 1**: `has_verification_badge` pasa a ser un **rasgo de `basicInfo`** (`verification`, campo `isVerified`). La lista de exentos de G-FAC-04 llega a cero. Se verifica que ningún test de `fields` (regla 11 de G-FAC-02) exija que el campo sea editable.
- **Q-2 = 1**: la disponibilidad pública se mantiene visible aunque el dueño no tenga calendario. La sección `calendar` sólo gobierna la escritura del dueño y el editor; la lectura pública de ocupación no se proyecta por la sección, así que el público no ve ningún cambio. La asimetría se documenta y se fija con un test.
- **Q-3 = 1**: **no** se renombra `photos`. Se conserva el id interno.

## Plan de PRs

Orden por R-7; sólo el último lleva `Closes HOS-1809`, los intermedios no llevan magic word.

1. **Dorado** de respuestas públicas, capturado antes de migrar (sin cambio de comportamiento).
2. **Rasgos de catálogo + proyector** extendido a `accommodation` + endpoint `/sections`, en paralelo al filtro viejo (criterio 2).
3. **Rutas públicas** pasan al proyector; borrado de `entitlement-filter.ts`.
4. **Editor web** derivado del catálogo; rutas de calendario declaran sección.
5. **Guards**: vaciar G-FAC-04, eliminar G-FAC-08, G-FAC-05/06 extendidos (último PR).
