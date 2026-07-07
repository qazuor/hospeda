import { AccommodationFaqModel, AccommodationMediaModel, AccommodationModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { AccommodationService, AmenityService, FeatureService } from '@repo/service-core/index.js';
import exampleManifest from '../manifest-example.json';
import {
    buildAccommodationMediaRows,
    type FixtureMediaBlock
} from '../utils/accommodation-media-builder.js';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';
import { createServiceRelationBuilder } from '../utils/serviceRelationBuilder.js';

/**
 * Normalizes accommodation data by removing metadata and auto-generated fields.
 *
 * Keeps `slug` (see HOS-25 T-016): every `example` accommodation is now created
 * via the deterministic-id, model-direct path (see `deterministicId` below),
 * which bypasses `AccommodationService._beforeCreate` — the hook that would
 * otherwise auto-generate a unique slug from `type` + `name`. Fixture slugs are
 * already curated and verified unique across the whole `example` dataset, so
 * passing them straight through is both safe and more readable than the
 * service's auto-generated `"type name"` slug.
 *
 * @param data - Raw accommodation data from JSON file
 * @returns Cleaned accommodation data ready for database insertion
 */
const accommodationNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const {
        $schema,
        id,
        tagIds,
        averageRating,
        amenityIds,
        featureIds,
        faqs,
        iaData,
        ...cleanData
    } = data as {
        $schema?: string;
        id?: string;
        slug?: string;
        tagIds?: unknown[];
        averageRating?: number;
        amenityIds?: string[];
        featureIds?: string[];
        faqs?: Array<{
            question: string;
            answer: string;
            category?: string;
        }>;
        iaData?: Array<{
            title: string;
            content: string;
            category?: string;
        }>;
        [key: string]: unknown;
    };
    return cleanData;
};

/**
 * Pre-processes accommodation data by mapping seed IDs to real database IDs.
 *
 * This function:
 * - Maps owner and destination IDs to real database IDs
 * - Sets up the actor context for the accommodation owner
 * - Ensures all required relationships exist before creation
 *
 * @param item - Accommodation item to pre-process
 * @param context - Seed context with ID mapper and actor
 * @throws {Error} When required ID mappings are not found
 */
const preProcessAccommodation = async (item: unknown, context: SeedContext) => {
    const accommodationData = item as Record<string, unknown>;

    // Map seed IDs to real database IDs using specific getters
    const seedOwnerId = accommodationData.ownerId as string;
    const seedDestinationId = accommodationData.destinationId as string;

    if (seedOwnerId) {
        const realOwnerId = context.idMapper.getMappedUserId(seedOwnerId);
        if (!realOwnerId) {
            throw new Error(`No mapping found for owner ID: ${seedOwnerId}`);
        }
        accommodationData.ownerId = realOwnerId;
    }

    if (seedDestinationId) {
        const realDestinationId = context.idMapper.getMappedDestinationId(seedDestinationId);
        if (!realDestinationId) {
            throw new Error(`No mapping found for destination ID: ${seedDestinationId}`);
        }
        accommodationData.destinationId = realDestinationId;
    }

    // Set the actor to be the owner of the accommodation
    if (seedOwnerId) {
        const realOwnerId = context.idMapper.getMappedUserId(seedOwnerId);
        if (realOwnerId) {
            // We need to get the user data to create the actor
            // For now, we'll use a basic actor structure
            // TODO: Get full user data from database if needed
            context.actor = {
                id: realOwnerId,
                role: RoleEnum.SUPER_ADMIN, // Default role, should be updated with actual user role
                permissions: [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                    PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
                    PermissionEnum.ACCOMMODATION_FEATURES_EDIT
                ] as PermissionEnum[] // Default permissions, should be updated with actual user permissions
            };
        }
    }
};

/**
 * Gets display information for an accommodation entity.
 *
 * @param item - Accommodation item
 * @returns Formatted string with accommodation name and type
 */
const getAccommodationInfo = (item: unknown) => {
    const accommodationData = item as Record<string, unknown>;
    const name = accommodationData.name as string;
    const type = accommodationData.type as string;
    return `"${name}" (${type})`;
};

/**
 * Derives the deterministic UUIDv5 id for an `example` accommodation fixture
 * (HOS-25 T-016), from the fixture's own top-level `id` seed-key.
 *
 * Exported (rather than an inline lambda) so tests can assert the id is
 * stable across calls without running the full seed pipeline.
 *
 * @param item - Raw accommodation fixture item (pre-normalization)
 * @returns Stable UUIDv5 derived from the fixture's seed-key
 */
export const getAccommodationFixtureId = (item: unknown): string =>
    deterministicFixtureId({
        seedKey: `accommodation:${(item as { id: string }).id}`
    });

