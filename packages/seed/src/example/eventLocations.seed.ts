import path from 'node:path';
import { EventLocationService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for event location data
 */
const eventLocationNormalizer = (data: Record<string, unknown>) => {
    return {
        state: data.state as string,
        city: data.city as string,
        country: data.country as string,
        zipCode: data.zipCode as string,
        street: data.street as string,
        number: data.number as string,
        neighborhood: data.neighborhood as string,
        coordinates: data.coordinates,
        placeName: data.placeName as string,
        lifecycleState: data.lifecycleState
    };
};

/**
 * Get entity info for event location
 */
const getEventLocationInfo = (item: unknown, _context: SeedContext) => {
    const locationData = item as Record<string, unknown>;
    const placeName = locationData.placeName as string;
    const city = locationData.city as string;
    return `"${placeName}" (${city})`;
};

/**
 * EventLocations seed using Seed Factory
 */
export const seedEventLocations = createSeedFactory({
    entityName: 'EventLocations',
    serviceClass: EventLocationService,
    folder: path.resolve('src/data/eventLocation'),
    files: exampleManifest.eventLocations,
    normalizer: eventLocationNormalizer,
    getEntityInfo: getEventLocationInfo
});
