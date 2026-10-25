---
title: Discovery A — huella del renombrado gastronomy → venue
linear: HOS-1787
statusSource: linear
created: 2026-10-25
base: origin/staging @ 2ebee74d0a
---

# 05-A · Discovery: huella de `gastronom` en el repo

Relevamiento read-only sobre `origin/staging` (HEAD `2ebee74d0a`) con `git grep`/Read, hecho por
subagente. Conteos por área = líneas que matchean; el total global = ocurrencias.

> **Corregido en la resolución de la vuelta 1** (ver `11-resolucion-vuelta-1/00-arreglos-aplicados.md`):
> §4 y §5 se rehicieron desde el esquema actual (F-V1-003, 007, 008); §6 (checksum) se corrigió
> (F-V1-011). **Prod no es staging**: `origin/main` termina en la migración `0124` y no tiene
> `vertical`, `catalog_key`, `plan*`, `subscription`, `trial`, `domain_event` ni `email_outbox`; sí tiene
> `gastronomies`, `qr_codes` y `entity_subscriptions` (F-V1-001).
>
> **Corregido en la resolución de la vuelta 2** (`13-resolucion-vuelta-2/00-arreglos-aplicados.md`): §5 suma
> las filas que faltaban (F-V2-002, 021, 029, 051, 053) y corrige `domain_event` y los QR. Los Q-01…Q-10 de la
> vuelta 1 ya están respondidos (DEC-FAC-026…039); los Q-11…Q-20 son de la vuelta 2 y también están respondidos (DEC-FAC-060…069).

## 1. Tamaño

- **2.372 de 19.197 archivos trackeados; 61.719 ocurrencias.** ~55 % de las líneas son snapshots de
  Drizzle (`packages/db/src/migrations/meta/*_snapshot.json`); la superficie fuente real ronda
  **1.500 archivos**.
- Por área (archivos): apps/web 428 · apps/api 357 · packages/seed 328 · packages/db 324 · .specs 217
  · packages/schemas 181 · packages/service-core 167 · apps/admin 98 · packages/i18n 82 · scripts 41 ·
  packages/verticals 41 · docs 34 · packages/notifications 22 · apps/e2e 12 · resto < 10 c/u (icons,
  design-tokens, .claude, apps/mobile, ai-core, billing-verticals-contract, config, infra, cache-tags,
  media, analytics, `.qz/project.json`, CLAUDE.md raíz).
- **~330 rutas de archivo o carpeta** contienen la palabra (carpetas `gastronomy/` en api, web,
  admin, db, schemas, service-core, seed; `locales/*/gastronomy.json`; 7 páginas web; ADR-035;
  `GastronomicMarketIcon.tsx`).

## 2. Lo que matchea y NO es la vertical

- **Categorías de contenido**: `EventCategoryEnum.GASTRONOMY`, `PostCategoryEnum.GASTRONOMY` (enums
  Postgres `event_category_enum`, `post_category_enum`), la categoría de POI `gastronomy`
  (`poiCategory/021-poi-category-gastronomy.json`), el tag de blog `gastronomia`, el pilar/hashtag de
  automatización social, las facetas `/eventos/categoria/gastronomia`, el redirect legacy
  `/categoria/gastronomy`.
- **Prosa en español** («gastronomía» como palabra común) en ~150 archivos: seeds de eventos y posts,
  POI, destinos, marketing, data-migrations `0027`/`0028`, `real-blog-posts/*.json`.
- `GastronomicMarketIcon` (adjetivo).

## 3. Colisión: `venue` YA existe

~360 ocurrencias en ~420 archivos: el slug de POI `sports_venue` (233), `venueEvents` /
`GastronomyVenueEvents*` / `ownerGrantsVenueEvents` / `applyGastronomyVenueEventsGate` /
`venue-event-draft.ts` / `VENUE_EVENT` / `VenueEventRow`, `venueName`/`venueType` en la ubicación de
eventos, `CarnavalVenueIcon`, copy en inglés. **Una sustitución mecánica produce `VenueVenueEvents`.**

