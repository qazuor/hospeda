---
title: HOS-2058 category assignment draft
linear: HOS-2058
statusSource: linear
---

# Category assignment draft

Input for OQ-1 (feature categories) and OQ-2 (amenity categories) of HOS-2058.
Measured on `origin/staging` (106 features, 110 amenities). Labels come from
`packages/i18n/src/locales/es/accommodations.json` (`featureNames`).

## 1. Feature categories

### 1.1 Recommended list

The draft list has 10 values. This draft recommends two changes, each backed by at least 3 rows:

- **Add ACTIVITIES** (10 rows): the rural and agro-tourism cluster (animal activities,
  educational farm, dairy farm, yoga area, walking circuit, workshops) plus the
  experience `outdoor_activity`. Without it these land in OFFER_PROFILE.
- **Add SECURITY** (3 rows): `24h_security`, `perimeter_lighting`, `perimeter_fence`.
  Exactly 3, and all three are amenity-like, so stage 3 may empty it. Owner call (see 1.4).
- **Drop VIEW** (2 rows only: `panoramic_view_extended`, `private_viewpoint`). Merge into
  LOCATION. Views also exist as amenities (`river_view`, `panoramic_view`). Re-add if a
  third view feature appears.
- LANGUAGE is widened from "experience guide languages" to any language trait, so
  `bilingual_services` (accommodation, venue, experience) lands there. That makes 3 rows.

Resulting counts (106 rows):

| Category | Rows | Rows flagged for stage 3 or 4 |
|---|---|---|
| LOCATION | 11 | 0 |
| ACCESS | 4 | 2 |
| STYLE | 6 | 1 |
| AUDIENCE | 19 | 5 |
| OFFER_PROFILE | 30 | about 22 |
| SUSTAINABILITY | 7 | 2 |
| CUISINE | 8 | 0 |
| DIETARY | 5 | 0 |
| LANGUAGE | 3 | 0 |
| ACTIVITIES | 10 | 3 |
| SECURITY | 3 | 3 |

### 1.2 Per-category tables

Flag legend: POLICY means the row is really a policy (stage 4 removes it). AMENITY-like means
it is something the visitor uses (stage 3 moves or drops it). Two-fit means a second
category is defensible. Every row has a category now regardless of the flag.

### LOCATION (11)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 001 | `river_front` | accommodation | Frente al río |  |
| 002 | `spa_front` | accommodation | Frente al balneario | two-fit: LOCATION or VIEW-adjacent |
| 003 | `panoramic_view_extended` | accommodation | Vista panorámica | two-fit: VIEW or LOCATION (VIEW has only 2 rows) |
| 004 | `natural_environment` | accommodation | Entorno natural |  |
| 005 | `rural_area` | accommodation | Zona rural |  |
| 006 | `central_area` | accommodation | Zona céntrica |  |
| 007 | `residential_area` | accommodation | Zona residencial |  |
| 008 | `silent_environment` | accommodation | Entorno silencioso | two-fit: LOCATION or ambience |
| 009 | `isolated_no_neighbors` | accommodation | Aislado sin vecinos |  |
| 069 | `private_viewpoint` | accommodation | Mirador privado | two-fit: VIEW or LOCATION (VIEW has only 2 rows) |
| 078 | `no_cell_signal` | accommodation | Sin señal de celular |  |

### ACCESS (4)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 010 | `paved_access` | accommodation | Acceso pavimentado |  |
| 011 | `gravel_access` | accommodation | Acceso de ripio |  |
| 043 | `internal_parking` | accommodation | Estacionamiento interno | AMENITY-like (stage 3) |
| 070 | `dock_access` | accommodation | Acceso a muelle | AMENITY-like (stage 3) |

### STYLE (6)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 018 | `modern_style` | accommodation | Estilo moderno |  |
| 019 | `rustic_style` | accommodation | Estilo rústico |  |
| 020 | `minimalist_style` | accommodation | Estilo minimalista |  |
| 023 | `smart_home` | accommodation | Casa inteligente | AMENITY-like (stage 3) |
| 024 | `themed_rooms` | accommodation | Habitaciones temáticas | two-fit: STYLE or OFFER_PROFILE |
| 049 | `local_artisan_decor` | accommodation | Decoración local artesanal | two-fit: STYLE or OFFER_PROFILE |

