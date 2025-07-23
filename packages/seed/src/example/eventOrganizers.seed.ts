import path from 'node:path';
import { EventOrganizerService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for event organizer data
 */
const eventOrganizerNormalizer = (data: Record<string, unknown>) => {
    return {
        name: data.name as string,
        logo: data.logo as string,
        contactInfo: data.contactInfo,
        social: data.social,
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
    folder: path.resolve('src/data/eventOrganizer'),
    files: exampleManifest.eventOrganizers,
    normalizer: eventOrganizerNormalizer,
    getEntityInfo: getEventOrganizerInfo
});