/**
 * Derives the deterministic UUIDv5 id for a single FAQ belonging to an
 * `example` accommodation fixture (HOS-25 T-016).
 *
 * FAQs are child rows created outside the seed-factory's own item loop (see
 * the `relationBuilder` below), so `SeedFactoryConfig.deterministicId` does
 * not apply to them directly — this helper replicates the same
 * seed-key-derived-UUIDv5 pattern manually, keyed off the parent
 * accommodation's seed-key plus the FAQ's position in its fixture array
 * (FAQ fixtures have no `id` of their own).
 *
 * @param input - RO-RO input with the parent accommodation's seed-key and this FAQ's index
 * @returns Stable UUIDv5 derived from the FAQ's composite seed-key
 */
export const getAccommodationFaqFixtureId = (input: {
    accommodationSeedKey: string;
    index: number;
}): string =>
    deterministicFixtureId({
        seedKey: `accommodationFaq:${input.accommodationSeedKey}:${input.index}`
    });

/**
 * Seeds accommodations with their associated amenities, features, FAQs, and AI data.
 *
 * This seed factory creates accommodation entities and establishes
 * relationships with amenities, features, FAQs, and AI data using the service-based
 * relation builder.
 *
 * Features:
 * - Pre-processes data to map seed IDs to real database IDs
 * - Sets up proper actor context for accommodation owners
 * - Creates relationships with amenities and features
 * - Creates FAQs and AI data for each accommodation
 * - Provides progress tracking and detailed logging
 * - Handles all relationships in a single relation builder
 *
 * @example
 * ```typescript
 * await seedAccommodations(seedContext);
 * // Creates accommodations like:
 * // "Camping Retiro Encantado" (CAMPING) with amenities, features, FAQs, and AI data
 * // "Cabaña Paraíso Apacible" (CABIN) with amenities, features, FAQs, and AI data
 * ```
 */
