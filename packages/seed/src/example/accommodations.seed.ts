import path from 'node:path';
import { AccommodationService, AmenityService, FeatureService } from '@repo/service-core/index.js';
import { PermissionEnum, RoleEnum } from '@repo/types';
import exampleManifest from '../manifest-example.json';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';
import { createServiceRelationBuilder } from '../utils/serviceRelationBuilder.js';

/**
 * Normalizes accommodation data by removing metadata and auto-generated fields.
 *
 * @param data - Raw accommodation data from JSON file
 * @returns Cleaned accommodation data ready for database insertion
 */
const accommodationNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const {
        $schema,
        id,
        slug,
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
    folder: path.resolve('src/data/accommodation'),
    files: exampleManifest.accommodations,
    normalizer: accommodationNormalizer,
    preProcess: preProcessAccommodation,
    getEntityInfo: getAccommodationInfo,

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

            for (let i = 0; i < faqs.length; i++) {
                const faq = faqs[i];
                if (!faq) continue;

                try {
                    if (!context.actor) {
                        throw new Error('Actor not available in context');
                    }
                    await service.addFaq(context.actor, {
                        accommodationId,
                        faq: {
                            question: faq.question,
                            answer: faq.answer,
                            category: faq.category,
                            accommodationId
                        }
                    });
                    logger.success(`[${i + 1} of ${faqs.length}] - Created FAQ: "${faq.question}"`);
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
                                category: aiEntry.category,
                                accommodationId
                            }
                        },
                        context.actor
                    );
                    logger.success(
                        `[${i + 1} of ${iaData.length}] - Created AI data: "${aiEntry.title}"`
                    );
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
    }
});
