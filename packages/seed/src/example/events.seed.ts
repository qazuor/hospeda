import { EventModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for event data.
 *
 * Keeps `slug` (see HOS-25 T-016): every `example` event is now created via
 * the deterministic-id, model-direct path (see `deterministicId` below),
 * which bypasses `EventService._beforeCreate` — the hook that would otherwise
 * auto-generate a unique slug from `category` + `name` + `date.start`.
 * Fixture slugs are already curated and verified unique across the whole
 * `example` dataset, so passing them straight through is safe.
 */
const eventNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, tagIds, ...cleanData } = data as {
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
 * Derives the deterministic UUIDv5 id for an `example` event fixture
 * (HOS-25 T-016), from the fixture's own top-level `id` seed-key.
 *
 * Exported (rather than an inline lambda) so tests can assert the id is
 * stable across calls without running the full seed pipeline.
 *
 * @param item - Raw event fixture item (pre-normalization)
 * @returns Stable UUIDv5 derived from the fixture's seed-key
 */
export const getEventFixtureId = (item: unknown): string =>
    deterministicFixtureId({
        seedKey: `event:${(item as { id: string }).id}`
    });

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
    folder: 'src/data/event',
    files: exampleManifest.events,
    normalizer: eventNormalizer,
    preProcess: preProcessEvent,
    getEntityInfo: getEventInfo,

    // HOS-25 T-016: every `example` event gets a stable UUIDv5 derived from its
    // fixture seed-key, so versioned data-migrations can target a specific
    // event by a fixed id. See the audit note on `eventNormalizer` above for
    // why this bypasses `EventService._beforeCreate` safely.
    deterministicId: {
        modelClass: EventModel,
        getId: getEventFixtureId
    }
});
