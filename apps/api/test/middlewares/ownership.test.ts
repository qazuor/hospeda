/**
 * Ownership Middleware Tests
 * Tests the ownership verification middleware functionality
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearEntityFetchers,
    getEntityFromContext,
    isOwnerFromContext,
    optionalOwnershipMiddleware,
    ownershipMiddleware,
    registerEntityFetcher
} from '../../src/middlewares/ownership';

// Mock utils
vi.mock('../../src/utils/actor');
vi.mock('../../src/utils/logger');

import { getActorFromContext } from '../../src/utils/actor';
import { apiLogger } from '../../src/utils/logger';

const mockGetActorFromContext = vi.mocked(getActorFromContext);
const mockApiLogger = vi.mocked(apiLogger);

// Helper to create actors
const createUserActor = (id = 'user-123', permissions: PermissionEnum[] = []): Actor => ({
    id,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC, ...permissions]
});

// Helper to create entities
const createEntity = (
    id = 'entity-123',
    ownerId: string | null = 'user-123',
    createdById: string | null = 'user-123'
) => ({
    id,
    ownerId,
    createdById,
    name: 'Test Entity'
});

/**
 * Helper to create test app with error handler that converts HTTPException to JSON
 */
const createTestApp = (): Hono => {
    const app = new Hono();
    // Add error handler that converts HTTPException to JSON response
    app.onError((err, c) => {
        if (err instanceof HTTPException) {
            return c.json({ message: err.message }, err.status);
        }
        return c.json({ message: 'Internal server error' }, 500);
    });
    return app;
};

