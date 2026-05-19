# Accommodation Image Pool

> Curated Pexels image URLs grouped by accommodation type, used by the example
> seed JSON files under `packages/seed/src/data/accommodation/<destination>/`.

## Why this pool exists

Without curation, accommodation seed images tend to drift in three bad ways:

1. **Cross-type pollution** — the same generic stock photo shows up across hotels, cabins, and country houses, so listings look interchangeable and fake.
2. **Caption mismatches** — the photo a URL actually resolves to drifts from the caption written in the JSON. (Example: prior to SPEC-119, `pexels-photo-1011302` was used 32 times across apartment seeds captioned "Sala de estar" but the actual image is a green orchid.)
3. **Camping galleries collapse to a single repeated set** — every camping ends up with the same five images.

The pool is the type-aware source of truth that prevents all three.

## Where the pool lives

- TypeScript source of truth: [`packages/seed/src/data/accommodation/_image-pool.ts`](../src/data/accommodation/_image-pool.ts)
- Exports `IMAGE_POOL_BY_TYPE: Record<PooledAccommodationType, readonly ImageVariant[]>`.
- Each variant is `{ url, caption, description }`.

The TS file is the **only** authoritative pool. Seed JSON files inline URLs from this pool (they cannot import TS at load time), and a CI-side lint script verifies every JSON URL is a member of its type pool.

## Pool composition (current)

| Type | URLs |
|------|-----:|
| APARTMENT | 25 |
| HOUSE | 25 |
| COUNTRY_HOUSE | 25 |
| CABIN | 25 |
| HOTEL | 25 |
| HOSTEL | 25 |
| CAMPING | 25 |
| ROOM | 25 |
| **Total** | **200** |

`MOTEL` and `RESORT` are intentionally not pooled — no example seeds exist for those types. If a future seed introduces one, extend `IMAGE_POOL_BY_TYPE` and the `PooledAccommodationType` union together.

### Why 25 per type

The pool size is calibrated to support the per-accommodation assignment algorithm used by SPEC-119:

- Featured image: 1 URL random from the type's 25 URLs.
- Gallery: a random count `N ∈ [5, 24]`, then `N` distinct URLs from the remaining 24.

With 25 URLs and a per-accommodation random gallery of variable size, the combinatorial space is large enough that no two same-type accommodations produce identical galleries — even at the largest type (apartment, 20 accommodations) the collision probability is statistically zero.

## Curation methodology (when adding URLs)

The original 80-URL pool was built during SPEC-119 — see [`spec-119-image-pool-curation.md`](./spec-119-image-pool-curation.md) for the full per-URL provenance, content verification, and selection rationale. New additions must follow the same rules:

1. **Source from Pexels.** No other CDN. The lint script and content guarantees only apply to `https://images.pexels.com/photos/<id>/...` URLs.
2. **Verify the image actually matches the caption.** Fetch the Pexels photo page (`https://www.pexels.com/photo/<id>/`) and read the title/tags. If the photo is generic, ambiguous, or off-theme, skip it.
3. **Avoid cross-type contamination.** Before adding a URL to a type, search the existing pool for the same URL in any other type. If it's already pooled elsewhere, choose a different photo — the same URL must never appear under two types.
4. **Verify HTTP 200** with `curl -I <url>` before committing. Pexels occasionally retires image variants while leaving the photo page reachable.
5. **Write the caption and description in Spanish.** Project default locale is `es` (Argentina). Captions are short (3-6 words), descriptions slightly longer (~10-15 words). Keep them generic enough to fit several accommodations — don't reference a specific destination or amenity that won't apply to every reuse.

## Rotation convention

When picking images for a new or refreshed accommodation seed:

- The **featured image** should be the most visually striking URL appropriate for the listing.
- The **gallery** should pick 4-6 additional URLs from the same type's pool.
- For accommodations of the same type in the same destination, vary the selection so any two gallery sets differ in ≥3 URLs (no near-identical galleries).
- For high-volume types (e.g. apartment with 20 seeds against 10 pool URLs), overlap is unavoidable but identical sets are not — vary the order and the specific subset.

A test under `packages/seed/test/` enforces the camping-gallery uniqueness rule (any two camping galleries differ in ≥3 URLs). For other types the convention is informal but checked during PR review.

## Adding a new URL: end-to-end checklist

1. Verify HTTP 200: `curl -sI 'https://images.pexels.com/photos/<id>/...' | head -1`
2. Fetch the Pexels page and confirm the photo content matches your intended caption.
3. Confirm the URL is not already in any other type's pool.
4. Add the entry to the right type array in `_image-pool.ts`. Keep the array sorted in author preference order (most generic / best featured-candidate first).
5. Run `pnpm --filter @repo/seed check` to ensure formatting and lint pass.
6. (Optional) Update any seed JSON files that should consume the new URL. The lint script will reject JSONs with URLs not in the pool, so adding without consuming is fine; consuming without adding is rejected.

## Removing or replacing a URL

If a URL must be removed (404, content drift, deprecation):

1. Add the replacement URL first (so coverage doesn't dip below 10).
2. Update every seed JSON that references the old URL to use the replacement instead.
3. Then delete the old entry from `_image-pool.ts` and commit.

This ordering keeps the lint script happy at every commit.

## Related references

- [`packages/seed/src/data/accommodation/_image-pool.ts`](../src/data/accommodation/_image-pool.ts) — the pool itself
- [`packages/seed/docs/spec-119-image-pool-curation.md`](./spec-119-image-pool-curation.md) — original curation log (per-URL provenance, dropped URLs, content verification)
- `packages/seed/scripts/check-image-pool-coverage.ts` — lint script (introduced by SPEC-119 T-028)