### AUDIENCE (19)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 012 | `family_suitable` | accommodation | Apto para familias | two-fit: AUDIENCE; near-duplicate pair across verticals |
| 013 | `couple_suitable` | accommodation | Apto para parejas |  |
| 014 | `pet_suitable` | accommodation | Apto para mascotas | POLICY (stage 4) |
| 015 | `ideal_for_groups` | accommodation | Ideal para grupos |  |
| 016 | `ideal_for_seniors` | accommodation | Ideal para adultos mayores |  |
| 017 | `disability_accessible` | accommodation, venue, experience | Apto para personas con discapacidad | two-fit: AUDIENCE or amenity ACCESSIBILITY (duplicates wheelchair_accessible) |
| 026 | `exclusive_kids_area` | accommodation | Sector exclusivo para niños | AMENITY-like (stage 3) |
| 027 | `adults_only_area` | accommodation | Sector solo adultos | AMENITY-like (stage 3) |
| 059 | `event_suitable` | accommodation | Apto para eventos | policy-adjacent (events allowed, stage 4) |
| 060 | `wedding_suitable` | accommodation | Apto para bodas | policy-adjacent (events allowed, stage 4) |
| 061 | `spiritual_retreat_suitable` | accommodation | Apto para retiros espirituales |  |
| 062 | `remote_coworking_suitable` | accommodation | Apto para trabajo remoto |  |
| 074 | `lgbtq_friendly` | accommodation | Alojamiento LGBTQ+ amigable |  |
| 085 | `family_friendly` | venue | Apto para familias | two-fit: AUDIENCE; near-duplicate pair across verticals |
| 086 | `romantic_ambiance` | venue | Ambiente romántico | two-fit: AUDIENCE or STYLE |
| 089 | `kid_friendly` | experience | Apto para niños |  |
| 090 | `beginner_friendly` | experience | Apto para principiantes |  |
| 094 | `pregnancy_safe` | experience | Apto para embarazadas |  |
| 096 | `senior_friendly` | experience | Apto adultos mayores |  |

### OFFER_PROFILE (30)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 025 | `wifi_full_property` | accommodation | Wi-Fi en todo el predio | AMENITY-like; duplicates amenity wifi (stage 3) |
| 028 | `autonomous_checkin` | accommodation | Check-in autónomo | POLICY (stage 4) |
| 029 | `minimum_stay_required` | accommodation | Estancia mínima requerida | POLICY (stage 4) |
| 030 | `full_rental` | accommodation | Alquiler completo |  |
| 031 | `room_rental` | accommodation | Alquiler por habitación |  |
| 032 | `camping_area` | accommodation | Sector de camping | AMENITY-like; near-duplicate of camping_sector (stage 3) |
| 033 | `fire_pit_area` | accommodation | Espacio de fogón | AMENITY-like (stage 3) |
| 034 | `covered_gallery` | accommodation | Galería techada | AMENITY-like (stage 3) |
| 035 | `private_grill` | accommodation | Parrilla privada | AMENITY-like; overlaps amenity bbq_grill/quincho (stage 3) |
| 036 | `shared_space` | accommodation | Espacio compartido | two-fit: OFFER_PROFILE or AUDIENCE |
| 040 | `quiet_zone` | accommodation | Zona de silencio | two-fit: OFFER_PROFILE or LOCATION (ambience); AMENITY-like |
| 041 | `smoking_area` | accommodation, venue | Sector para fumadores | POLICY (stage 4) |
| 042 | `pet_friendly_area` | accommodation | Sector pet-friendly | POLICY (stage 4) |
| 044 | `tourist_info_available` | accommodation, venue, experience | Información turística disponible | AMENITY-like (stage 3) |
| 046 | `transfer_service` | accommodation | Servicio de traslado | AMENITY-like (stage 3) |
| 047 | `laundry_service` | accommodation | Servicio de lavandería | AMENITY, duplicate of amenity slug (stage 3) |
| 048 | `luggage_storage` | accommodation | Guardaequipaje | AMENITY, duplicate of amenity slug (stage 3) |
| 050 | `own_production` | accommodation | Producción propia | fits no category cleanly; kept in OFFER_PROFILE |
| 053 | `digital_detox_zone` | accommodation | Zona sin conexión digital | two-fit: OFFER_PROFILE or LOCATION (ambience); AMENITY-like |
| 054 | `no_tv_area` | accommodation | Área sin televisión | two-fit: OFFER_PROFILE or LOCATION (ambience); AMENITY-like |
| 055 | `satellite_wifi` | accommodation | Wi-Fi satelital | AMENITY-like; duplicates amenity wifi (stage 3) |
| 056 | `vehicle_rental` | accommodation | Alquiler de vehículos | AMENITY-like (stage 3) |
| 058 | `tourism_certification` | accommodation | Certificación turística | fits no category cleanly (credential) |
| 064 | `camping_sector` | accommodation | Sector para acampar | AMENITY-like; near-duplicate of camping_area (stage 3) |
| 071 | `covered_barbecue_area` | accommodation | Sector de barbacoa techado | AMENITY-like; overlaps amenity bbq_grill/quincho (stage 3) |
| 073 | `permanent_professional_staff` | accommodation | Staff profesional permanente | fits no category cleanly; kept in OFFER_PROFILE |
| 084 | `kids_menu` | venue | Menú para niños | AMENITY-like (stage 3) |
| 087 | `organic_products` | venue | Productos orgánicos | fits no category cleanly; kept in OFFER_PROFILE |
| 088 | `craft_beer` | venue | Cerveza artesanal | fits no category cleanly; kept in OFFER_PROFILE |
| 095 | `private_available` | experience | Disponible en formato privado | fits no category cleanly (booking mode) |

