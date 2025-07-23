import { AttractionService, DestinationService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory, createServiceRelationBuilder } from '../utils/index.js';

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
            ...cleanData
        } = data as {
            $schema?: string;
            id?: string;
            slug?: string;
            attractionIds?: string[];
            averageRating?: number;
            accommodationsCount?: number;
            [key: string]: unknown;
        };

        return cleanData;
    },

    // Custom entity info for better logging
    getEntityInfo: (item) => {
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
            const cityInfo = dest.location?.city ? ` (${dest.location.city})` : '';
            return `"${dest.name}"${cityInfo}`;
        },
        // Get attraction info for related entities
        getRelatedEntityInfo: (seedId, context) => {
            return context.idMapper.getDisplayName('attractions', seedId);
        }
    })
});
