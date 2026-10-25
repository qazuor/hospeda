---
title: Sub-spec 1 · Renombrado gastronomy → venue
linear: HOS-1787 (hijo pendiente de crear)
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (respuestas del owner a la vuelta 2)
---

# 1 · Renombrado `gastronomy` → `venue`

**Bloquea a todos los demás hijos y es bloqueante del corte V6 de HOS-1352.** Base:
[discovery A](../docs/05-discovery-a-renombrado.md). Decisiones: DEC-FAC-016, 027, 028, 029, 030, 031, 032.
Hallazgos `F-V1-NNN` en `../docs/10-revision-vuelta-1/00-consolidado.md` y `F-V2-NNN` en
`../docs/12-revision-vuelta-2/00-consolidado.md`; DEC-FAC-044, 045, 054 de la vuelta 2; DEC-FAC-060 (cinco
migraciones editadas), 061 (marcha atrás) y 068 (textos y tile de la home) de las respuestas del owner.

## Objetivo

Que la vertical deje de llamarse `gastronomy`/Gastronomía en todo lo que es la vertical: código, base,
valores persistidos, API, web, admin, i18n, docs, guards, inventarios, fixtures, carpetas de Cloudinary,
cache tags, analítica. Público «Comer y salir» (`/comer-y-salir/`); interno `venue`. El borde exacto de lo
que **no** se renombra está en «Qué se conserva» (DEC-FAC-032).

## Compuerta: el corte V6 de HOS-1352 (DEC-FAC-028)

**Prod no es staging.** `origin/main` termina en la migración `0124`: no tiene `vertical`,
`catalog_key`, `plan*`, `subscription`, `trial`, `domain_event` ni `email_outbox`, y sí tiene
`gastronomies` y `qr_codes`. Staging va por la `0178` (la de renombrado será la `0179` o posterior). El paso 6
del corte genera `0000_baseline.sql`, reescribe los ledgers y borra los módulos de data-migration.

**Prod no recibe el renombrado «por el baseline»: lo ejecuta** (F-V2-003). En el paso 3 del corte, `hops
db-migrate --pull` aplica sobre prod (0124) la cadena 0125…0178 **y** la migración de renombrado, en una sola
transacción (`0126_cool_captain_flint.sql:10`), sobre datos y **extras de la era 0124 ya aplicados**; recién el
paso 6 toma la foto. Con staging reseteado, prod es el único ambiente donde el renombrado corre sobre esa
historia: por eso el criterio de aceptación es un ensayo de ese paso sobre un clon de prod-main.

El renombrado entra **entero** a staging **antes** de ejecutar V6 y es un **bloqueante del corte**. Regla
fija: **el corte nunca cae entre dos PRs del renombrado** (el baseline quedaría semi-renombrado). Por eso
no hay mecánica «después del corte»: no hace falta enseñar a G18 a aceptar renombres, ni apagar los
triggers de `extras/041`, ni mantener alias de ids ni un lector del nombre viejo de `domain_event`.
Prod casi no tiene datos de la vertical (el owner confirma que no hay fichas reales, DEC-FAC-027).

## Partición y despliegue (DEC-FAC-030)

**Etapa A · renombrado lógico (varios PRs).** Nombres en el código, carpetas y tipos (`Gastronomy*` →
`Venue*`, `GastronomyVenueEvents*` → `VenueEvents*`, hooks, componentes, namespace i18n), con los
identificadores que tocan base o contratos todavía **apuntando a lo viejo** (`pgTable('gastronomies', …)`,
valores de enum, rutas, URLs). Sin migración ni cambio de contrato; cada PR deja staging sano. Un guard
temporal de frontera (lista de los literales viejos que quedan) baja a cero al cerrar la etapa B.

**Etapa B · renombrado físico (UN PR atómico).** Migración física, valores persistidos, contratos de API
(`/api/v1/*/venues`), URLs y redirects, edición de 0129/0144/0176 (DEC-FAC-029) y reset de staging.