## 4. Base de datos

- **10 tablas**: `gastronomies` (38 col.), `gastronomy_daily_specials`, `gastronomy_events`,
  `gastronomy_faqs`, `gastronomy_media`, `gastronomy_menu_items`, `gastronomy_menu_sections`,
  `gastronomy_reviews`, `r_gastronomy_amenity`, `r_gastronomy_feature`. FK `gastronomy_id` en 9;
  índices y FKs con el nombre (mezcla camel/snake).
- **Enums Postgres con el nombre**: `gastronomy_type_enum`, `gastronomy_menu_file_kind_enum`,
  `gastronomy_event_recurrence_enum`, `gastronomy_media_state_enum`.
- **Valores de enum con el nombre**: `entity_type_enum.GASTRONOMY`, `permission_category_enum.GASTRONOMY`,
  `role_enum.GASTRONOMY_OWNER`, `permission_enum` (7: `gastronomy.editOwn|create|viewAll|editAll|delete|moderateReview|moderationChange`,
  congelados por `permission-gastronomy-experience.test.ts`), más las categorías de contenido.
- **Columnas texto/array que guardan `'gastronomy'`**: `vertical.id`, `plan.vertical`,
  `subscription.vertical`, `permanent_grant.vertical`, `quota_window.vertical` (+ `key`),
  `coverage_loss.vertical`, `plan_migration.vertical`, `trial.vertical`, `plan_version`,
  `addon_product.compatible_verticals[]`, `promo_code.verticals[]`,
  `amenities/features.applicable_verticals[]`, `fix_request.entity_type`,
  `revalidation_config/log.entity_type`, `domain_event.entity_type` (append-only),
  `ai_usage.feature` (`chat_gastronomy`), `email_outbox.payload` (json). CHECKs: `ck_vertical_id`,
  `fix_request_entity_type_check`, `ck_addon_product_compatible_verticals`, `ck_promo_code_verticals`
  (generados desde `VerticalEnum`).
- **Ya no existe en staging**: `entity_subscriptions` (`DROP TABLE … CASCADE` en
  `0125_robust_cassandra_nova.sql:68`). En prod todavía existe y la borra la 0125 cuando llegue, así que
  la migración del renombrado **nunca** la toca. (El `CLAUDE.md` raíz todavía la describe como viva.)
- **FK compuestas que llevan la vertical** (sin `ON UPDATE`): `subscription (plan_version_id,
  vertical)`, `plan_version (plan_id, vertical)`, `trial` ×4, `permanent_grant`, `plan_migration`;
  `quota_window` referencia `(vertical, key)`. Los triggers de `extras/041` prohíben `UPDATE`/`DELETE`
  de las filas versionadas del catálogo y existen sólo donde corrió `db:apply-extras` (F-V1-002).
- **Historia inmutable**: 27 migraciones SQL (0000, 0017, 0023, 0028, 0036, 0050, 0071, 0072, 0104,
  0105, 0109–0111, 0113, 0116, 0123, 0126–0129, 0132, 0135, 0139, 0144, 0148, 0158, 0167, 0176) +
  `meta/_journal.json` + ~178 snapshots.
- **Extras vivos** (se reaplican): `extras/026` (`UPDATE gastronomies`), `extras/032` (constraints de
  `gastronomy_media`), comentarios en `033` y `040`. Si la tabla se renombra, tienen que seguirla.
- El repo históricamente **recrea** enums enteros (0126, 0128, 0135) en vez de `RENAME VALUE`. Eso sirvió
  para **retirar** valores (0135 borra las filas del valor retirado); para **renombrar** la herramienta es
  `RENAME VALUE`, que es atómico y arrastra todas las filas (F-V1-022). Columnas afectadas por
  `role_enum`/`permission_enum`/`entity_type_enum`: `r_role_permission`, `r_user_permission`,
  `r_user_role`, `user_role_audit`, `user_bookmark`, `r_entity_tag`, `entity_view`,
  `entity_view_monthly_rollup`, `entity_comment`, `qr_codes` (más el índice parcial de `extras/040`).

