import { PartnerTypeEnum } from '@repo/schemas';
import { PartnerService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { partnerTypeIdFor } from '../required/partnerTypes.seed.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/** Legacy enum values, which are also their partner type catalog slugs. */
const LEGACY_PARTNER_TYPES: ReadonlySet<string> = new Set(Object.values(PartnerTypeEnum));

/**
 * Normalizer for partner data.
 *
 * Strips seed-only metadata (`$schema`, `id`) and forwards the remaining
 * fields as-is.
 *
 * Exported so the HOS-172 dual-write data-migration
 * (`data-migrations/0019-backfill-example-partners.ts`) can reuse the exact
 * same normalization when backfilling these fixtures on an already-seeded
 * environment, the same way `pointsOfInterest.seed.ts` exports
 * `normalizePointOfInterestSeedItem` for its own dual-write migration.
 */
export const partnerNormalizer = (data: Record<string, unknown>) => {
    const { $schema: _schema, id: _id, typeSlug, ...cleanData } = data;
    // HOS-2336: fixtures name their type by catalog slug. This normalizer keeps
    // producing the LEGACY `type` column value, because the HOS-172
    // data-migration (0019) inserts its output straight through the model,
    // before the partner type catalog (0182) exists: it must not write a
    // `type_id`. 0182 backfills `type_id` from `type` afterwards.
    const slug = typeof typeSlug === 'string' ? typeSlug : undefined;
    return {
        ...cleanData,
        ...(slug && LEGACY_PARTNER_TYPES.has(slug) ? { type: slug } : {})
    };
};

/**
 * Baseline normalizer: the HOS-172 shape plus `typeId`, the deterministic id
 * of the fixture's catalog type (HOS-2336). `PartnerService` validates it and
 * dual-writes the legacy column itself.
 *
 * @param data - Raw fixture item
 * @returns Create payload including `typeId`
 */
export const partnerBaselineNormalizer = (data: Record<string, unknown>) => {
    const { type: _legacyType, ...rest } = partnerNormalizer(data) as Record<string, unknown>;
    const slug = typeof data.typeSlug === 'string' ? data.typeSlug : undefined;
    return slug ? { ...rest, typeId: partnerTypeIdFor({ slug }) } : rest;
};

/**
 * Get entity info for partner
 */
const getPartnerInfo = (item: unknown) => {
    const partnerData = item as Record<string, unknown>;
    const name = partnerData.name as string;
    const type = (partnerData.typeSlug ?? partnerData.typeId) as string;
    return `"${name}" (${type})`;
};

/**
 * Partners seed using Seed Factory.
 *
 * Seeds example brand/business directory partners (SPEC-271) that power the
 * public `/partners` landing and the `PartnersSection` home carousel. All
 * fixtures are created `lifecycleState: 'ACTIVE'` so they show up on the
 * public listing out of the box (see `PartnerModel.findByFilters` /
 * `PartnerService._executeSearch`, which force that filter for the
 * public/protected search path).
 */
export const seedPartners = createSeedFactory({
    entityName: 'Partners',
    serviceClass: PartnerService,
    folder: 'src/data/partner',
    files: exampleManifest.partners,
    normalizer: partnerBaselineNormalizer,
    getEntityInfo: getPartnerInfo
});