### SUSTAINABILITY (7)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 021 | `ecological_construction` | accommodation | Construcción ecológica |  |
| 022 | `renewable_energy` | accommodation | Uso de energías renovables |  |
| 057 | `sustainable_accommodation` | accommodation | Alojamiento sustentable |  |
| 075 | `waste_recycling` | accommodation | Reciclado de residuos |  |
| 076 | `rainwater_harvesting` | accommodation | Captación de agua de lluvia |  |
| 077 | `plastic_free_policy` | accommodation | Política sin plásticos | POLICY (stage 4) |
| 079 | `solar_showers` | accommodation | Duchas solares | AMENITY-like (stage 3) |

### CUISINE (8)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 099 | `argentine_cuisine` | venue | Cocina argentina |  |
| 100 | `river_cuisine` | venue | Cocina de río |  |
| 101 | `italian_cuisine` | venue | Cocina italiana |  |
| 102 | `peruvian_cuisine` | venue | Cocina peruana |  |
| 103 | `international_cuisine` | venue | Cocina internacional |  |
| 104 | `asian_cuisine` | venue | Cocina asiática |  |
| 105 | `mediterranean_cuisine` | venue | Cocina mediterránea |  |
| 106 | `fusion_cuisine` | venue | Cocina de fusión |  |

### DIETARY (5)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 081 | `gluten_free_options` | venue | Opciones sin TACC |  |
| 082 | `vegan_options` | venue | Opciones veganas |  |
| 083 | `vegetarian_options` | venue | Opciones vegetarianas |  |
| 097 | `lactose_free_options` | venue | Opciones sin lactosa |  |
| 098 | `nut_free_options` | venue | Opciones sin frutos secos |  |

### LANGUAGE (3)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 072 | `bilingual_services` | accommodation, venue, experience | Servicios bilingües | two-fit: LANGUAGE or OFFER_PROFILE (staff) |
| 091 | `english_guide_available` | experience | Guía disponible en inglés |  |
| 092 | `portuguese_guide_available` | experience | Guía disponible en portugués |  |

### ACTIVITIES (10)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 045 | `organized_activities` | accommodation | Actividades organizadas |  |
| 051 | `animal_activities` | accommodation | Actividades con animales |  |
| 052 | `educational_farm` | accommodation | Granja educativa |  |
| 063 | `rural_activities_stay` | accommodation | Estancia con actividades rurales |  |
| 065 | `dairy_farm_production` | accommodation | Tambo y producción de campo |  |
| 066 | `animal_corral` | accommodation | Corral de animales |  |
| 067 | `yoga_meditation_area` | accommodation | Área de yoga y meditación | AMENITY-like (stage 3) |
| 068 | `walking_circuit` | accommodation | Circuito de caminatas | AMENITY-like (stage 3) |
| 080 | `workshop_training_space` | accommodation | Espacio para talleres y capacitaciones | AMENITY-like (stage 3) |
| 093 | `outdoor_activity` | experience | Actividad al aire libre | two-fit: ACTIVITIES or AUDIENCE-neutral trait |

