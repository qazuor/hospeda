import { AmenityService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';

/**
 * Seed factory for amenities
 *
 * Creates amenity records from JSON files. Keeps the slug: the service
 * requires it explicitly since SPEC-266 dropped name-based auto-generation.
 */
export const seedAmenities = createSeedFactory({
    entityName: 'Amenities',
    serviceClass: AmenityService,
    folder: 'src/data/amenity',
    files: requiredManifest.amenities,

    // Exclude metadata fields and name (dropped in SPEC-266 T-001). Keep slug —
    // the service now requires it explicitly (name-based auto-generation is gone).
    normalizer: (data) => {
        const { $schema, id, name, ...cleanData } = data as {
            $schema?: string;
            id?: string;
            name?: unknown;
            [key: string]: unknown;
        };

        return cleanData;
    },

    // Custom entity info for better logging
    // name was dropped in SPEC-266 T-001; use slug for display.
    getEntityInfo: (item, _context) => {
        const amenity = item as { slug?: string; type?: string };
        const typeInfo = amenity.type ? ` (${amenity.type})` : '';
        return `"${amenity.slug ?? 'unknown'}"${typeInfo}`;
    }
});