**Ventana de mantenimiento en staging, orden fijo**:
1. cancelar las preapprovals huérfanas del sandbox de MercadoPago (antes de perder el ancla local);
2. bajar web y admin;
3. **apagar la API vieja**: contenedor, crons (`HOSPEDA_CRON_ADAPTER`) y webhook, verificado (F-V2-019). Entre el
   reset y el deploy, la API vieja sirve 500 sobre una base sin `gastronomies` y sus crons escriben valores
   viejos (`quota_window`, `domain_event`, `email_outbox`) que el código nuevo no lee;
4. resetear `hospeda_dev` **antes** de reconstruir la plantilla (`hospeda_template`), la base de staging y las
   bases de worktree (F-V2-043); migrar con `--pull` sobre el **commit de la imagen nueva**, verificando la
   igualdad de commit (como el paso 3 del corte);
5. desplegar la API (crons y webhook vuelven con ella);
6. desplegar web y admin; purgar cache y actualizar reglas de Cloudflare (paso 7 de «Mecánica»).

**Redirects**: 302 (temporales) en staging y prod mientras dura el soak; 301 con un cambio explícito
después (un 301 queda grabado en los navegadores y no se deshace). **Marcha atrás** (DEC-FAC-061, Q-12): **no hay migración inversa** (no puede deshacer el catálogo nacido `venue`:
triggers de `extras/041`, G18, FK compuestas, y Drizzle sólo va hacia adelante). En **staging**, volver atrás es
revertir el PR físico y hacer **otro reset** (la misma ventana, en sentido inverso). En **prod**, es la marcha atrás
del corte V6: restaurar el backup completo del **paso 2b**. Se conserva la lista escrita de lo que no vuelve solo:
historial y correos ya enviados, índices de buscadores, redirects ya cacheados por navegadores, y cache de Cloudflare
(se purga a mano).
**En prod** la etapa B viaja en la ventana del corte, que ya es sin convivencia.

## Mapa de nombres (final)

