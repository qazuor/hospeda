/**
 * Entity Fetchers Registration
 * Registers entity fetchers for ownership middleware
 */
import { AccommodationService } from '@repo/service-core';
import { registerEntityFetcher } from '../middlewares/ownership';
import { apiLogger } from './logger';

// Create service instances
const accommodationService = new AccommodationService({ logger: apiLogger });

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

    // Note: User entity ownership is enforced by UserService._canView()/_canUpdate()
    // directly in the handler, not via the ownership middleware, because the User
    // entity uses 'id' (not 'userId'/'ownerId') for self-ownership checks.

    apiLogger.info('Entity fetchers registered for ownership middleware');
};
