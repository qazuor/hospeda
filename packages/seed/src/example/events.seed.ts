import path from 'node:path';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for event data
 */
const eventNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, slug, tagIds, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        slug?: string;
        tagIds?: unknown[];
        [key: string]: unknown;
    };
    return cleanData;
};

/**
 * Get entity info for event
 */
const getEventInfo = (item: unknown) => {
    const eventData = item as Record<string, unknown>;
    const name = eventData.name as string;
    const category = eventData.category as string;
    return `"${name}" (${category})`;
};

/**
 * Pre-process callback to map IDs and set correct actor
 */
const preProcessEvent = async (item: unknown, context: SeedContext) => {
    const eventData = item as Record<string, unknown>;

    // Map seed IDs to real database IDs using specific getters
    const seedAuthorId = eventData.authorId as string;
    const seedEventOrganizerId = eventData.organizerId as string;
    const seedEventLocationId = eventData.locationId as string;

    if (seedAuthorId) {
        const realAuthorId = context.idMapper.getMappedUserId(seedAuthorId);
        if (!realAuthorId) {
            throw new Error(`No mapping found for owner ID: ${seedAuthorId}`);
        }
        eventData.authorId = realAuthorId;
    }

    if (seedEventOrganizerId) {
        const realEventOrganizerId =
            context.idMapper.getMappedEventOrganizerId(seedEventOrganizerId);
        if (!realEventOrganizerId) {
            throw new Error(`No mapping found for event organizer ID: ${seedEventOrganizerId}`);
        }
        eventData.organizerId = realEventOrganizerId;
    }

    if (seedEventLocationId) {
        const realEventLocationId = context.idMapper.getMappedEventLocationId(seedEventLocationId);
        if (!realEventLocationId) {
            throw new Error(`No mapping found for event location ID: ${seedEventLocationId}`);
        }
        eventData.locationId = realEventLocationId;
    }

    // Set the actor to be the owner of the accommodation
    if (seedAuthorId) {
        const realAuthorId = context.idMapper.getMappedUserId(seedAuthorId);
        if (realAuthorId) {
            // We need to get the user data to create the actor
            // For now, we'll use a basic actor structure
            // TODO: Get full user data from database if needed
            context.actor = {
                id: realAuthorId,
                role: RoleEnum.SUPER_ADMIN, // Default role, should be updated with actual user role
                permissions: [
                    PermissionEnum.EVENT_CREATE,
                    PermissionEnum.EVENT_UPDATE
                ] as PermissionEnum[] // Default permissions, should be updated with actual user permissions
            };
        }
    }
};

/**
 * Events seed using Seed Factory
 */
export const seedEvents = createSeedFactory({
    entityName: 'Events',
    serviceClass: EventService,
    folder: path.resolve('src/data/event'),
    files: exampleManifest.events,
    normalizer: eventNormalizer,
    preProcess: preProcessEvent,
    getEntityInfo: getEventInfo
});