### SECURITY (3)

| # | Slug | Verticals | Label (es) | Flag |
|---|---|---|---|---|
| 037 | `24h_security` | accommodation | Seguridad 24 horas | AMENITY-like; fits SECURITY only (stage 3) |
| 038 | `perimeter_lighting` | accommodation | Iluminación perimetral | AMENITY-like; fits SECURITY only (stage 3) |
| 039 | `perimeter_fence` | accommodation | Cerco perimetral | AMENITY-like; fits SECURITY only (stage 3) |

### 1.3 Observations

- OFFER_PROFILE is the catch-all. It holds 30 rows, of which about 22 are amenity-like
  (camping, grills, wifi, services, quiet zones). After stage 3 it should shrink to about 8
  (`full_rental`, `room_rental`, `shared_space`, `permanent_professional_staff`,
  `tourism_certification`, `private_available`, `own_production`, `organic_products`,
  `craft_beer`).
- Policies hiding as features: `autonomous_checkin`, `minimum_stay_required`,
  `pet_suitable`, `pet_friendly_area`, `smoking_area`, `plastic_free_policy`. Adjacent:
  `event_suitable`, `wedding_suitable` (events policy).
- Duplicates of amenity slugs: `laundry_service` and `luggage_storage` (exist in both tables).
  Near-duplicates: `camping_area` vs `camping_sector`, `family_suitable` vs `family_friendly`
  (different verticals), `disability_accessible` vs amenity `wheelchair_accessible`,
  `wifi_full_property` and `satellite_wifi` vs amenity `wifi`.
- No row fits no category at all. Rows that fit none cleanly are flagged "fits no category
  cleanly" and kept in OFFER_PROFILE.

### 1.4 Decisions for the owner

- OQ-1a: add ACTIVITIES (recommended) or fold it into OFFER_PROFILE.
- OQ-1b: add SECURITY (3 rows, all amenity-like) or place them in OFFER_PROFILE.
  Recommendation: do not add it. Stage 3 will likely turn them into amenities, which would
  leave a dead enum value, and removing a pgEnum value is painful. Keeping them in
  OFFER_PROFILE is cheaper. The counts above assume SECURITY is added so the owner sees it.
- OQ-1c: drop VIEW (recommended).
- Not proposed (below 3 rows or a poor fit): SERVICES (its members are amenities), SAFETY
  (same), AMBIANCE (`quiet_zone`, `digital_detox_zone`, `no_tv_area` are 3 rows but amenity-like).

## 2. Amenity categories

Current `AmenitiesTypeEnum` has 12 values. SERVICES (26) and GENERAL_APPLIANCES (15) are
lopsided, and WORK_FRIENDLY (1) and ACCESSIBILITY (2) are thin.

Recommended additions, each regrouping at least 3 existing rows:

- PARKING (5): spec candidate. Includes `bike_parking` (venue, currently OUTDOORS).
- LAUNDRY (4): spec candidate.
- WATER_ACTIVITIES (4): spec candidate. This draft adds `beach_chairs_umbrellas` (OUTDOORS)
  to reach 4 without waiting for stage 3 additions. Without it only 3 rows remain.
- WELLNESS (5, new proposal): `spa`, `gym`, `relaxation_area`, `sauna`, `jacuzzi`.
  Today these are split between GENERAL_APPLIANCES and OUTDOORS.
- DINING (12, new proposal): food and drink offers currently inside SERVICES. It takes
  SERVICES from 26 to 13.

Thin categories (WORK_FRIENDLY 1, ACCESSIBILITY 2, ENTERTAINMENT 3) are left alone. Merging
them changes meaning and is stage 3 territory. Not moved, but flagged for stage 3:
`pet_friendly`, `smoke_free`, `accepts_cards` (SERVICES/GENERAL_APPLIANCES, really policies);
`river_view`, `panoramic_view` (OUTDOORS, really views); `water_heater`,
`double_glazed_windows`, `outdoor_lighting` (GENERAL_APPLIANCES, no better home).