| hoy | nuevo | dónde |
|---|---|---|
| `gastronomy` / `Gastronomy` / `GASTRONOMY` | `venue` / `Venue` / `VENUE` | identificadores, `VerticalEnum`, `ProductDomainEnum`, `EntityTypeEnum`, `permission_category_enum` |
| `gastronomies` | `venues` | tablas, rutas API (`/api/v1/*/venues`), hooks |
| `gastronomy_<x>` | `venue_<x>` | tablas hijas, enums Postgres, índices, FKs, constraints, secuencias; `gastronomy_id` → `venue_id` |
| `r_gastronomy_amenity/feature` | `r_venue_amenity/feature` | |
| `GastronomyTypeEnum` | `VenueTypeEnum` | tipo descriptivo |
| `GASTRONOMY_OWNER` | `VENUE_OWNER` | `role_enum`, `r_user_role`, `role_permission`, `user_role_audit`, tours, mobile |
| `gastronomy.<perm>` (7) | `venue.<perm>` | `permission_enum`, filas de permisos |
| `publish_gastronomy`, `edit_gastronomy_info`, `manage_gastronomy_*`, `multilingual_gastronomy_menu` | `publish_venue`, `edit_venue_info`, `manage_venue_*`, `multilingual_venue_menu` | catálogo de claves; nacen así por la edición de 0144 (DEC-FAC-029) |
| `max_gastronomies`, `max_ai_chat_gastronomy_per_month` | `max_venues`, `max_ai_chat_venue_per_month` | limit keys; ídem |
| `gastronomy-basico/pro/premium` y planes de rol | `venue-basico/pro/premium` y planes de rol con el mismo prefijo | 0129/0144, `scripts/production-catalog/catalog.ts` |
| `extra-gastronomies-1`, `visibility-boost-gastronomy-7d/30d` | `extra-venues-1`, `visibility-boost-venue-7d/30d` | 0176 |
| `plan.name` y títulos visibles en MP («Gastronomía Básico», «Gastronomy Trial», «Extra Gastronomy Listing») | «Comer y salir Básico» y equivalentes | catálogo, resumen de tarjeta de MP |
| `chat_gastronomy` | `chat_venue` | `ai_settings`, `ai_usage` |
| `GastronomyVenueEvents*` | `VenueEvents*` (nunca `VenueVenue…`) | la sección `venueEvents`, `sports_venue` (tipo de POI) y `venueName` (lugar de un evento municipal) **no se tocan** |
| namespace i18n `gastronomy` | `venue` | `packages/i18n` + `config.shared.ts` + `check-locales.ts` |
| `/gastronomia/…`, `/planes/gastronomia/…`, `/presentacion/gastronomia/`, `/publicar/gastronomia/` | `/comer-y-salir/…` (ídem) | páginas web, SEO, sitemap |
| `publicar-restaurante` | `PUBLISH_PAGE_PATH_BY_VERTICAL.venue` (`/publicar/comer-y-salir/`) | la página ya redirige 301 (`publicar-restaurante/index.astro:36-42`) y lo sigue haciendo, directo al destino nuevo; quien tenga en caché el 301 viejo da dos saltos, aceptado (F-V2-053) |
| `mi-cuenta/comercio/gastronomy/…` | `mi-cuenta/comercio/venue/…` | segmento `[vertical]` |
| cache tags `gastro-<slug>`, `list-gastro` y clases CSS `gastro-*` | prefijo `venue-` (verificar colisión con clases y tags existentes en la tarea) | `packages/cache-tags/src/vocabulary.ts`, CSS; se purgan en el deploy |
| propiedad PostHog `is_gastronomy_owner` | `is_venue_owner` | `packages/analytics/src/shared.ts` |
| ids de What's New (3, incluidos los publicados) y del tour (`web.gastronomy.welcome`, paso `gastronomy-qr`) | ids `venue`; tour `web.venue.welcome`, paso `venue-qr` (único lugar donde se fija el id) | **nadie vuelve a ver la entrada**: data-migration de seen-ids encadenada a la `0109`, con su mismo patrón; ídem el mapa de progreso de tours si guarda el id (DEC-FAC-054, F-V2-029) |
| carpeta Cloudinary `hospeda/<env>/gastronomies/<id>` | `hospeda/<env>/venues/<id>` | el seed resube las fotos de ejemplo bajo la carpeta nueva; las viejas quedan huérfanas |
| fixtures: `deterministicFixtureId({ seedKey: 'gastronomy:${seedId}' })` y los `seedId` | `venue:${seedId}` y `seedId` sin la palabra | cambia el UUID de cada ficha de ejemplo, FAQ y reseña: staging se resetea (DEC-FAC-029), sin migración |
| nombres nuevos de esta spec | `BusinessLine`, `ListingSection`, `SectionTrait` | ver sub-spec 2 y DEC-FAC-031 |

## Qué se conserva (DEC-FAC-032)

Lista cerrada, y es la misma que G-FAC-R1 cuenta por nombre:

| # | qué | por qué |
|---|---|---|
| a | gastronomía como **tema**, lista cerrada (DEC-FAC-044): categoría «Gastronomía» de eventos, posts y POI (`EventCategoryEnum`/`PostCategoryEnum.GASTRONOMY`, tag de blog, slugs de `facet-slugs.ts`); la **dimensión `gastronomy` del rating de destino** (schema, mensajes, etiquetas; no se renombra ni se migra: es dato de prod) y `footer.categoryGastronomy`. La tile de la home **ya no** está (DEC-FAC-068: se renombra) | es el tema, no la vertical |
| b | la palabra como tema en prosa y la etiqueta y el slug público del rubro `food` (`gastronomia`) | texto para el visitante y URL `/rubro/gastronomia/`. **No** ampara la palabra cuando nombra a la vertical («Suscripción de gastronomía», el ítem del menú): eso se renombra |
| c | el mapa de redirects legacy `/gastronomia/…` → `/comer-y-salir/…` (y sus tests) | los enlaces viejos siguen llegando |
| d | el propio guard de palabra retirada | tiene que nombrar lo que prohíbe |
| e | eventos pasados de PostHog y correos ya enviados | historia externa que no se reescribe |

