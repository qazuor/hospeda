import { DestinationFaqModel, DestinationModel } from '@repo/db';
import type { DestinationType } from '@repo/schemas';
import {
    AttractionService,
    computeHierarchyLevel,
    computeHierarchyPath,
    computeHierarchyPathIds,
    DestinationService,
    isValidParentChildRelation,
    PointOfInterestService
} from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import { createSeedFactory, createServiceRelationBuilder } from '../utils/index.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';

/**
 * Derives the deterministic UUIDv5 id for a `required` destination fixture
 * (HOS-25 T-025), from the fixture's own top-level `id` seed-key.
 *
 * Exported (rather than an inline lambda) so tests can assert the id is
 * stable across calls without running the full seed pipeline, mirroring
 * `getAccommodationFixtureId` in `example/accommodations.seed.ts` (HOS-25 T-016).
 *
 * @param item - Raw destination fixture item (pre-normalization)
 * @returns Stable UUIDv5 derived from the fixture's seed-key
 */
export const getDestinationFixtureId = (item: unknown): string =>
    deterministicFixtureId({
        seedKey: `destination:${(item as { id: string }).id}`
    });

/**
 * Derives the deterministic UUIDv5 id for a single FAQ belonging to a
 * `required` destination fixture (HOS-25 T-025).
 *
 * FAQs are child rows created outside the seed-factory's own item loop (see
 * the `postProcess` hook below), so `SeedFactoryConfig.deterministicId` does
 * not apply to them directly — this mirrors `getAccommodationFaqFixtureId` in
 * `example/accommodations.seed.ts`: a seed-key-derived UUIDv5, keyed off the
 * parent destination's seed-key plus the FAQ's position in its fixture array
 * (FAQ fixtures have no `id` of their own).
 *
 * @param input - RO-RO input with the parent destination's seed-key and this FAQ's index
 * @returns Stable UUIDv5 derived from the FAQ's composite seed-key
 */
export const getDestinationFaqFixtureId = (input: {
    destinationSeedKey: string;
    index: number;
}): string =>
    deterministicFixtureId({
        seedKey: `destinationFaq:${input.destinationSeedKey}:${input.index}`
    });

/**
 * Computed hierarchy fields for a single destination, cached by its SEED id
 * (the fixture's own `id` string, e.g. `"103-destination-departamento-uruguay"`)
 * — NOT its real/deterministic UUID.
 */
interface HierarchyCacheEntry {
    /** The destination's deterministic (real) UUID. */
    readonly id: string;
    readonly level: number;
    readonly path: string;
    readonly pathIds: string;
    readonly destinationType: DestinationType;
}

/**
 * In-memory cache of computed hierarchy fields, populated as each destination
 * is pre-processed. `manifest-required.json` lists destinations root-first
 * (COUNTRY → REGION → PROVINCE → DEPARTMENT → CITY — see the seed data
 * layout doc in `packages/seed/CLAUDE.md`), so by the time a child
 * destination is pre-processed, its parent's entry is already present here —
 * no DB round-trip is needed to read the parent's `level`/`path`/`pathIds`.
 *
 * Run-scoped by convention: the seed runs once per process, and entries are
 * keyed by stable seed id with deterministic values, so re-population is
 * idempotent. A long-lived process that pre-processes multiple independent
 * destination datasets (e.g. a multi-run test suite) should call
 * {@link resetDestinationHierarchyCache} between runs to avoid a stale parent
 * entry from a previous dataset masking a manifest-ordering bug in the next.
 */
const hierarchyBySeedId = new Map<string, HierarchyCacheEntry>();

/**
 * Clears the in-memory hierarchy cache. Call between independent
 * pre-processing runs in the same process (e.g. between test cases that drive
 * {@link preProcessDestination} directly). No-op for the normal single-run seed.
 */
export const resetDestinationHierarchyCache = (): void => {
    hierarchyBySeedId.clear();
};

/**
 * Pre-processes destination data: resolves `parentDestinationId` (a seed id)
 * to the parent's real (deterministic) UUID, validates the parent-child type
 * relationship, and computes this destination's own `level`/`path`/`pathIds`
 * hierarchy fields.
 *
 * HOS-25 T-025: every `required` destination fixture now gets a stable
 * UUIDv5 id (see `deterministicId` below), which bypasses
 * `DestinationService._beforeCreate` — the hook that would otherwise compute
 * these same hierarchy fields from the parent's live DB row. This function
 * reuses the exact same pure computation helpers
 * (`computeHierarchyLevel`/`computeHierarchyPath`/`computeHierarchyPathIds`/
 * `isValidParentChildRelation`, exported from `@repo/service-core`) rather
 * than re-implementing the hierarchy math, and resolves the parent's
 * already-computed fields from `hierarchyBySeedId` instead of querying the
 * DB — both the parent and child destinations are, after all, plain
 * deterministic functions of their own fixture data.
 *
 * Exported (rather than a module-private lambda) so tests can drive it
 * directly against real fixture files, in real manifest order, without
 * running the full seed pipeline against a database — mirrors why
 * `getDestinationFixtureId` is exported above.
 *
 * @param item - Destination item to pre-process (mutated in place)
 * @throws {Error} When the parent destination has not been processed yet (manifest ordering bug), or when the parent-child type relationship is invalid
 */