## 5. Valores persistidos y externos

Rehecho en la resolución de la vuelta 1 desde el esquema de `staging` y de `origin/main`. Entorno:
**prod** = existe hoy en prod (`origin/main`, migración 0124); **staging** = sólo en staging (llega a prod
con el corte V6 de HOS-1352). Tratamiento: **RV** = `ALTER TYPE … RENAME VALUE`; **MV** = `UPDATE` en la
migración versionada del renombrado físico (carril 1); **LT** = lector tolerante; **NM** = no se migra;
**Q-NN** = depende de una pregunta al owner (`11-resolucion-vuelta-1/10-decisiones-del-owner.md`). Cada
fila con MV o RV lleva en el criterio de aceptación una consulta `count(*) … = 0` sobre el valor viejo
(excluyendo `deleted_at` donde exista).

| qué | dónde | entorno | tratamiento |
|---|---|---|---|
| `VerticalEnum.GASTRONOMY` (85 usos) | columnas `vertical` de §4, CHECKs generados | staging | MV con `DROP` → `UPDATE` → `ADD` de cada CHECK; las del catálogo, Q-02 |
| `ProductDomainEnum.GASTRONOMY` | sólo TS en staging (la columna murió con `entity_subscriptions` en 0125); en prod, `entity_subscriptions.product_domain` y `billing_subscriptions` | TS + prod | código; en prod lo borra la 0125 |
| `EntityTypeEnum.GASTRONOMY` | `user_bookmark`, `entity_view*`, `entity_comment`, `r_entity_tag`, `qr_codes.entity_type` (+ índice parcial `extras/040`) | ambos | RV |
| `RoleEnum.GASTRONOMY_OWNER` (84 usos) | `r_user_role`, `role_permission`, `user_role_audit.role` (historia), tours web, mobile, skill smoke-tanda | ambos | RV (arrastra también la auditoría) |
| `PermissionEnum` `gastronomy.*` (7) y `permission_category_enum.GASTRONOMY` | `r_role_permission`, `r_user_permission` | ambos | RV |
| claves de entitlement `publish_gastronomy`, `edit_gastronomy_info`, `manage_gastronomy_menu`, `manage_gastronomy_daily_special`, `manage_gastronomy_events`, `multilingual_gastronomy_menu` | `catalog_key`, `plan_version_entitlement` (0144), `quota_window.key` | staging | Q-02 |
| claves de limit `max_gastronomies`, `max_ai_chat_gastronomy_per_month` | `plan_version_limit`, addons, detalles de error | staging | Q-02 |
| slugs de plan `gastronomy-basico/pro/premium` + planes de rol `trial`/`pre-trial`/`floor` | 0144, `scripts/production-catalog/catalog.ts` | staging | Q-02. **Verificado: los ids UUIDv5 derivan de la vertical y de las claves** (`loads.ts:22,46-50,67-70,82-85`; `commercial-loads.ts`): `plan:${vertical}:${slug}` y derivados. Renombrar la vertical cambia el id de los 6 planes, sus versiones, filas de entitlement/limit y `billing_option`, aunque el slug no cambie |
| slugs de addon `extra-gastronomies-1`, `visibility-boost-gastronomy-7d/30d` | 0176 (`addon:${slug}`) | staging | Q-02 |
| `plan.name` y títulos visibles en MP («Gastronomía Básico», «Gastronomy Trial», «Extra Gastronomy Listing») | catálogo (`catalog.ts:549,1514,1537,1562`) | staging | Q-02 |
| `domain_event.entity_type` = la vertical | escritores en `listing-publication/*`; lector `listing-support-edit.service.ts:38-41` | staging | **no se puede actualizar** (`extras/056`, append-only). En staging, pérdida aceptada (reset, DEC-FAC-029). En prod la tabla **sí existe** cuando corre el renombrado (la crea una de 0125…0178 en el paso 3 del corte, antes de los extras que la protegen), pero con cero fichas de la vertical en prod (DEC-FAC-027) no hay filas que convertir; el ensayo del paso 3 lo mide (sub-spec 1, F-V2-003) |
| `amenities.applicable_verticals[]`, `features.applicable_verticals[]` | filas del catálogo de comodidades y características (0129 y seed, 42 JSON) | **ambos** (en prod ya guardan `'gastronomy'`) | **MV** en la migración del renombrado + dual-write de los 42 JSON del seed (F-V2-002, CRÍTICA) |
| `ai_prompt_versions`, `ai_conversations`, `ai_request_log` (vertical/feature en texto) | tablas de IA | ambos | MV (F-V2-021) |
| `social_audit_log` | auditoría de automatización social | ambos | NM (historia, F-V2-021) |
| `addon_product.compatible_verticals[]`, `promo_code.verticals[]` | CHECKs de la **0139** (no editada) contra los valores que la 0176 editada escribe | staging | se editan la **0139** y la 0132 (DEC-FAC-060, Q-11; F-V2-001, CRÍTICA) |
| `cutover_v6_deleted_listing` | tabla del corte V6 con la vertical de la ficha borrada | prod (nace en el corte) | medir en el ensayo del paso 3 sobre el clon de prod (sub-spec 1) |
| `email_outbox.payload.vertical` | renderers `listing-archived-renderers.tsx`, `listing-retention-renderers.tsx` (lanzan con una vertical desconocida); filas programadas por `send_after` | staging | MV + LT de los renderers durante un release |
| feature IA `chat_gastronomy` | `ai_settings` (blob validado con `partialRecord` sobre el enum, precedente HOS-1220); `ai_usage.feature` (histórico) | ambos | MV del blob + LT (ignorar claves desconocidas) + test; `ai_usage` MV |
| `quota_window (vertical, key)` | ventanas de cuota abiertas (trigger «una abierta», `extras/048`) | staging | Q-01: antes, se aceptan reiniciadas en staging; después, MV |
| campo `gastronomy` del hash Redis del conjunto efectivo | `packages/verticals/src/effective-set-cache/cache.ts:69,109` | ambos | paso de deploy: invalidar la generación global (`gen:all`) |
| `revalidation_config/log.entity_type = 'gastronomy'` | seed `revalidationConfig/001`, `entity-tag-mapper.ts`, `indexnow.service.ts` | ambos | MV (config) + dual-write del seed; el log, NM |
| cache tags `gastro-<slug>`, `list-gastro` | `packages/cache-tags/src/vocabulary.ts` | ambos | Q-05; purga en el mismo momento del deploy. **No matchean `gastronom`** |
| ids de What's New (3) | `users.settings.onboarding.whatsNew.seenIds` | ambos | se renombran con una data-migration de seen-ids **encadenada a la 0109** (corre después de ella), que reescribe el id viejo al nuevo para que nadie lo vuelva a ver (DEC-FAC-054, F-V2-029) |
| tour `web.gastronomy.welcome`, paso `gastronomy-qr` | `apps/web/src/config/tours.ts` | ambos | se renombran a `web.venue.welcome` / `venue-qr`, con el mismo tratamiento de ids vistos (DEC-FAC-054) |
| propiedad PostHog `is_gastronomy_owner` | `packages/analytics/src/shared.ts:61` | ambos | Q-05 |
| carpeta Cloudinary `hospeda/<env>/gastronomies/<id>` | `media-upload.schema.ts:371-373`; los `public_id` guardados la embeben | ambos | NM recomendado (Q-05): los chequeos de prefijo son por entorno, no por entidad (precedente HOS-831) |
| **QR impresos** | el sticker codifica `/qr/<slug>/` (inmutable; `apps/web/src/pages/qr/[slug].astro:8`, F-V2-051) y la plataforma redirige a `qr_codes.target_url` (`qr_code.dbschema.ts:19-26`). `target_url` guarda `…/{lang}/gastronomia/{slug}/carta/` (menú) o la URL de la ficha (folleto, `extras/040`) | ambos | **MV de `target_url`** en las filas GENERATED de `entity_type = GASTRONOMY`, cualquier `purpose`. La regex de repunte (`gastronomy-qr.ts:42`) acepta las dos formas; si no, el primer cambio de slug no repunta (`gastronomy.service.ts:730-737`) y el sticker termina en 404. El redirect legacy de `/gastronomia/<slug>/carta/` sigue para enlaces y códigos MANUAL. Orden: el `UPDATE target_url` corre **antes** del `RENAME VALUE` de `entity_type` (F-V2-048) |
| `publicar-restaurante` | la página ya tiene un 301 propio | ambos | el destino apunta directo a `PUBLISH_PAGE_PATH_BY_VERTICAL.venue`, un salto (F-V2-053) |
| usuarios dev `gastronomy-owner@local.test`, `host-gastronomy@local.test` | `testUsers.seed.ts` | dev | renombrar + dual-write; docs y skills que los citan |
| fixtures con ids deterministas | `example/gastronomies.seed.ts:37` (`seedKey: 'gastronomy:${seedId}'`), `:54` (FAQ); el `seedId` = id del fixture = nombre de archivo (`001-gastronomy-uruguay-…`) | ambos | Q-05. **Confirmado**: cambiar la semilla o el id cambia el UUID de cada ficha de ejemplo, FAQ y reseña, y su carpeta de Cloudinary |

