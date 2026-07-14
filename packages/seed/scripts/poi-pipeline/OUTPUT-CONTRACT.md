# POI pipeline output contract (HOS-141 T-010)

The pipeline emits, into `packages/seed/scripts/poi-pipeline/output/` (a staged
location — **never** the live seed data folder, §6.4):

- `<slug>.json` — one file per POI (the v2 fixture shape below).
- `destination-relations.json` — the destination↔POI relation rows.
- `report.md` / `report.json` — the run summary (G-6).
- `geocode-cache.json` — the committed geocode cache (§6.3.3), written next to
  the script (not in `output/`).

HOS-142 owns copying the fixtures into
`packages/seed/src/data/pointOfInterest/`, assigning the deterministic fixture
id / numbering / `$schema` header, and wiring the seed factory + the
`r_poi_category` / `r_destination_point_of_interest` links.

## Fixture shape

Verified against the **real merged** `points_of_interest` v2 schema
(`packages/db/src/schemas/destination/point-of-interest.dbschema.ts`, HOS-138 +
HOS-139). The spec §7 shape holds — every column exists; the 12 shipped fixtures
simply left the optional ones unpopulated.

```jsonc
{
  "slug": "concordia_municipalidad",     // unique, snake_case (OQ-1); collision-prefixed <dest>_<poi>
  "lat": -31.392,                        // number | null (null when unresolved, OQ-4)
  "long": -58.021,                       // number | null
  "type": "GOVERNMENT",                  // deprecated-transitional; deriveTypeFromCategorySlug(primary) (HOS-139)
  "icon": null,
  "description": "…",                    // plain Spanish (fallback column)
  "nameI18n": { "es": "…", "en": null, "pt": null },      // es from CSV; en/pt never invented
  "descriptionI18n": { "es": "…", "en": null, "pt": null },
  "translationMeta": {},
  "address": "…",                        // CSV passthrough (100% populated)
  "keywords": ["…"],                     // split from the CSV `keywords` cell
  "hasOwnPage": false,
  "isBuiltin": true,                     // seed data
  "isFeatured": true,                    // priority HIGH -> true (spec §7)
  "displayWeight": 100,                  // priority HIGH/MEDIUM/LOW -> 100/50/10
  "verified": false,                     // CSV passthrough; FORCED false for geocoded rows (G-5)
  "verifiedAt": null,                    // CSV passthrough (null for geocoded)
  "source": "https://…",                 // CSV passthrough (or null)
  "notes": "…",                          // CSV passthrough; auto-geocode marker appended for geocoded rows (G-5)
  "lifecycleState": "ACTIVE",
  "categories": [                        // M2M assignments (HOS-142 -> r_poi_category)
    { "slug": "government", "isPrimary": true },
    { "slug": "community_center", "isPrimary": false }
  ]
}
```

## Provenance rules (G-5)

- **Row already had CSV coordinates** → coords, `verified`, `verifiedAt`,
  `source`, `notes` all pass through unmodified.
- **Row geocoded by the pipeline** → geocoded coords, `verified` forced
  `false`, `verifiedAt` `null`, and a fixed marker (containing `auto-geocoded`)
  appended to `notes` so a future human pass can find them
  (`WHERE notes LIKE '%auto-geocoded%'`).
- **Row unresolved / low-confidence** → `lat`/`long` `null` (OQ-4), provenance
  unchanged. Never defaulted to a destination centroid (AC-4).

## Determinism (AC-7)

Slug/category/type derivation is pure; the auto-geocode marker date is pinned
(`GEOCODE_BATCH_DATE`, not `new Date()`); fixtures are written sorted by slug,
pretty-printed with a trailing newline. A warm-cache re-run is byte-identical
and makes zero network calls.

## Geocoding: two-tier cascade (see report.json)

Coordinate coverage is **893/914 (97.7%)** via a cascade:

1. **Nominatim (OSM)** — primary, address-based query. Free. Resolves the rows
   with real street addresses (~99 of the coordinate-less set) plus the 197 that
   already had coordinates in the CSV.
2. **Google Places** (`places:searchText`) — fallback, tried BY NAME only for
   rows Nominatim leaves unresolved (`<name>, <destinationName>, Entre Ríos,
   Argentina`), with a province guard that rejects a right-name/wrong-province
   homonym. Resolves the small local landmarks OSM lacks (597 rows). Enabled
   only when `HOSPEDA_GOOGLE_PLACES_API_KEY` is present; a hard `maxRequests`
   cap + a separate committed cache keep the one-time cost bounded (~$20) and
   re-runs at $0.

Only **21 genuinely point-less rows** remain `null` (bike circuits, sandbanks,
wetlands, route junctions) — correctly, since they have no single coordinate
(NG-5 + OQ-4). Every geocoded row is `verified: false` + carries the
auto-geocode marker (G-5), since these are best-effort coordinates pending human
verification (some Google matches are a nearby proxy for a barrio/circuit).