Fuera del escaneo (historia, no es una excepción del código): las migraciones versionadas que no se editan,
**la migración de renombrado y su `meta/`**, **los módulos de data-migration del seed** (el paso 6 del corte los
borra), las specs de HOS-1352/1353/1354 y esta spec (F-V2-015).

**Inventario de valores i18n que nombran la vertical** (F-V2-015): cada clave cuyo **valor** dice
«Gastronomía»/«Gastronomia» como vertical recibe texto nuevo en es/en/pt. Piso: `nav.gastronomy` (es y pt),
`account.json:168,486,545,789`, `billing.json:710`, `footer.json:14`, `gastronomy.json:10,149,155,171`,
`packages/notifications/src/utils/product-domain-copy.ts:140`. Los textos de la vertical son los aprobados en
DEC-FAC-068 («Comer y salir» / «Food & nightlife» / «Comer e sair»); la regla 5 de G-FAC-R1 impide que quede alguno.
El resto del copy del embudo (que habla de restaurante) es del sub-spec 9 (DEC-FAC-069); este hijo sólo cambia el
nombre de la vertical.

**Tile de la home** (DEC-FAC-068): sale de la exención (a) de G-FAC-R1, así que se renombra **acá** (si no, el guard
nace rojo): clave `home.categoryTiles.tiles.gastronomy` → `foodEvents` (nombre propuesto) y su imagen, con el texto
«Eventos gastronómicos» / «Food events» / «Eventos gastronômicos». Sigue llevando a `/eventos/categoria/gastronomia/`
(slug de categoría, exento).

## Mecánica

1. **Base: migración física escrita a mano** (F-V1-013, F-V1-022, F-V1-023). `drizzle-kit generate`
   pregunta por cada tabla, columna y enum si se creó o se renombró y sin TTY no se puede responder: el
   SQL se escribe a mano (precedente `0114_entity_subscriptions_rename.sql`). El snapshot se obtiene
   generando **una vez con TTY**, quedándose con el snapshot y reemplazando el SQL por el escrito a mano; la
   prueba es la guarda de drift (`check-schema-drift.sh`, línea «No schema changes») (F-V2-004).
   - **Primera sentencia**: `DO $$ … IF EXISTS (SELECT 1 FROM vertical WHERE id = 'gastronomy') THEN RAISE
     EXCEPTION 'HOS-1787: esta base necesita reset (DEC-FAC-029)'` (F-V2-043). Una base local o de worktree
     no reseteada falla con un mensaje claro en vez de en el `ADD CONSTRAINT`.
   - Tablas y columnas: `ALTER TABLE … RENAME TO`, `RENAME COLUMN`.
   - **Cada índice, FK, constraint, secuencia y trigger se renombra explícitamente** (`RENAME TO` de la
     tabla conserva los nombres viejos). Inventario desde `pg_indexes`/`pg_constraint`/`pg_trigger` de una
     base con seed **y extras**. Dos clases (F-V2-004):
     - objetos de Drizzle (existen en toda base): `RENAME` directo;
     - objetos de los **extras** (existen en prod y en staging con extras, **no** en una base desde cero,
       porque los extras corren después de migrar): `ALTER INDEX IF EXISTS … RENAME` y `DO $$ … IF EXISTS
       (SELECT 1 FROM pg_trigger | pg_constraint …)` para triggers y constraints. Incluye los
       `trg_set_updated_at_gastronomies` y `trg_set_updated_at_gastronomy_*` de `extras/002` (que nombra por
       tabla y, si no encuentra el nombre nuevo, crea **otro**: prod quedaría con dos triggers por tabla y el
       `compare` del paso 6 del corte fallaría después del punto de no retorno), y los de `extras/032`.
   - Enums: `ALTER TYPE … RENAME VALUE` para los valores de `role_enum`, `permission_enum`,
     `permission_category_enum` y `entity_type_enum` (arrastra todas las filas, incluida la auditoría de
     `user_role_audit`); `ALTER TYPE … RENAME TO` para los 4 enums `gastronomy_*_enum`. **No** se
     recrea el tipo: la recreación de 0135 borra las filas del valor retirado y el `USING col::new_enum`
     que emite drizzle-kit falla con las filas viejas.
   - CHECKs generados desde `VerticalEnum`: secuencia `DROP CONSTRAINT` → `UPDATE` de filas → `ADD
     CONSTRAINT`, editada a mano (el `ADD` valida las filas existentes).
   - **Las migraciones históricas no se tocan, salvo cinco: 0129, 0132, 0139, 0144 y 0176** (DEC-FAC-029,
     ampliada por DEC-FAC-060, Q-11): se editan para que el catálogo nazca `venue`. Es la excepción explícita a
     «nunca editar una migración ya aplicada» (aplicadas sólo en staging y local) y se justifica con el reset de
     staging de la ventana. La `0139` fija `ck_addon_product_compatible_verticals` y `ck_promo_code_verticals` con
     `'gastronomy'` literal (`:95,167`) y la 0176 editada inserta `'{venue}'`: sin editarla, `db:migrate` desde cero
     corta en la 0176 (CI, plantilla, reset y prod en el paso 3); la `0132` (`fix_request_entity_type_check`, `:14`)
     se edita por coherencia. **Regla general**, que vale para cualquier otra que aparezca en la tarea: **se edita
     toda migración entre la 0125 y la de renombrado que fije un literal de vertical del que dependa una fila
     insertada por una migración editada**. Con esa regla la lista de cinco es la medida hoy, no un límite. **No
     existe** una «guarda de inmutabilidad de migraciones» (F-V2-047): G18 no cambia (compara el acumulado con
     el código) y la guarda de drift no mira migraciones viejas.
   - Extras vivos: `026` (`UPDATE gastronomies` sin guarda, fallaría) y `032` (constraints de media,
     salta con NOTICE si la tabla no existe: bug previo HOS-1794, aparte) se reescriben **en el mismo PR**,
     con los nombres nuevos de índice y constraint que la migración ya renombró, para que la
     reaplicación no cree duplicados.