describe('Ownership Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = createTestApp();
        vi.clearAllMocks();
        clearEntityFetchers();

        // Default mock implementations
        mockApiLogger.debug = vi.fn();
        mockApiLogger.warn = vi.fn();
        mockApiLogger.error = vi.fn();
    });

    describe('Entity Fetcher Registration', () => {
        it('should register and use entity fetcher', async () => {
            const userActor = createUserActor();
            const entity = createEntity();

            mockGetActorFromContext.mockReturnValue(userActor);

            const mockFetcher = vi.fn().mockResolvedValue({ data: entity });
            registerEntityFetcher('accommodation', mockFetcher);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId', 'createdById']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
            expect(mockFetcher).toHaveBeenCalledWith(userActor, 'entity-123');
        });

        it('should fail if no fetcher is registered', async () => {
            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.message).toBe('Internal server error: Entity type not configured');
        });
    });

    describe('Ownership Verification', () => {
        beforeEach(() => {
            const entity = createEntity('entity-123', 'user-123', 'user-456');
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));
        });

        it('should allow owner by ownerId', async () => {
            const userActor = createUserActor('user-123');
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
        });

        it('should allow owner by createdById when ownerId does not match', async () => {
            const entity = createEntity('entity-123', 'other-user', 'user-123');
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));

            const userActor = createUserActor('user-123');
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId', 'createdById']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
        });

        it('should deny non-owners', async () => {
            const userActor = createUserActor('different-user');
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId', 'createdById']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.message).toBe('You do not have permission to access this resource');
        });
    });

    describe('Bypass Permission', () => {
        beforeEach(() => {
            const entity = createEntity('entity-123', 'other-owner', 'other-creator');
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));
        });

        it('should allow access with bypass permission even if not owner', async () => {
            const userActor = createUserActor('different-user', [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            ]);
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId', 'createdById'],
                    bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
        });

        it('should deny if bypass permission is required but not present', async () => {
            const userActor = createUserActor('different-user', []); // No bypass permission
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId'],
                    bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(403);
        });
    });

    describe('Entity Not Found', () => {
        it('should return 404 when entity not found', async () => {
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: null }));

            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/nonexistent');

            expect(res.status).toBe(404);
            const data = await res.json();
            expect(data.message).toBe('accommodation not found');
        });

        it('should allow when entity not found with allowNotFound=true', async () => {
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: null }));

            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId'],
                    allowNotFound: true
                })
            );
            app.get('/:id', (c) => {
                const entity = getEntityFromContext(c);
                const isOwner = isOwnerFromContext(c);
                return c.json({ entity, isOwner });
            });

            const res = await app.request('/nonexistent');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.entity).toBeNull();
            expect(data.isOwner).toBe(false);
        });
    });

    describe('Context Helpers', () => {
        it('should set entity and isOwner in context', async () => {
            const entity = createEntity('entity-123', 'user-123', null);
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));

            const userActor = createUserActor('user-123');
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => {
                const storedEntity = getEntityFromContext(c);
                const isOwner = isOwnerFromContext(c);
                return c.json({ entityId: storedEntity?.id, isOwner });
            });

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.entityId).toBe('entity-123');
            expect(data.isOwner).toBe(true);
        });

        it('should correctly report isOwner=false for bypass', async () => {
            const entity = createEntity('entity-123', 'other-owner', 'other-creator');
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));

            const userActor = createUserActor('admin-user', [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            ]);
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId'],
                    bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
                })
            );
            app.get('/:id', (c) => {
                const isOwner = isOwnerFromContext(c);
                return c.json({ isOwner });
            });

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.isOwner).toBe(false); // Admin bypassed, but is not actual owner
        });
    });

    describe('Custom Parameter Field', () => {
        it('should use custom paramIdField', async () => {
            const entity = createEntity();
            const mockFetcher = vi.fn().mockResolvedValue({ data: entity });
            registerEntityFetcher('accommodation', mockFetcher);

            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/accommodations/:accommodationId',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId'],
                    paramIdField: 'accommodationId'
                })
            );
            app.get('/accommodations/:accommodationId', (c) => c.json({ success: true }));

            const res = await app.request('/accommodations/custom-id-123');

            expect(res.status).toBe(200);
            expect(mockFetcher).toHaveBeenCalledWith(userActor, 'custom-id-123');
        });
    });

    describe('Error Handling', () => {
        it('should handle fetcher errors gracefully', async () => {
            registerEntityFetcher(
                'accommodation',
                vi.fn().mockRejectedValue(new Error('Database error'))
            );

            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.message).toBe('Internal server error while fetching entity');
        });

        it('should handle fetcher returning error object', async () => {
            registerEntityFetcher(
                'accommodation',
                vi.fn().mockResolvedValue({ error: { message: 'Not found' } })
            );

            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(404);
        });
    });

    describe('Optional Ownership Middleware', () => {
        it('should allow access and load entity without requiring ownership', async () => {
            const entity = createEntity('entity-123', 'other-owner', 'other-creator');
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));

            const userActor = createUserActor('not-owner');
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                optionalOwnershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId', 'createdById']
                })
            );
            app.get('/:id', (c) => {
                const storedEntity = getEntityFromContext(c);
                const isOwner = isOwnerFromContext(c);
                return c.json({ hasEntity: !!storedEntity, isOwner });
            });

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.hasEntity).toBe(true);
            expect(data.isOwner).toBe(false);
        });

        it('should correctly identify owner', async () => {
            const entity = createEntity('entity-123', 'user-123', null);
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));

            const userActor = createUserActor('user-123');
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                optionalOwnershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => {
                const isOwner = isOwnerFromContext(c);
                return c.json({ isOwner });
            });

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.isOwner).toBe(true);
        });

        it('should handle missing entity gracefully', async () => {
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: null }));

            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                optionalOwnershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId'],
                    allowNotFound: true
                })
            );
            app.get('/:id', (c) => {
                const entity = getEntityFromContext(c);
                return c.json({ entity });
            });

            const res = await app.request('/nonexistent');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.entity).toBeNull();
        });
    });

    describe('Logging', () => {
        it('should log ownership checks', async () => {
            const entity = createEntity();
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));

            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            await app.request('/entity-123');

            expect(mockApiLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Ownership check')
            );
        });

        it('should log ownership denial', async () => {
            const entity = createEntity('entity-123', 'other-owner', 'other-creator');
            registerEntityFetcher('accommodation', vi.fn().mockResolvedValue({ data: entity }));

            const userActor = createUserActor('not-owner');
            mockGetActorFromContext.mockReturnValue(userActor);

            app.use(
                '/:id',
                ownershipMiddleware({
                    entityType: 'accommodation',
                    ownershipFields: ['ownerId']
                })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            await app.request('/entity-123');

            expect(mockApiLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Ownership denied')
            );
        });
    });
});
