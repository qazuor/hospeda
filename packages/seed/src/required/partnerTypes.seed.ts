import { PartnerTypeModel } from '@repo/db';
import { PartnerTypeService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import { createSeedFactory, whereFixtureSlug } from '../utils/index.js';
import type { SeedContext } from '../utils/seedContext.js';

/**
 * Derives the stable UUIDv5 of a partner type from its (immutable) slug.
 *
 * The id depends on the slug and nothing else, so the baseline seeder and the
 * data-migration (HOS-2336) assign the same id to the same row, and a partner
 * fixture can reference its type without a lookup. Slugs are immutable
 * (AC-3.3), which is what makes them safe to derive an id from.
 *
 * @param input - Object holding the type slug
 * @returns Canonical UUIDv5 string
 *
 * @example
 * ```ts
 * partnerTypeIdFor({ slug: 'media' }); // same UUID on every machine
 * ```
 */
export function partnerTypeIdFor(input: { readonly slug: string }): string {
    return deterministicFixtureId({ seedKey: `partnerType:${input.slug}` });
}

/** Raw partner type fixture, as stored under `src/data/partnerType/`. */
export interface PartnerTypeFixture {
    readonly $schema?: string;
    readonly id: string;
    readonly slug: string;
    readonly [key: string]: unknown;
}

/**
 * Turns a raw partner type fixture into the row payload to insert: drops the
 * seed-only keys (`$schema`, fixture `id`) and sets the deterministic `id`.
 *
 * Shared by the baseline seeder and the data-migration so the two cannot drift.
 *
 * @param data - Raw fixture item
 * @returns Row payload including the deterministic `id`
 */
export const normalizePartnerTypeSeedItem = (
    data: Record<string, unknown>
): Record<string, unknown> => {
    const { $schema, id, ...rest } = data as { $schema?: string; id?: string; slug: string };
    return { ...rest, id: partnerTypeIdFor({ slug: rest.slug }) };
};

const getEntityInfo = (item: unknown, _context: SeedContext): string => {
    const row = item as { slug: string; nameI18n?: { es?: string } };
    return `"${row.slug}" (${row.nameI18n?.es ?? row.slug})`;
};

/**
 * Seeds the partner type catalog (HOS-2336): Comercio, ONG, Institución, Medio
 * and Persona.
 *
 * Rows are inserted straight through the model with a deterministic id (the
 * factory's `deterministicId` path), so a fresh database and the data-migration
 * agree on every id. Re-runnable: a slug that already exists is skipped and an
 * admin's edits to it are never overwritten. Must run before the example
 * partners, which reference their type by this id.
 */
export const seedPartnerTypes = createSeedFactory({
    entityName: 'PartnerTypes',
    serviceClass: PartnerTypeService,
    folder: 'src/data/partnerType',
    files: requiredManifest.partnerTypes,
    existing: { modelClass: PartnerTypeModel, getWhere: whereFixtureSlug() },
    normalizer: normalizePartnerTypeSeedItem,
    deterministicId: {
        modelClass: PartnerTypeModel,
        getId: (item) => partnerTypeIdFor({ slug: (item as { slug: string }).slug })
    },
    getEntityInfo
});
