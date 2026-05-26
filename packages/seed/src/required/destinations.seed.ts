import { AttractionService, DestinationService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory, createServiceRelationBuilder } from '../utils/index.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';

/**
 * Seeds destinations with their associated attractions.
 *
 * This seed factory creates destination entities and establishes
 * relationships with attractions using the service-based relation builder.
 *
 * Features:
 * - Excludes metadata fields and auto-generated slugs
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

    // Resolve parentDestinationId from seed ID to real database UUID
    preProcess: async (item, context) => {
        const data = item as Record<string, unknown>;
        if (data.parentDestinationId && typeof data.parentDestinationId === 'string') {
            const realId = context.idMapper.getRealId(
                'destinations',
                data.parentDestinationId as string
            );
            if (realId) {
                data.parentDestinationId = realId;
            }
        }
    },

    // Exclude metadata fields and slug field as it's auto-generated
    normalizer: (data) => {
        // First exclude metadata fields
        const {
            $schema,
            id,
            slug,
            attractionIds,
            averageRating,
            accommodationsCount,
            // FAQs are a 1-to-N child relation, not a column — seeded via postProcess (SPEC-158)
            faqs,
            ...cleanData
        } = data as {
            $schema?: string;
            id?: string;
            slug?: string;
            attractionIds?: string[];
            averageRating?: number;
            accommodationsCount?: number;
            faqs?: Array<{ question: string; answer: string; category?: string }>;
            [key: string]: unknown;
        };

        return cleanData;
    },

    // Seed FAQs (SPEC-158): runs after the destination is created. Unlike the
    // accommodation factory, the destination FAQ loop forwards `category`.
    postProcess: async (result: unknown, item: unknown, context: SeedContext) => {
        const destinationId = (result as { data?: { id?: string } })?.data?.id;
        if (!destinationId) return;

        const data = item as {
            name?: string;
            faqs?: Array<{ question: string; answer: string; category?: string }>;
        };
        const faqs = data.faqs;
        if (!faqs || faqs.length === 0) return;

        const service = new DestinationService({});
        const info = data.name ?? destinationId;
        logger.info(`Creating ${faqs.length} FAQs for "${info}"`);

        for (let i = 0; i < faqs.length; i++) {
            const faq = faqs[i];
            if (!faq) continue;
            try {
                if (!context.actor) {
                    throw new Error('Actor not available in context');
                }
                await service.addFaq(context.actor, {
                    destinationId,
                    faq: {
                        question: faq.question,
                        answer: faq.answer,
                        category: faq.category ?? null
                    }
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

    // Custom relation builder for attractions using the generic factory
    relationBuilder: createServiceRelationBuilder({
        serviceClass: AttractionService,
        methodName: 'addAttractionToDestination',
        extractIds: (destination) =>
            (destination as { attractionIds?: string[] }).attractionIds || [],
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
    })
});
