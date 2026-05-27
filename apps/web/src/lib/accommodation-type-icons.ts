/**
 * @file accommodation-type-icons.ts
 * @description Thin re-export of the canonical accommodation-type → icon
 * resolver, which now lives in `@repo/icons` as the single source of truth
 * shared by `apps/web` and `apps/admin`. Kept as a local module so existing
 * call sites (`@/lib/accommodation-type-icons`) need no change.
 *
 * Unknown types fall back to the generic `AccommodationIcon` (a bed glyph)
 * so the badge still renders something even if the API returns a value the
 * UI hasn't catalogued yet.
 *
 * @see {@link https://github.com/qazuor/hospeda packages/icons/src/domain/accommodation-type.ts}
 */

export { getAccommodationTypeIcon } from '@repo/icons';
