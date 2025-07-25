import { AttractionService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { STATUS_ICONS, createSeedFactory } from '../utils/index.js';

/**
 * Seed factory for attractions
 *
 * Creates attraction records from JSON files, excluding the slug field
 * since it's auto-generated by the service lifecycle hooks.
 */
export const seedAttractions = createSeedFactory({
    entityName: 'Attractions',
    serviceClass: AttractionService,
    folder: 'src/data/attraction',
    files: requiredManifest.attractions,

    // Exclude metadata fields and slug field as it's auto-generated
    normalizer: (data) => {
        // First exclude metadata fields and auto-generated fields
        const { $schema, id, slug, lifecycleState, tagIds, ...cleanData } = data as {
            $schema?: string;
            id?: string;
            slug?: string;
            lifecycleState?: string;
            tagIds?: unknown[];
            [key: string]: unknown;
        };

        return cleanData;
    },

    // Custom entity info for better logging
    getEntityInfo: (item, _context) => {
        const attraction = item as { name: string; isBuiltin?: boolean };
        const builtinIcon = attraction.isBuiltin ? ` ${STATUS_ICONS.BuiltIn}` : '';
        return `"${attraction.name}"${builtinIcon}`;
    }
});
