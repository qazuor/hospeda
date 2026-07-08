import { EventOrganizerModel } from '@repo/db';
import { EventOrganizerService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Derives the deterministic UUIDv5 id for an `example` event organizer
 * fixture (HOS-25 T-025), from the fixture's own top-level `id` seed-key.
 *
 * `EventOrganizerService` has no `_beforeCreate`/`_afterCreate` hooks at all,
 * so bypassing `service.create()` loses nothing beyond the standard
 * permission check.
 *
 * @param item - Raw event organizer fixture item (pre-normalization)
 * @returns Stable UUIDv5 derived from the fixture's seed-key
 */
export const getEventOrganizerFixtureId = (item: unknown): string =>
    deterministicFixtureId({
        seedKey: `eventOrganizer:${(item as { id: string }).id}`
    });

/**
 * Normalizer for event organizer data
 */
const eventOrganizerNormalizer = (data: Record<string, unknown>) => {
    return {
        name: data.name as string,
        slug: data.slug as string,
        logo: data.logo as string,
        contactInfo: data.contactInfo,
        socialNetworks: data.socialNetworks,
        lifecycleState: data.lifecycleState
    };
};

/**
 * Get entity info for event organizer
 */
const getEventOrganizerInfo = (item: unknown) => {
    const organizerData = item as Record<string, unknown>;
    const name = organizerData.name as string;
    return `"${name}"`;
};

/**
 * EventOrganizers seed using Seed Factory
 */
export const seedEventOrganizers = createSeedFactory({
    entityName: 'EventOrganizers',
    serviceClass: EventOrganizerService,
    folder: 'src/data/eventOrganizer',
    files: exampleManifest.eventOrganizers,
    normalizer: eventOrganizerNormalizer,
    getEntityInfo: getEventOrganizerInfo,

    // HOS-25 T-025: every `example` event organizer gets a stable UUIDv5
    // derived from its fixture seed-key, so versioned data-migrations can
    // target a specific organizer by a fixed id.
    deterministicId: {
        modelClass: EventOrganizerModel,
        getId: getEventOrganizerFixtureId
    }
});