2. **Valores persistidos**: inventario completo en discovery A §5 (sus anotaciones «Q-01 antes/después»
   están resueltas: rige «antes»). Resumen:
   - `entity_subscriptions` **no se toca**: no existe en staging (0125) y en prod la borra la 0125.
   - Conversiones de datos que el código nuevo lee con validación estricta (`email_outbox.payload`, blob
     de `ai_settings`, `qr_codes.target_url`, `revalidation_config`, **`amenities.applicable_verticals` y
     `features.applicable_verticals`** con `array_replace(…, 'gastronomy', 'venue')` (existen en prod desde la
     0028 y las 0076/0078 escribieron `'gastronomy'`; el enum Zod es estricto, F-V2-002), y
     **`ai_prompt_versions.feature`**, `ai_conversations.feature`, `ai_request_log.feature` (F-V2-021)) van en la **migración versionada** del
     renombrado físico (carril 1), no en una data-migration de seed: el carril de seed corre después de que
     el código nuevo ya sirve (F-V1-010). Con staging reseteado y sin convivencia de versiones se **retiran**
     los lectores tolerantes de un release (renderers del outbox, blob de `ai_settings`): ya no hay dos
     versiones sirviendo a la vez. Se conserva, por prueba, un test que parsea un blob de `ai_settings` con
     una clave desconocida y prueba que las demás siguen andando.
   - **Catálogo de planes** (`vertical`, `catalog_key`, `plan*`, `addon*`): nace `venue` por la edición de
     0129/0144/0176 (DEC-FAC-029); no hay `UPDATE` que pelee con los triggers de `extras/041`. Verificar que
     los ids UUIDv5 (`plan:${vertical}:${slug}` y derivados) se recalculan solos al regenerar el catálogo.
   - **Orden dentro de la migración** (F-V2-048): primero los `UPDATE` de datos que filtran por el valor
     viejo (p. ej. `qr_codes` con `entity_type = GASTRONOMY`), después los `RENAME VALUE`; si no, el filtro ya
     no matchea y actualiza cero filas en silencio.
   - `domain_event.entity_type`: en prod la tabla **sí existe** cuando corre el renombrado (la crea una de
     0125…0177, F-V2-003) y en el paso 3 los extras todavía no la protegen, así que ahí un `UPDATE` pasaría;
     con cero fichas de la vertical en prod (DEC-FAC-027) no hay filas que convertir, y el ensayo lo mide. En
     staging, pérdida aceptada (reset). `social_audit_log.entity_type`: NM explícito (historia).
   - `quota_window (vertical, key)`: reinicio aceptado en staging (reset).
