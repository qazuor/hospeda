import { PartnerService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for partner data.
 *
 * Strips seed-only metadata (`$schema`, `id`) and forwards the remaining
 * fields as-is — `startsAt`/`endsAt` are ISO date strings, which
 * `createPartnerSchema`'s `z.coerce.date()` accepts directly.
 *
 * Exported so the HOS-172 dual-write data-migration
 * (`data-migrations/0019-backfill-example-partners.ts`) can reuse the exact
 * same normalization when backfilling these fixtures on an already-seeded
 * environment, the same way `pointsOfInterest.seed.ts` exports
 * `normalizePointOfInterestSeedItem` for its own dual-write migration.
 */
export const partnerNormalizer = (data: Record<string, unknown>) => {
    const { $schema: _schema, id: _id, ...cleanData } = data;
    return cleanData;
};

/**
 * Get entity info for partner
 */
const getPartnerInfo = (item: unknown) => {
    const partnerData = item as Record<string, unknown>;
    const name = partnerData.name as string;
    const type = partnerData.type as string;
    const tier = partnerData.tier as string;
    return `"${name}" (${type}/${tier})`;
};

/**
 * Partners seed using Seed Factory.
 *
 * Seeds example brand/business directory partners (SPEC-271) that power the
 * public `/partners` landing and the `PartnersSection` home carousel. All
 * fixtures are created `subscriptionStatus: 'active'` + `lifecycleState:
 * 'ACTIVE'` so they show up on the public listing out of the box (see
 * `PartnerModel.findByFilters` / `PartnerService._executeSearch`, which force
 * both filters for the public/protected search path).
 */
export const seedPartners = createSeedFactory({
    entityName: 'Partners',
    serviceClass: PartnerService,
    folder: 'src/data/partner',
    files: exampleManifest.partners,
    normalizer: partnerNormalizer,
    getEntityInfo: getPartnerInfo
});
