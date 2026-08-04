/**
 * Entity Fetchers Registration
 * Registers entity fetchers for ownership middleware
 */
import {
    AccommodationService,
    EventLocationService,
    EventOrganizerService,
    EventService
} from '@repo/service-core';
import { registerEntityFetcher } from '../middlewares/ownership';
import { apiLogger } from './logger';

// Create service instances
const accommodationService = new AccommodationService({ logger: apiLogger });
const eventService = new EventService({ logger: apiLogger });
const eventLocationService = new EventLocationService({ logger: apiLogger });
const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * Register all entity fetchers for ownership middleware
 * This function should be called during app initialization
 */
export const registerEntityFetchers = (): void => {
    // Accommodation
    registerEntityFetcher('accommodation', async (actor, entityId) => {
        const result = await accommodationService.getById(actor, entityId);
        return {
            data: result.data as {
                id: string;
                ownerId?: string | null;
                createdById?: string | null;
            } | null,
            error: result.error
        };
    });

    // Event
    registerEntityFetcher('event', async (actor, entityId) => {
        const result = await eventService.getById(actor, entityId);
        return {
            data: result.data as {
                id: string;
                ownerId?: string | null;
                createdById?: string | null;
                authorId?: string | null;
            } | null,
            error: result.error
        };
    });

    // Event location
    registerEntityFetcher('eventLocation', async (actor, entityId) => {
        const result = await eventLocationService.getById(actor, entityId);
        return {
            data: result.data as {
                id: string;
                ownerId?: string | null;
                createdById?: string | null;
            } | null,
            error: result.error
        };
    });

    // Event organizer
    registerEntityFetcher('eventOrganizer', async (actor, entityId) => {
        const result = await eventOrganizerService.getById(actor, entityId);
        return {
            data: result.data as {
                id: string;
                ownerId?: string | null;
                createdById?: string | null;
            } | null,
            error: result.error
        };
    });

    // Note: User entity ownership is enforced by UserService._canView()/_canUpdate()
    // directly in the handler, not via the ownership middleware, because the User
    // entity uses 'id' (not 'userId'/'ownerId') for self-ownership checks.
    //
    // 'destination', 'post' and 'attraction' are declared in OwnableEntityType but
    // have no fetcher because no route configures ownership for them. The guard in
    // test/middlewares/ownership-fetcher-coverage.guard.test.ts fails CI the moment
    // a route starts using one, so an unregistered type can never reach production
    // as a 500 again.

    apiLogger.info('Entity fetchers registered for ownership middleware');
};