Counts per type, and the exact rows that move:

| Category | Before | After |
|---|---|---|
| CONNECTIVITY | 5 | 5 |
| CLIMATE_CONTROL | 5 | 5 |
| KITCHEN | 9 | 9 |
| BED_AND_BATH | 8 | 5 |
| OUTDOORS | 22 | 18 |
| GENERAL_APPLIANCES | 15 | 6 |
| ACCESSIBILITY | 2 | 2 |
| SAFETY | 8 | 7 |
| SERVICES | 26 | 13 |
| ENTERTAINMENT | 3 | 3 |
| FAMILY_FRIENDLY | 6 | 6 |
| WORK_FRIENDLY | 1 | 1 |
| PARKING | 0 | 5 |
| LAUNDRY | 0 | 4 |
| WELLNESS | 0 | 5 |
| DINING | 0 | 12 |
| WATER_ACTIVITIES | 0 | 4 |
| Total | 110 | 110 |

| Slug | Verticals | From | To |
|---|---|---|---|
| `parking` | accommodation,venue,experience | GENERAL_APPLIANCES | PARKING |
| `covered_parking` | accommodation | GENERAL_APPLIANCES | PARKING |
| `motorhome_parking` | accommodation | GENERAL_APPLIANCES | PARKING |
| `security_parking` | accommodation,venue,experience | SAFETY | PARKING |
| `bike_parking` | venue | OUTDOORS | PARKING |
| `washer` | accommodation | BED_AND_BATH | LAUNDRY |
| `dryer` | accommodation | BED_AND_BATH | LAUNDRY |
| `iron` | accommodation | BED_AND_BATH | LAUNDRY |
| `laundry_service` | accommodation | SERVICES | LAUNDRY |
| `kayaks` | accommodation | GENERAL_APPLIANCES | WATER_ACTIVITIES |
| `fishing_equipment` | accommodation | GENERAL_APPLIANCES | WATER_ACTIVITIES |
| `beach_equipment` | accommodation | GENERAL_APPLIANCES | WATER_ACTIVITIES |
| `beach_chairs_umbrellas` | accommodation | OUTDOORS | WATER_ACTIVITIES |
| `spa` | accommodation | GENERAL_APPLIANCES | WELLNESS |
| `gym` | accommodation | GENERAL_APPLIANCES | WELLNESS |
| `relaxation_area` | accommodation | GENERAL_APPLIANCES | WELLNESS |
| `sauna` | accommodation | OUTDOORS | WELLNESS |
| `jacuzzi` | accommodation | OUTDOORS | WELLNESS |
| `breakfast` | accommodation | SERVICES | DINING |
| `full_board` | accommodation | SERVICES | DINING |
| `half_board` | accommodation | SERVICES | DINING |
| `restaurant` | accommodation | SERVICES | DINING |
| `bar` | accommodation | SERVICES | DINING |
| `bar_service` | venue | SERVICES | DINING |
| `mini_bar` | accommodation | SERVICES | DINING |
| `happy_hour` | venue | SERVICES | DINING |
| `catering` | venue | SERVICES | DINING |
| `takeaway` | venue | SERVICES | DINING |
| `delivery` | venue | SERVICES | DINING |
| `food_included` | experience | SERVICES | DINING |

Notes:

- Seed file names and ids embed the old type (for example
  `017-amenity-general-appliances-parking.json`, id `017-amenity-general-appliances-parking`).
  The id is deterministic and referenced by relations, so do NOT rename files or ids. Only
  edit the `type` field in the JSON (baseline) and ship a data-migration (dual-write rule).
- `packages/seed/src/schemas/amenity.schema.json` lists the type enum and must grow.
- Each new value needs: pgEnum value, `AmenitiesTypeEnum`, icon in
  `packages/icons/src/domain/amenity-type.ts`, color token in
  `packages/design-tokens/src/tokens/amenity-types.ts` plus the generator list and its
  snapshot, i18n labels (web `accommodations.amenityCategories.*`, admin
  `admin-entities.types.amenity.*`, `admin-filters.amenityType.*`) in es, en and pt, and
  `apps/web/src/lib/catalog-categories.ts` order and labels.
