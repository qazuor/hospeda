import type { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context, Next } from 'hono';
import { apiLogger } from '../../src/utils/logger';

/**
 * Mock authentication middleware for testing
 * Extracts actor information from test headers and injects it into the context
 *
 * This middleware should ONLY be used in test environment
 * It reads mock headers (x-mock-actor-*) and creates an Actor object
 */
export const mockAuthMiddleware = async (c: Context, next: Next) => {
    // Only apply in test environment
    if (process.env.NODE_ENV !== 'test') {
        return next();
    }

    // Check for mock auth headers
    const mockActorId = c.req.header('x-mock-actor-id');
    const mockActorRole = c.req.header('x-mock-actor-role');
    const mockActorPermissions = c.req.header('x-mock-actor-permissions');

    if (mockActorId && mockActorRole) {
        try {
            // Parse permissions
            let permissions: PermissionEnum[] = [];
            if (mockActorPermissions) {
                permissions = JSON.parse(mockActorPermissions);
            }

            // Create mock actor
            const mockActor: Actor = {
                id: mockActorId,
                role: mockActorRole as RoleEnum,
                permissions
            };

            // Inject actor into context
            c.set('actor', mockActor);

            apiLogger.debug(
                `Mock actor injected into context: ${mockActor.id} (${mockActor.role}, ${mockActor.permissions.length} permissions)`
            );
        } catch (error) {
            apiLogger.error(`Failed to parse mock actor from headers: ${error}`);
        }
    }

    return next();
};
