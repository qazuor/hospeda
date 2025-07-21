import { AttractionService, DestinationService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';

/**
 * Seed factory for destinations
 *
 * Creates destination records from JSON files and establishes relationships
 * with attractions after creation.
 *
 * TODO: Migrate to factory system once ServiceConstructor types are compatible
 */
export const seedDestinations = createSeedFactory({
    entityName: 'Destinations',
    serviceClass: DestinationService,
    folder: 'src/data/destination',
    files: requiredManifest.destinations,

    // Exclude metadata fields and slug field as it's auto-generated
    normalizer: (data) => {
        // First exclude metadata fields and auto-generated fields
        const { $schema, id, slug, tagIds, averageRating, accommodationsCount, ...cleanData } =
            data as {
                $schema?: string;
                id?: string;
                slug?: string;
                tagIds?: unknown[];
                averageRating?: number;
                accommodationsCount?: number;
                [key: string]: unknown;
            };

        return cleanData;
    },

    // Custom entity info for better logging
    getEntityInfo: (item) => {
        const destination = item as {
            name: string;
            location?: { city?: string; country?: string };
        };
        const location = destination.location;
        const locationInfo = location
            ? ` (${location.city || 'Unknown'}, ${location.country || 'Unknown'})`
            : '';
        return ` "${destination.name}"${locationInfo}`;
    },

    // Custom relation builder for attractions
    relationBuilder: async (result, item, context) => {
        const destinationId = (result as { data?: { id?: string } })?.data?.id;
        if (!destinationId) return;

        const seedAttractionIds = (item as { attractions?: string[] }).attractions || [];
        if (seedAttractionIds.length === 0) return;

        const attractionService = new AttractionService({});
        const actor = context.actor;
        if (!actor) {
            throw new Error('Actor not available in context');
        }

        // Create relationships for each attraction
        for (const seedId of seedAttractionIds) {
            const realId = context.idMapper.getRealId('attractions', seedId);
            if (realId) {
                try {
                    await attractionService.addAttractionToDestination(actor, {
                        destinationId,
                        attractionId: realId
                    });
                } catch (error: unknown) {
                    const err = error as { code?: string; message?: string };

                    if (err.code === 'ALREADY_EXISTS') {
                        // Relationship already exists, this is fine
                        continue;
                    }

                    const errorMessage = `❌ Failed to create attraction relationship: ${err.message}`;

                    if (context.continueOnError) {
                        console.warn(`⚠️ ${errorMessage}`);
                    } else {
                        throw new Error(errorMessage);
                    }
                }
            } else {
                console.warn(`⚠️ No mapping found for attraction ${seedId}`);
            }
        }
    }
});