3. **Seed**: `data/gastronomy/` → `data/venue/` con dual-write, incluidos los 42 JSON de `data/amenity` y
   `data/feature` con `"applicableVerticals": ["gastronomy"]` (su data-migration en prod no hace nada: el carril
   1 ya convirtió, F-V2-002). Prod no tiene fichas de gastronomía, ni reales ni de ejemplo (DEC-FAC-027):
   renombrar el `seedKey` no tiene impacto en prod. El baseline del corte es la foto de prod **después** de que
   el paso 3 ejecutó el renombrado, no algo que lo reemplace.
   - **Ids de fixtures**: `seedKey` y `seedId` se renombran (DEC-FAC-032); cambia el UUID de cada ficha de
     ejemplo, FAQ y reseña. Sin migración por el reset. El seed resube las fotos de ejemplo bajo
     `venues/` en Cloudinary.
   - **Data-migrations históricas** (F-V1-011): se editan **sólo en sus imports y literales de
     identificador**, para que compilen contra los nombres nuevos; su lógica no cambia. El checksum del
     ledger no se verifica (`ledger.ts:14-16`). `0109`, `0110` y `0125` todavía no corrieron en prod y
     corren **después** de la migración de renombrado (paso 3: `db:migrate` → `db:apply-extras` →
     `db:seed:migrate`): todo valor de enum que escriban tiene que ser el nuevo (`VENUE_OWNER`). La 0109 se
     deja como está: la data-migration nueva de seen-ids (DEC-FAC-054) se numera después y lleva sus ids al
     nombre final. Los módulos quedan **fuera del escaneo** de G-FAC-R1 (DEC-FAC-044). El paso 6 del corte los
     borra.
4. **Redirects y QR** (F-V1-007):
   - Redirect de un salto en `apps/web/src/lib/legacy-redirects.ts` para cada ruta retirada; los de
     `mi-cuenta` conservan ruta profunda y query. **302** durante el soak, 301 con un cambio explícito.
   - **Lo que protege a los QR impresos es `qr_codes.target_url`**: el sticker codifica `/qr/<slug>/`
     (inmutable; `apps/web/src/pages/qr/[slug].astro:8`, F-V2-051) y la plataforma redirige a `target_url`. La migración reescribe `target_url` de las
     filas GENERATED de `entity_type = GASTRONOMY`, cualquier `purpose` (menú y folleto), al prefijo
     nuevo. La regex de repunte (`gastronomy-qr.ts:42`) acepta la forma vieja y la nueva (para siempre si
     hay códigos MANUAL con la vieja; ese uso lleva marcador en línea contado por G-FAC-R1), con test de
     regresión «slug renombrado sobre una fila pre-renombrado repunta».
   - El redirect de `/{lang}/gastronomia/{slug}/carta/` se mantiene para enlaces y códigos MANUAL. Como
     no hay QR reales en prod (DEC-FAC-027), el plazo del redirect lo fija el soak, no una medición. (El
     redirect **de estado** de `/comer-y-salir/<slug>/carta/` a la ficha es otra cosa: 302 `no-store` siempre,
     DEC-FAC-042.)
   - **Sesiones vivas** (F-V2-050, no verificado): Better Auth cachea `session.user.role` en la cookie hasta 5
     minutos (`auth.ts:251,500`). La tarea verifica si algún lector parsea ese rol contra `RoleEnum`; si lo
     hace, se documenta (la ventana del corte, con crons apagados, ya dura más que la cache).
