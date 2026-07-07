import { EventLocationModel } from '@repo/db';
import { EventLocationService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Derives the deterministic UUIDv5 id for an `example` event location fixture
 * (HOS-25 T-025), from the fixture's own top-level `id` seed-key.
 *
 * `EventLocationService._beforeCreate` only performs a read-only validation
 * (that `destinationId` references a CITY-typed destination) — no computed
 * field is lost by bypassing it, and curated fixtures are trusted to already
 * reference valid CITY destinations.
 *
 * @param item - Raw event location fixture item (pre-normalization)
 * @returns Stable UUIDv5 derived from the fixture's seed-key
 */
export const getEventLocationFixtureId = (item: unknown): string =>
    deterministicFixtureId({
        seedKey: `eventLocation:${(item as { id: string }).id}`
    });

/**
 * Normalizer for event location data.
 *
 * Post SPEC-095, eventLocation rows hold only postal address + a `destinationId`
 * FK to a CITY-typed destination. Geographic context (city/state/country) is
 * derived from the relation.
 */
const eventLocationNormalizer = (data: Record<string, unknown>) => {
    return {
        slug: data.slug as string,
        destinationId: data.destinationId as string,
        street: data.street as string,
        number: data.number as string,
        floor: data.floor as string,
        apartment: data.apartment as string,
        coordinates: data.coordinates,
        placeName: data.placeName as string,
        lifecycleState: data.lifecycleState
    };
};

/**
 * Pre-processes event location data by mapping the seed `destinationId` to its
 * real database UUID via the seed context's id mapper.
 */
const preProcessEventLocation = async (item: unknown, context: SeedContext) => {
    const locationData = item as Record<string, unknown>;
    const seedDestinationId = locationData.destinationId as string | undefined;
    if (!seedDestinationId) {
        throw new Error(
            `EventLocation seed missing destinationId: ${(locationData.id as string) ?? 'unknown'}`
        );
    }
    const realDestinationId = context.idMapper.getMappedDestinationId(seedDestinationId);
    if (!realDestinationId) {
        throw new Error(`No mapping found for destination ID: ${seedDestinationId}`);
    }
    locationData.destinationId = realDestinationId;
};

/**
 * Get entity info for event location.
 */
const getEventLocationInfo = (item: unknown, _context: SeedContext) => {
    const locationData = item as Record<string, unknown>;
    const placeName = locationData.placeName as string;
    return `"${placeName}"`;
};

/**
 * EventLocations seed using Seed Factory.
 */
export const seedEventLocations = createSeedFactory({
    entityName: 'EventLocations',
    serviceClass: EventLocationService,
    folder: 'src/data/eventLocation',
    files: exampleManifest.eventLocations,
    normalizer: eventLocationNormalizer,
    preProcess: preProcessEventLocation,
    getEntityInfo: getEventLocationInfo,

    // HOS-25 T-025: every `example` event location gets a stable UUIDv5
    // derived from its fixture seed-key, so versioned data-migrations can
    // target a specific location by a fixed id. See `getEventLocationFixtureId`
    // above for why this bypasses `EventLocationService._beforeCreate` safely.
    deterministicId: {
        modelClass: EventLocationModel,
        getId: getEventLocationFixtureId
    }
});
