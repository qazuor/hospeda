import { AmenityService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';

/**
 * Seed factory for amenities
 *
 * Creates amenity records from JSON files, preserving the slug field
 * from the JSON data so that snake_case slugs (e.g. "air_conditioning")
 * are stored exactly as defined. The service _beforeCreate hook only
 * auto-generates a slug when none is provided.
 */
export const seedAmenities = createSeedFactory({
    entityName: 'Amenities',
    serviceClass: AmenityService,
    folder: 'src/data/amenity',
    files: requiredManifest.amenities,

    // Exclude metadata fields but preserve slug so it is not re-generated
    // by the service (which would strip underscores via slugify strict mode).
    normalizer: (data) => {
        const { $schema, id, ...cleanData } = data as {
            $schema?: string;
            id?: string;
            slug?: string;
            [key: string]: unknown;
        };

        return cleanData;
    },

    // Custom entity info for better logging
    getEntityInfo: (item, _context) => {
        const amenity = item as { name: { es: string } | string; type?: string };
        const displayName = typeof amenity.name === 'object' ? amenity.name.es : amenity.name;
        const typeInfo = amenity.type ? ` (${amenity.type})` : '';
        return `"${displayName}"${typeInfo}`;
    }
});