export const preProcessDestination = async (item: unknown, _context: SeedContext) => {
    const data = item as Record<string, unknown> & {
        id: string;
        slug: string;
        destinationType: DestinationType;
        parentDestinationId?: string;
    };

    const ownId = getDestinationFixtureId(data);
    let parentInfo: HierarchyCacheEntry | undefined;

    if (data.parentDestinationId && typeof data.parentDestinationId === 'string') {
        const seedParentId = data.parentDestinationId;
        parentInfo = hierarchyBySeedId.get(seedParentId);
        if (!parentInfo) {
            throw new Error(
                `Destination hierarchy: parent "${seedParentId}" for "${data.id}" has not been ` +
                    'processed yet. Ensure manifest-required.json lists parent destinations before their children.'
            );
        }

        if (
            !isValidParentChildRelation({
                parentType: parentInfo.destinationType,
                childType: data.destinationType
            })
        ) {
            throw new Error(
                `Invalid parent-child relationship for "${data.id}": ` +
                    `${parentInfo.destinationType} cannot be parent of ${data.destinationType}`
            );
        }

        // Resolve the seed reference to the parent's real (deterministic) UUID
        // for the FK column.
        data.parentDestinationId = parentInfo.id;
    }

    const level = computeHierarchyLevel({ parentLevel: parentInfo?.level ?? null });
    const path = computeHierarchyPath({ parentPath: parentInfo?.path ?? null, slug: data.slug });
    const pathIds = computeHierarchyPathIds({
        parentPathIds: parentInfo?.pathIds ?? null,
        parentId: parentInfo?.id ?? null
    });

    data.level = level;
    data.path = path;
    data.pathIds = pathIds;

    hierarchyBySeedId.set(data.id, {
        id: ownId,
        level,
        path,
        pathIds,
        destinationType: data.destinationType
    });
};

/**
 * Seeds destinations with their associated attractions.
 *
 * This seed factory creates destination entities and establishes
 * relationships with attractions using the service-based relation builder.
 *
 * Features:
 * - Excludes metadata fields (curated `slug` is kept — see HOS-25 T-025 note below)
 * - Provides custom entity information for better logging
 * - Uses generic service relation builder for attractions
 * - Supports progress tracking and error handling
 *
 * @example
 * ```typescript
 * await seedDestinations(seedContext);
 * // Creates destinations like:
 * // "Colón" (Entre Ríos) with attractions
 * // "Federación" (Entre Ríos) with attractions
 * ```
 */
export const seedDestinations = createSeedFactory({
    entityName: 'Destinations',
    serviceClass: DestinationService,
    folder: 'src/data/destination',
    files: requiredManifest.destinations,

    preProcess: preProcessDestination,

    // Exclude metadata fields. Keeps `slug` (see HOS-25 T-025): every
    // `required` destination is now created via the deterministic-id,
    // model-direct path (see `deterministicId` below), which bypasses
    // `DestinationService._beforeCreate` — the hook that would otherwise
    // auto-generate a slug via `generateDestinationSlug(name)`. Fixture slugs
    // are already curated and verified unique across the whole destination
    // dataset (see `preProcessDestination` above for the same reasoning
    // applied to `level`/`path`/`pathIds`), so passing them straight through
    // is both safe and more readable than a service-generated slug.
    normalizer: (data) => {
        const {
            $schema,
            id,
            attractionIds,
            // HOS-113: destination↔POI M2M relation ids, built via the
            // relationBuilder below (postProcess-equivalent step) — not a
            // column on the destinations table.
            pointOfInterestIds,
            averageRating,
            accommodationsCount,
            // FAQs are a 1-to-N child relation, not a column — seeded via postProcess (SPEC-158)
            faqs,
            ...cleanData
        } = data as {
            $schema?: string;
            id?: string;
            attractionIds?: string[];
            pointOfInterestIds?: string[];
            averageRating?: number;
            accommodationsCount?: number;
            faqs?: Array<{ question: string; answer: string; category?: string }>;
            [key: string]: unknown;
        };

        return cleanData;
    },

    // HOS-25 T-025: every `required` destination gets a stable UUIDv5 derived
    // from its fixture seed-key, so versioned data-migrations can target a
    // specific destination by a fixed id. See the audit note on the
    // `normalizer` above for why this bypasses `DestinationService
    // ._beforeCreate` safely (slug/level/path/pathIds are all passed through
    // from the fixture / `preProcessDestination` instead of being computed
    // by the service).
    deterministicId: {
        modelClass: DestinationModel,
        getId: getDestinationFixtureId
    },

    // Seed FAQs (SPEC-158, HOS-25 T-025): runs after the destination is
    // created. Unlike the pre-T-025 implementation (which called
    // `DestinationService.addFaq()`), FAQs are now model-direct inserted with
    // a deterministic id — mirroring `getAccommodationFaqFixtureId` in
    // `example/accommodations.seed.ts`. Safe because every fixture
    // destination starts with zero FAQs, so `displayOrder = i` matches what
    // `addFaq()` would have computed for a fresh entity (`max(existing) + 1`,
    // starting at 0).
    postProcess: async (result: unknown, item: unknown, context: SeedContext) => {
        const destinationId = (result as { data?: { id?: string } })?.data?.id;
        if (!destinationId) return;

        const data = item as {
            id: string;
            name?: string;
            faqs?: Array<{ question: string; answer: string; category?: string }>;
        };
        const faqs = data.faqs;
        if (!faqs || faqs.length === 0) return;

        const info = data.name ?? destinationId;
        logger.info(`Creating ${faqs.length} FAQs for "${info}"`);

        const destinationSeedKey = data.id;
        const faqModel = new DestinationFaqModel();

        for (let i = 0; i < faqs.length; i++) {
            const faq = faqs[i];
            if (!faq) continue;

            try {
                if (!context.actor) {
                    throw new Error('Actor not available in context');
                }
                await faqModel.create({
                    id: getDestinationFaqFixtureId({ destinationSeedKey, index: i }),
                    destinationId,
                    question: faq.question,
                    answer: faq.answer,
                    category: faq.category ?? null,
                    displayOrder: i,
                    createdById: context.actor.id,
                    updatedById: context.actor.id
                });
                logger.success({
                    msg: `[${i + 1} of ${faqs.length}] - Created FAQ: "${faq.question}"`
                });
            } catch (error) {
                const err = error as { code?: string; message?: string };
                if (err.code === 'ALREADY_EXISTS') {
                    logger.info(
                        `[${i + 1} of ${faqs.length}] - FAQ already exists: "${faq.question}"`
                    );
                } else {
                    logger.error(`Error creating FAQ: ${err.message}`);
                    if (!context.continueOnError) {
                        throw error;
                    }
                }
            }
        }
    },

    // Custom entity info for better logging
    getEntityInfo: (item, _context) => {
        const destination = item as { name: string; location?: { city?: string } };
        const cityInfo = destination.location?.city ? ` (${destination.location.city})` : '';
        return `"${destination.name}"${cityInfo}`;
    },

    // Relation builder for attractions, using the generic factory.
    relationBuilder: buildDestinationRelations
});

