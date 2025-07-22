import path from 'node:path';
import { AccommodationService } from '@repo/service-core/index.js';
import exampleManifest from '../manifest-example.json';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for accommodation data
 */
const accommodationNormalizer = (data: Record<string, unknown>) => {
    return {
        slug: data.slug as string,
        name: data.name as string,
        summary: data.summary as string,
        description: data.description as string,
        type: data.type,
        price: data.price,
        capacity: data.capacity,
        amenities: data.amenities,
        features: data.features,
        location: data.location,
        media: data.media,
        seo: data.seo,
        destinationId: data.destinationId,
        ownerId: data.ownerId,
        visibility: data.visibility,
        lifecycleState: data.lifecycleState
    };
};

/**
 * Get entity info for accommodation
 */
const getAccommodationInfo = (item: unknown) => {
    const accommodationData = item as Record<string, unknown>;
    const name = accommodationData.name as string;
    const type = accommodationData.type as string;
    return `"${name}" (${type})`;
};

/**
 * Accommodations seed using Seed Factory
 */
export const seedAccommodations = createSeedFactory({
    entityName: 'Accommodations',
    serviceClass: AccommodationService,
    folder: path.resolve('src/data/accommodation'),
    files: exampleManifest.accommodations,
    normalizer: accommodationNormalizer,
    getEntityInfo: getAccommodationInfo
});