- A pgEnum cannot lose values cheaply, so the owner should pick the final set before the migration.

## 3. Scope and availability

Facts: NULL means "not declared" (spec 5.3). `scope` (private or shared) only makes sense
where the same facility can be either. `availability` (seasonal) only where it can be closed
part of the year.

Accommodation amenities where `scope` is meaningful:

- `pool`, `heated_pool`, `jacuzzi`, `sauna`, `bbq_grill`, `quincho`, `full_kitchen`,
  `private_garden`, `patio`, `terrace`, `solarium`, `balcony`, `parking`, `covered_parking`,
  `washer`, `dryer`, `gym`, `spa`, `playground`, `outdoor_kitchen`, `outdoor_furniture`.

Accommodation amenities where `availability` is meaningful:

- `pool`, `heated_pool`, `jacuzzi`, `sauna`, `heating`, `air_conditioning`, `fireplace`,
  `wood_stove`, `bbq_grill`, `quincho`, `solarium`, `beach_chairs_umbrellas`, `kayaks`,
  `fishing_equipment`, `beach_equipment`, `bicycles`, `breakfast`, `restaurant`, `bar`,
  `room_service`, `daily_cleaning`, `playground`, `spa`, `gym`.

Interaction with existing rows: `shared_kitchen`, `shared_patio` and `outdoor_kitchen` are
variants that `scope` would make redundant (`shared_kitchen` is `full_kitchen` with
scope shared). Stage 3 should merge them rather than keep both. D-3 keeps changing-the-offer
variants such as `heated_pool` as rows, so `pool` plus `scope`/`availability` does not
replace them.

Recommendation: show the controls for every checked amenity, collapsed behind a "details"
disclosure, instead of a hardcoded allowlist.

- Pro: no second source of truth to keep in sync with the catalog (the repo rule is that the
  UI reads the catalog), and nothing to update when stage 3 adds rows.
- Pro: NULL is harmless, so unused controls cost nothing in data quality.
- Con: noise for about 70 of 92 accommodation amenities (wifi, toilet-level items).
- Alternative if the owner dislikes the noise: a catalog flag column on `amenities`
  (for example `supportsScope`, `supportsAvailability`) so the allowlist lives in seed data,
  not in code. This needs a column and a dual-write, so it is more work than the default.

## 4. Impact notes

### 4.1 Dead category schemas

Consumers found: none outside `packages/schemas`. A search of `apps/*`, `packages/service-core`
and `packages/db` for `FeatureCategor*`, `categoryInfo` and `FeatureCategoriesSchema`
returns nothing, and no route or service exposes them. `packages/schemas/README.md` lists
them (generated inventory, lines 473-474 and 490-491). Items:

| Location | Item | Notes |
|---|---|---|
| `feature.http.schema.ts:72` | `category: z.string().min(1).max(50).optional()` in `FeatureCreateHttpSchema` | free string, no backing column. Replace with the enum |
| `amenity.http.schema.ts:79` | same, in `AmenityCreateHttpSchema` | amenities use `type`. Delete (second string category next to `type`) |
| `feature.crud.schema.ts:279` and `:298` | `FeatureCategoryUpdateInputSchema` / `OutputSchema` (bulk category update) | unused. Reuse only if a bulk-recategorize admin action is wanted, else delete |
| `feature.query.schema.ts:197` and `:331` | `FeatureCategoriesSchema` / `FeatureCategoriesOutputSchema` (list categories with stats) | unused. Delete (categories are a closed enum, not data) |
| `feature.query.schema.ts` lines 33, 88, 209, 219, 379, 421 | optional `category: z.string()` filters | reuse: retype to `FeatureCategoryEnumSchema` to give a real category filter |
| `feature.relations.schema.ts:59`, `:128`, `:364` | `FeatureCategorySummarySchema`, `categoryInfo` | delete (statistics summary, no producer) |
| `feature.admin-search.schema.ts:9` | docblock "features table has no `category` column" | becomes false, update |
| `amenity.relations.schema.ts` (`AmenityCategorySummarySchema`, `categoryInfo`, `category` strings) | same pattern on the amenity side | outside the five listed locations, found during the search. Decide with the same rule |