5. **Guards e inventarios** atados al nombre (discovery A §8) se actualizan en el mismo cambio, y cada uno
   demuestra que sigue vivo con una **mutación posterior al renombrado** (tabla en `06-guards.md`,
   F-V1-024).
6. **G-FAC-R1** (palabra retirada) y **G-FAC-R2** (redirects y QR de un salto) nacen acá.
7. **Pasos de deploy**: invalidar la generación global del cache Redis del conjunto efectivo (`gen:all`, el
   campo `gastronomy` del hash queda huérfano); purgar en Cloudflare los prefijos viejos y los tags
   `list-gastro`/`gastro-<slug>`, y actualizar las reglas a mano de `infra/cloudflare/rules/cache-rules.md`
   **en el mismo momento**, no después.

## Criterio de aceptación

- G-FAC-R1 y G-FAC-R2 en verde, con mutación que los rompe; G-FAC-R1 con las cinco excepciones de «Qué se
  conserva», cada una contada por nombre.
- **Primero de todo**: `db:migrate` desde cero con las migraciones editadas (es el primer error que aparece,
  F-V2-001).
- Migraciones aplicadas desde cero **y** sobre una base con seed **y con los extras aplicados** (es la
  única forma de ver los triggers de `extras/041`); orden de carriles respetado (`db:migrate` →
  `db:apply-extras` → `db:seed:migrate`).
- **Ensayo del paso 3 del corte sobre un clon de prod-main** (F-V2-003), insumo del «Momento 3 · antes del
  ensayo del corte» de HOS-1352: (a) `db:migrate` de la cadena entera 0125…0178 con las migraciones editadas y
  la de renombrado, con la `CUT-LIST` real de la 0148; (b) `db:apply-extras`; (c) `db:seed:migrate` (incluidas
  `0109`, `0110`, `0125` y la de seen-ids); (d) todos los `count(*) = 0` de discovery A §5 **sobre ese clon**,
  incluido `cutover_v6_deleted_listing WHERE entity_type = 'gastronomy'`; (e) `step-6 compare` en verde entre el
  clon migrado y una base construida desde cero (F-V2-004).
- Una consulta `count(*) … = 0` sobre el valor viejo por cada fila del inventario de discovery A §5,
  excluyendo `deleted_at` donde exista.
- `pg_indexes`, `pg_constraint`, `pg_trigger` y `pg_type` no devuelven ningún nombre con `gastronom`, y hay
  exactamente un `uq_venue_media_single_featured` y un `trg_set_updated_at_venues`, tanto en el clon de
  prod-main migrado como en una base desde cero.
- typecheck/lint/test con `CI=true` en cada paquete tocado, **incluido `@repo/seed`**; e2e
  `listing-owner-*` en verde.
- Ningún usuario con un id viejo de What's New en `seenIds` lo ve como nuevo después de la migración de
  seen-ids (test sobre el clon).
- Marcha atrás escrita como revert + reset en staging y restauración del backup del paso 2b en prod
  (DEC-FAC-061), con la lista de lo que no vuelve; sin migración inversa.
- `db:migrate` desde cero con las **cinco** migraciones editadas en verde (primer chequeo, antes de cualquier otro).
- Una mutación posterior al renombrado por cada guard atado al nombre.
- Smoke en staging (`status-needs-smoke-staging`) tras la ventana: redirects 302 (incluido `/carta/` y un
  escaneo `/qr/<slug>/` de un salto), alta y edición de un local, checkout de un plan de la vertical con el título
  «Comer y salir Básico» en el resumen de MP, Cloudinary (fotos de ejemplo bajo `venues/`), cache.
- El corte V6 de HOS-1352 no se ejecuta hasta que la etapa B esté mergeada y verificada en staging.