export const seedAccommodations = createSeedFactory({
    entityName: 'Accommodations',
    serviceClass: AccommodationService,
    folder: 'src/data/accommodation',
    files: exampleManifest.accommodations,
    normalizer: accommodationNormalizer,
    preProcess: preProcessAccommodation,
    getEntityInfo: getAccommodationInfo,

    // HOS-25 T-016: every `example` accommodation gets a stable UUIDv5 derived
    // from its fixture seed-key, so versioned data-migrations can target a
    // specific accommodation by a fixed id. See the audit note on
    // `accommodationNormalizer` above for why this bypasses
    // `AccommodationService._beforeCreate` safely (slug is passed through from
    // the fixture instead of being service-generated).
    deterministicId: {
        modelClass: AccommodationModel,
        getId: getAccommodationFixtureId
    },

    // Custom relation builders for amenities, features, FAQs, and AI data
    relationBuilder: async (result: unknown, item: unknown, context: SeedContext) => {
        const accommodationId = (result as { data?: { id?: string } })?.data?.id;
        if (!accommodationId) {
            throw new Error('No accommodation ID found in result');
        }

        const accommodationData = item as Record<string, unknown>;
        const service = new AccommodationService({});

        // Build amenities relations
        const amenitiesBuilder = createServiceRelationBuilder({
            serviceClass: AmenityService,
            methodName: 'addAmenityToAccommodation',
            extractIds: (accommodation: unknown) =>
                (accommodation as { amenityIds?: string[] }).amenityIds || [],
            entityType: 'amenities',
            relationType: 'amenities',
            buildParams: (accommodationId: string, amenityId: string) => ({
                accommodationId,
                amenityId
            }),
            // Use accommodation info for main entity
            getMainEntityInfo: (accommodation: unknown) => {
                const acc = accommodation as { name: string; type: string };
                return `"${acc.name}" (${acc.type})`;
            },
            // Get amenity info for related entities
            getRelatedEntityInfo: (seedId: string, context: SeedContext) => {
                return context.idMapper.getDisplayName('amenities', seedId);
            }
        });

        // Build features relations
        const featuresBuilder = createServiceRelationBuilder({
            serviceClass: FeatureService,
            methodName: 'addFeatureToAccommodation',
            extractIds: (accommodation: unknown) =>
                (accommodation as { featureIds?: string[] }).featureIds || [],
            entityType: 'features',
            relationType: 'features',
            buildParams: (accommodationId: string, featureId: string) => ({
                accommodationId,
                featureId
            }),
            // Use accommodation info for main entity
            getMainEntityInfo: (accommodation: unknown) => {
                const acc = accommodation as { name: string; type: string };
                return `"${acc.name}" (${acc.type})`;
            },
            // Get feature info for related entities
            getRelatedEntityInfo: (seedId: string, context: SeedContext) => {
                return context.idMapper.getDisplayName('features', seedId);
            }
        });

        // Execute amenities and features relation builders
        await amenitiesBuilder(result, item, context);
        await featuresBuilder(result, item, context);

        // Create FAQs if they exist in the data
        const faqs = accommodationData.faqs as
            | Array<{
                  question: string;
                  answer: string;
                  category?: string;
              }>
            | undefined;

        if (faqs && faqs.length > 0) {
            const accommodationInfo = getAccommodationInfo(item);
            logger.info(`Creating ${faqs.length} FAQs for ${accommodationInfo}`);

            // HOS-25 T-016: FAQs are child rows created outside the seed-factory's
            // own item loop (they're not a top-level fixture with their own `id`),
            // so `SeedFactoryConfig.deterministicId` does not apply here directly.
            // We replicate the same model-direct pattern manually: a deterministic
            // id per FAQ (keyed off the parent accommodation's seed-key + index)
            // and an explicit `displayOrder` matching what
            // `AccommodationService.addFaq` would compute for a fresh entity
            // (`max(existing displayOrder) + 1`, starting at 0) — safe here
            // because every fixture accommodation starts with zero FAQs.
            const accommodationSeedKey = accommodationData.id as string;
            const faqModel = new AccommodationFaqModel();

            for (let i = 0; i < faqs.length; i++) {
                const faq = faqs[i];
                if (!faq) continue;

                try {
                    if (!context.actor) {
                        throw new Error('Actor not available in context');
                    }
                    await faqModel.create({
                        id: getAccommodationFaqFixtureId({
                            accommodationSeedKey,
                            index: i
                        }),
                        accommodationId,
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
        }

        // Create AI data if it exists in the data
        const iaData = accommodationData.iaData as
            | Array<{
                  title: string;
                  content: string;
                  category?: string;
              }>
            | undefined;

        if (iaData && iaData.length > 0) {
            const accommodationInfo = getAccommodationInfo(item);
            logger.info(`Creating ${iaData.length} AI data entries for ${accommodationInfo}`);

            for (let i = 0; i < iaData.length; i++) {
                const aiEntry = iaData[i];
                if (!aiEntry) continue;

                try {
                    if (!context.actor) {
                        throw new Error('Actor not available in context');
                    }
                    await service.addIAData(
                        {
                            accommodationId,
                            iaData: {
                                title: aiEntry.title,
                                content: aiEntry.content,
                                category: aiEntry.category
                            }
                        },
                        context.actor
                    );
                    logger.success({
                        msg: `[${i + 1} of ${iaData.length}] - Created AI data: "${aiEntry.title}"`
                    });
                } catch (error) {
                    const err = error as { code?: string; message?: string };
                    if (err.code === 'ALREADY_EXISTS') {
                        logger.info(
                            `[${i + 1} of ${iaData.length}] - AI data already exists: "${aiEntry.title}"`
                        );
                    } else {
                        logger.error(`Error creating AI data: ${err.message}`);
                        if (!context.continueOnError) {
                            throw error;
                        }
                    }
                }
            }
        }

        // Seed accommodation_media rows from fixture's media.featuredImage + media.gallery.
        // Videos remain in the JSONB blob (D1 design decision — do not touch media.videos).
        // Direct model insert is used instead of AccommodationService.addMedia because:
        //   1. We need explicit is_featured control (service always sets isFeatured=false).
        //   2. We avoid N+1 sortOrder queries — we compute the order inline.
        //   3. The service's _canUpdate permission gate is unnecessary overhead for seeding.
        const fixtureMedia = accommodationData.media as FixtureMediaBlock | undefined;
        if (
            fixtureMedia &&
            (fixtureMedia.featuredImage || (fixtureMedia.gallery?.length ?? 0) > 0)
        ) {
            const accommodationInfo = getAccommodationInfo(item);
            const mediaModel = new AccommodationMediaModel();

            // Idempotency guard: skip if rows already exist for this accommodation.
            // The seed assumes a fresh DB, but this guard protects against accidental re-runs.
            const { total: existingCount } = await mediaModel.findByAccommodation({
                accommodationId,
                pageSize: 1
            });

            if (existingCount > 0) {
                logger.info(
                    `Skipping media for ${accommodationInfo}: ${existingCount} rows already exist`
                );
            } else {
                const rows = buildAccommodationMediaRows({
                    accommodationId,
                    media: fixtureMedia
                });

                if (rows.length > 0) {
                    logger.info(`Creating ${rows.length} media rows for ${accommodationInfo}`);

                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row) continue;
                        try {
                            await mediaModel.create(row);
                            logger.success({
                                msg: `[${i + 1} of ${rows.length}] - Created media row (isFeatured=${row.isFeatured}, sortOrder=${row.sortOrder}): ${row.url}`
                            });
                        } catch (error) {
                            const err = error as { message?: string };
                            logger.error(`Error creating media row ${i + 1}: ${err.message}`);
                            if (!context.continueOnError) {
                                throw error;
                            }
                        }
                    }
                }
            }
        }
    }
});
