import { PointOfInterestService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import {
    getPointOfInterestEntityInfo,
    normalizePointOfInterestSeedItem
} from '../required/pointsOfInterest.seed.js';
import { createSeedFactory } from '../utils/index.js';

/**
 * Seed factory for the full 914-POI production catalog (HOS-142 G-2).
 *
 * Deliberately a SEPARATE top-level group from `--required`'s
 * `seedPointsOfInterest` (`../required/pointsOfInterest.seed.ts`), even though
 * both read JSON fixtures from the SAME physical folder
 * (`src/data/pointOfInterest/`) and reuse the exact same
 * `normalizePointOfInterestSeedItem` / `getPointOfInterestEntityInfo` helpers
 * unchanged (single source of truth for "how a raw POI fixture becomes a
 * `service.create()` payload" — see HOS-142 spec §12).
 *
 * **Why not just add these files to `--required`'s own manifest key?** —
 * `--required` runs on every fresh test/integration DB (spec §2), and 914
 * extra POI inserts would slow down every one of those paths for zero benefit
 * to callers that only need `--required`'s small FK-satisfying baseline data.
 * This group is gated by its own `--poi-catalog` CLI flag instead, chained
 * into every path that seeds real production content (`db:fresh`,
 * `db:fresh-dev`, `db:seed`, the production day-1 bootstrap) but never into a
 * bare `--required`-only invocation (HOS-142 spec §6.2).
 *
 * Reads `requiredManifest.pointOfInterestCatalog` — a manifest key separate
 * from `requiredManifest.pointsOfInterest` (which must stay at its
 * pre-HOS-142 length of 12, HOS-142 AC-5) — even though both keys resolve to
 * the same folder via `ENTITY_FOLDER_MAP` in
 * `../utils/validateManifestVsFolder.ts`.
 *
 * @example
 * ```typescript
 * await seedPointOfInterestCatalog(seedContext);
 * // Creates the 914-POI production catalog, e.g.:
 * // "casa_izquierdo" (OTHER)
 * // "aeroclub" (SPORTS_VENUE)
 * ```
 */
export const seedPointOfInterestCatalog = createSeedFactory({
    entityName: 'PointOfInterestCatalog',
    serviceClass: PointOfInterestService,
    folder: 'src/data/pointOfInterest',
    files: requiredManifest.pointOfInterestCatalog,
    normalizer: normalizePointOfInterestSeedItem,
    getEntityInfo: getPointOfInterestEntityInfo
});