## 6. Seed

- `src/data/gastronomy/` (6 fichas + FAQ + reseñas) y fixtures en otras carpetas; seeders
  `example/gastronomies.seed.ts` y otros.
- **17 data-migrations** mencionan la palabra. El ledger `seed_migrations` guarda un checksum pero
  **no lo verifica** (`packages/seed/src/data-migrations/ledger.ts:14-16`: «the checksum-drift check is
  not yet wired»). La restricción real es otra: varias importan símbolos que el renombrado borra
  (`0079` importa `gastronomies`, `PermissionEnum.GASTRONOMY_*`, `RoleEnum.GASTRONOMY_OWNER`; `0110`,
  `RoleEnum.GASTRONOMY_OWNER`; `0034`, `gastronomyMedia`) y dejan de compilar. `0109`, `0110` y `0125`
  **no están en `origin/main`**: corren en prod por primera vez con el deploy del corte (F-V1-011).
- `scripts/check-seed-dual-write.sh` (fail-closed) nombra `gastronomy` como fuente curada; renombrar
  la carpeta mueve la superficie vigilada. Plantillas de migración de renombrado: `0108-hos1417-retire-old-grouping.ts`,
  `0109-hos1418-whats-new-seen-ids-rename.ts`.

## 7. API · Web · Admin · i18n