Recommendation (AC-2 forbids keeping both): reuse the filter fields and the create field by
retyping them to the new enum; delete everything that has no producer or consumer
(`FeatureCategoryUpdate*`, `FeatureCategories*`, `FeatureCategorySummary`/`categoryInfo`,
and the amenity create `category`). Regenerate the README inventory.

### 4.2 Frozen guards and tests touching `AmenitiesTypeEnum`

These must be updated deliberately (AC-6) if values are added:

- `apps/admin/test/features/filter-config-phase2.test.ts:207` asserts the type select covers
  all 12 values and lists them (around lines 213-223).
- `packages/icons/test/domain.test.ts:233` hardcodes the 12-type list for `getAmenityTypeVisual`.
- `apps/web/test/lib/catalog-categories.test.ts`: GENERAL_APPLIANCES label ("Equipamiento")
  and key `generalAppliances`, plus a docblock calling it a catch-all that holds parking.
  The docblock becomes stale when parking moves out.
- `packages/design-tokens/src/generators/__snapshots__/generate-css.test.ts.snap` (CSS token
  snapshot) and `generators/variant-tokens-domain.ts:76`: each new type adds tokens, so the
  snapshot must be regenerated.
- `packages/db/test/enum-consistency.test.ts` compares DB enums with TS enums.
- Fixtures and factories that use a type value but do not count: `packages/schemas/test/fixtures/amenity.fixtures.ts`,
  `packages/service-core/test/factories/amenityFactory.ts`, `packages/db/test/integration/spec-266-applicable-verticals-invariants.test.ts`
  (uses `CONNECTIVITY`), `packages/schemas/test/entities/amenity/amenity.http.schema.test.ts`,
  `packages/schemas/test/api/http/create-enum-array-query-param.test.ts`.
- Non-test mirrors of the enum to extend: `packages/db/src/schemas/enums.dbschema.ts`,
  `packages/db/scripts/generate-enum-migrations.ts`, `packages/schemas/src/enums/amenity-type.schema.ts`,
  `apps/admin/src/features/amenities/config/sections/basic-info.consolidated.ts` (hardcoded
  option list with Spanish labels), `apps/admin/src/features/amenities/config/amenities.config.ts`,
  `apps/admin/src/features/amenities/components/AmenityTypeBadge.tsx`,
  `packages/service-core/src/services/amenity/amenity.service.ts`,
  `apps/web/src/lib/api/transforms.ts`, `apps/web/src/components/host/editor/AmenitiesSection.client.tsx`
  (uses the enum, and HOS-1787 does not touch it).
- Seed-data row counts per type were not searched exhaustively. Run the repo
  guards after the change (`pnpm check:guards`) since source-matching guards escape symbol search.

New enum for features (`FeatureCategoryEnum`) needs its own mirrors: pgEnum in
`packages/db/src/schemas/enums.dbschema.ts`, seed `feature.schema.json`, i18n labels in
es, en and pt, and an admin select. Same frozen-guard pattern will apply.

## 5. Epic HOS-1787 additions

The epic adds these rows (not on staging yet). Proposed categories so the epic can set
them, or so the backfill covers the slugs when present:

| Kind | Slug (epic id) | Vertical | Proposed | Note |
|---|---|---|---|---|
| Feature | `dj_sets` (107) | venue | ACTIVITIES | entertainment the venue offers. Pushes ACTIVITIES to 12 |
| Feature | `karaoke` (108) | venue | ACTIVITIES | same |
| Amenity | `dance-floor` (111-113) | venue | ENTERTAINMENT | physical facility, like `live_music` |
| Amenity | `vip-area` | venue | SERVICES | access tier, like `private_events` |
| Amenity | `cloakroom` | venue | SERVICES | like `luggage_storage` (SERVICES) |

Epic slugs use hyphens for amenities (`dance-floor`) while existing catalog slugs use
underscores, and the amenity slug regex allows underscores. Confirm the final slug spelling
with the epic session before the backfill lists them. If the epic assigns `category` itself,
this table is moot. If DINING or PARKING are not adopted, SERVICES remains the home for
`vip-area` and `cloakroom`.