/**
 * Relation builder for attractions (destination ↔ attraction M2M).
 * Extracted to a named const (rather than inline) so it can be composed with
 * {@link pointOfInterestRelationBuilder} below — `SeedFactoryConfig` only
 * accepts a single `relationBuilder` function per entity.
 */
const attractionRelationBuilder = createServiceRelationBuilder({
    serviceClass: AttractionService,
    methodName: 'addAttractionToDestination',
    extractIds: (destination) => (destination as { attractionIds?: string[] }).attractionIds || [],
    entityType: 'attractions',
    relationType: 'attractions',
    buildParams: (destinationId, attractionId) => ({
        destinationId,
        attractionId
    }),
    // Use the same getEntityInfo for main entity
    getMainEntityInfo: (destination) => {
        const dest = destination as { name: string; location?: { city?: string } };
        return `"${dest.name}"`;
    },
    // Get attraction info for related entities
    getRelatedEntityInfo: (seedId, context) => {
        return context.idMapper.getDisplayName('attractions', seedId);
    }
});

/**
 * Relation builder for points of interest (destination ↔ POI M2M, HOS-113
 * OQ-1). Mirrors {@link attractionRelationBuilder} exactly, targeting
 * `PointOfInterestService.addPointOfInterestToDestination` and the
 * `pointOfInterestIds` fixture array instead of `attractionIds`.
 */
const pointOfInterestRelationBuilder = createServiceRelationBuilder({
    serviceClass: PointOfInterestService,
    methodName: 'addPointOfInterestToDestination',
    extractIds: (destination) =>
        (destination as { pointOfInterestIds?: string[] }).pointOfInterestIds || [],
    entityType: 'pointsOfInterest',
    relationType: 'pointsOfInterest',
    buildParams: (destinationId, pointOfInterestId) => ({
        destinationId,
        pointOfInterestId
    }),
    getMainEntityInfo: (destination) => {
        const dest = destination as { name: string; location?: { city?: string } };
        return `"${dest.name}"`;
    },
    getRelatedEntityInfo: (seedId, context) => {
        return context.idMapper.getDisplayName('pointsOfInterest', seedId);
    }
});

/**
 * Combined relation builder run by the destinations seed factory: builds
 * both the destination↔attraction and destination↔POI (HOS-113 T-026)
 * relations for each destination, in sequence. `createSeedFactory` only
 * invokes a single `relationBuilder` callback per entity, so both concerns
 * are composed here rather than each being registered independently.
 *
 * @param result - The seed factory's create-result for this destination
 * @param item - The raw (pre-normalization) destination fixture item
 * @param context - Seed context (id mapper, actor, logger, ...)
 */
async function buildDestinationRelations(
    result: unknown,
    item: unknown,
    context: SeedContext
): Promise<void> {
    await attractionRelationBuilder(result, item, context);
    await pointOfInterestRelationBuilder(result, item, context);
}