- **API**: `/api/v1/{public,protected,admin}/gastronomies` (`apps/api/src/routes/index.ts:332,479,559`),
  ~100 archivos en `routes/gastronomy/`, parámetro `gastronomyId` (138 lugares), `entityType: 'gastronomy'`
  en ai-chat y uploads.
- **Web**: páginas `gastronomia/{index,[slug],[slug]/carta}`, `planes/gastronomia/{index,precios}`,
  `presentacion/gastronomia`, `publicar/gastronomia` (y `publicar-restaurante` ya redirige ahí); el
  segmento `[vertical]` de `mi-cuenta/comercio/` vale literalmente `gastronomy` (URL marcable).
  `components/gastronomy/` (21), `lib/gastronomy*`. SEO: `entity-public-urls.ts:58,79`,
  `static-sitemap-pages.ts`, `scripts/ci/seo-validator.ts:55`, guards de sitemap.
- **Redirects existentes**: `apps/web/src/lib/legacy-redirects.ts` vía `middleware.ts` (301 de un
  solo salto, con tests y `public-redirect-paths.guard.test.ts`); no hay `_redirects`. Reglas de
  Cloudflare **a mano** documentadas en `infra/cloudflare/rules/cache-rules.md` (matchean
  `/es|en|pt/gastronomia`, tags `list-gastro`/`gastro-<slug>`).
- **Admin**: `features/gastronomy/`, `routes/_authed/gastronomies/`, sidebar `config/ia/sidebars.ts:183-203`.
- **i18n**: namespace entero `gastronomy` (registrado en `config.shared.ts` y `scripts/check-locales.ts`);
  92 claves por locale con la palabra + 86–89 valores visibles.

## 8. Guards, tests e inventarios atados al nombre

`check-vertical-context.ts`, `check-vertical-axis-items.ts`, `check-vertical-immutable.ts`,
`check-listing-old-columns.ts`, `check-listing-delete-doors.ts` (su JSON parece **desactualizado**),
`check-purged-closed-list.ts`, `check-local-media-placeholders.sh`, `check-grant-floor-by-vertical.ts`,
`check-catalog-sql.ts` y otros; inventarios `scripts/guards/*.json`, `scripts/zod-keys-inventory.json`;
`.claude/project.config.json` y `.qz/project.json` (`schemaSentinelTables`), `.claude/test-categories.json`
(categoría `gastronomy`). Tests congelados: permisos (7), enum de tipo, conteo de product domain,
espejo de vertical, ~17 guards de API, ~13 de web, 1 de admin, integración de DB, e2e `listing-owner-01..05`.

## 9. Precedente: GUARD:G8

`scripts/check-old-grouping-word.sh` (palabra retirada «commerce»): arma la palabra en partes para no
matchearse, escanea contenido y rutas trackeadas, **una** exención por ruta exacta (el PDR) y una
allowlist de **exactamente tres** entradas con auto-chequeo (migraciones sin `extras/`,
data-migrations del seed, specs de HOS-1352/3/4); reglas temporales `STEP6_RULE`/`CLOSURE_RULE`; paso
propio en `ci.yml:273`; tests en `scripts/__tests__/check-old-grouping-word.test.ts`.

## 10. Lo que esto cambia en el diseño

1. **`venue` choca** con `venueEvents` y `sports_venue`: hay que decidir (OD-02).
2. **Alcance**: ¿categorías de contenido y prosa en español entran? (OD-03). Si no, el guard no puede
   ser un `gastronom` pelado.
3. **Billing**: slugs de plan y addon, claves y títulos de MP viven en el catálogo de **staging**
   (0144, 0176); prod (0124) todavía no tiene ese catálogo. Los ids UUIDv5 **sí** derivan de la vertical
   y de las claves (verificado, §5). Cuándo cae el renombrado respecto del corte V6 decide cómo se migra
   (F-V1-001, F-V1-002, F-V1-003; Q-01 y Q-02).
4. **Lo que no se puede renombrar** sin romper continuidad: QR impresos (se migra `qr_codes.target_url`;
   el sticker codifica `/q/<slug>`, que no cambia), public ids de Cloudinary, propiedad de PostHog, ids de
   What's New y tours (OD-01 ampliada, Q-05).
5. **`gastro`** (cache tags, clases CSS) y `restaurante` (`publicar-restaurante`, títulos de addon) no
   aparecen buscando `gastronom` (OD-05).
6. El renombrado es **un cambio de ~1.500 archivos**: hay que partirlo en PRs revisables sin dejar
   `staging` roto entre uno y otro (OD-06).
