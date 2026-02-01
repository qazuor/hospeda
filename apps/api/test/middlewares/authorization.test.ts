/**
 * Authorization Middleware Tests
 * Tests the three-tier authorization middleware functionality
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    adminAuthMiddleware,
    authorizationMiddleware,
    protectedAuthMiddleware,
    publicAuthMiddleware
} from '../../src/middlewares/authorization';

// Mock utils
vi.mock('../../src/utils/actor');
vi.mock('../../src/utils/logger');

import { getActorFromContext, isGuestActor } from '../../src/utils/actor';
import { apiLogger } from '../../src/utils/logger';

const mockGetActorFromContext = vi.mocked(getActorFromContext);
const mockIsGuestActor = vi.mocked(isGuestActor);
const mockApiLogger = vi.mocked(apiLogger);

// Helper to create actors
const createGuestActor = (): Actor => ({
    id: 'guest-actor-id',
    role: RoleEnum.GUEST,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC]
});

const createUserActor = (permissions: PermissionEnum[] = []): Actor => ({
    id: 'user-123',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC, ...permissions]
});

const createAdminActor = (permissions: PermissionEnum[] = []): Actor => ({
    id: 'admin-123',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.ACCESS_API_PUBLIC,
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        ...permissions
    ]
});

const createSuperAdminActor = (): Actor => ({
    id: 'superadmin-123',
    role: RoleEnum.SUPER_ADMIN,
    permissions: Object.values(PermissionEnum)
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

describe('Authorization Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = createTestApp();
        vi.clearAllMocks();

        // Default mock implementations
        mockApiLogger.debug = vi.fn();
        mockApiLogger.warn = vi.fn();
        mockApiLogger.error = vi.fn();
    });

    describe('Public Level Authorization', () => {
        it('should allow guest actors on public routes', async () => {
            const guestActor = createGuestActor();
            mockGetActorFromContext.mockReturnValue(guestActor);
            mockIsGuestActor.mockReturnValue(true);

            app.use(authorizationMiddleware({ level: 'public' }));
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });

        it('should allow authenticated users on public routes', async () => {
            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(authorizationMiddleware({ level: 'public' }));
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });

        it('should set authorizationLevel in context', async () => {
            const guestActor = createGuestActor();
            mockGetActorFromContext.mockReturnValue(guestActor);
            mockIsGuestActor.mockReturnValue(true);

            app.use(authorizationMiddleware({ level: 'public' }));
            app.get('/test', (c) => {
                const level = c.get('authorizationLevel' as any);
                return c.json({ level });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.level).toBe('public');
        });
    });

    describe('Protected Level Authorization', () => {
        it('should reject guest actors on protected routes', async () => {
            const guestActor = createGuestActor();
            mockGetActorFromContext.mockReturnValue(guestActor);
            mockIsGuestActor.mockReturnValue(true);

            app.use(authorizationMiddleware({ level: 'protected' }));
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.message).toBe('Authentication required');
        });

        it('should allow authenticated users on protected routes', async () => {
            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(authorizationMiddleware({ level: 'protected' }));
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });

        it('should use custom unauthorized message', async () => {
            const guestActor = createGuestActor();
            mockGetActorFromContext.mockReturnValue(guestActor);
            mockIsGuestActor.mockReturnValue(true);

            app.use(
                authorizationMiddleware({
                    level: 'protected',
                    unauthorizedMessage: 'Please login to continue'
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.message).toBe('Please login to continue');
        });

        it('should enforce required permissions on protected routes', async () => {
            const userActor = createUserActor(); // No specific permissions
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(
                authorizationMiddleware({
                    level: 'protected',
                    requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE]
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.message).toBe('Insufficient permissions');
        });

        it('should allow users with required permissions', async () => {
            const userActor = createUserActor([PermissionEnum.ACCOMMODATION_CREATE]);
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(
                authorizationMiddleware({
                    level: 'protected',
                    requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE]
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });
    });

    describe('Admin Level Authorization', () => {
        it('should reject guest actors on admin routes', async () => {
            const guestActor = createGuestActor();
            mockGetActorFromContext.mockReturnValue(guestActor);
            mockIsGuestActor.mockReturnValue(true);

            app.use(authorizationMiddleware({ level: 'admin' }));
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.message).toBe('Authentication required');
        });

        it('should reject regular users on admin routes', async () => {
            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(authorizationMiddleware({ level: 'admin' }));
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.message).toBe('Admin access required');
        });

        it('should allow admins on admin routes', async () => {
            const adminActor = createAdminActor();
            mockGetActorFromContext.mockReturnValue(adminActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(authorizationMiddleware({ level: 'admin' }));
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });

        it('should allow super admins on admin routes', async () => {
            const superAdminActor = createSuperAdminActor();
            mockGetActorFromContext.mockReturnValue(superAdminActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(authorizationMiddleware({ level: 'admin' }));
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });

        it('should enforce additional permissions on admin routes', async () => {
            const adminActor = createAdminActor(); // Has admin access but no USER_HARD_DELETE
            mockGetActorFromContext.mockReturnValue(adminActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(
                authorizationMiddleware({
                    level: 'admin',
                    requiredPermissions: [PermissionEnum.USER_HARD_DELETE]
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.message).toBe('Insufficient admin permissions');
        });

        it('should use custom forbidden message', async () => {
            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(
                authorizationMiddleware({
                    level: 'admin',
                    forbiddenMessage: 'You need admin privileges'
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.message).toBe('You need admin privileges');
        });
    });

    describe('Pre-configured Middlewares', () => {
        describe('publicAuthMiddleware', () => {
            it('should allow all requests', async () => {
                const guestActor = createGuestActor();
                mockGetActorFromContext.mockReturnValue(guestActor);
                mockIsGuestActor.mockReturnValue(true);

                app.use(publicAuthMiddleware());
                app.get('/test', (c) => c.json({ success: true }));

                const res = await app.request('/test');

                expect(res.status).toBe(200);
            });
        });

        describe('protectedAuthMiddleware', () => {
            it('should require authentication', async () => {
                const guestActor = createGuestActor();
                mockGetActorFromContext.mockReturnValue(guestActor);
                mockIsGuestActor.mockReturnValue(true);

                app.use(protectedAuthMiddleware());
                app.get('/test', (c) => c.json({ success: true }));

                const res = await app.request('/test');

                expect(res.status).toBe(401);
            });

            it('should accept required permissions parameter', async () => {
                const userActor = createUserActor();
                mockGetActorFromContext.mockReturnValue(userActor);
                mockIsGuestActor.mockReturnValue(false);

                app.use(protectedAuthMiddleware([PermissionEnum.ACCOMMODATION_CREATE]));
                app.get('/test', (c) => c.json({ success: true }));

                const res = await app.request('/test');

                expect(res.status).toBe(403);
            });
        });

        describe('adminAuthMiddleware', () => {
            it('should require admin access', async () => {
                const userActor = createUserActor();
                mockGetActorFromContext.mockReturnValue(userActor);
                mockIsGuestActor.mockReturnValue(false);

                app.use(adminAuthMiddleware());
                app.get('/test', (c) => c.json({ success: true }));

                const res = await app.request('/test');

                expect(res.status).toBe(403);
            });

            it('should accept required permissions parameter', async () => {
                const adminActor = createAdminActor();
                mockGetActorFromContext.mockReturnValue(adminActor);
                mockIsGuestActor.mockReturnValue(false);

                app.use(adminAuthMiddleware([PermissionEnum.USER_HARD_DELETE]));
                app.get('/test', (c) => c.json({ success: true }));

                const res = await app.request('/test');

                expect(res.status).toBe(403);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle actors with undefined permissions', async () => {
            const actorWithNoPermissions: Actor = {
                id: 'user-123',
                role: RoleEnum.USER,
                permissions: undefined as unknown as PermissionEnum[]
            };
            mockGetActorFromContext.mockReturnValue(actorWithNoPermissions);
            mockIsGuestActor.mockReturnValue(false);

            app.use(
                authorizationMiddleware({
                    level: 'protected',
                    requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE]
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(403);
        });

        it('should handle actors with null permissions', async () => {
            const actorWithNullPermissions: Actor = {
                id: 'user-123',
                role: RoleEnum.USER,
                permissions: null as unknown as PermissionEnum[]
            };
            mockGetActorFromContext.mockReturnValue(actorWithNullPermissions);
            mockIsGuestActor.mockReturnValue(false);

            app.use(
                authorizationMiddleware({
                    level: 'protected',
                    requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE]
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(403);
        });

        it('should require all permissions when multiple are specified', async () => {
            const userActor = createUserActor([PermissionEnum.ACCOMMODATION_CREATE]);
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(
                authorizationMiddleware({
                    level: 'protected',
                    requiredPermissions: [
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            // User only has CREATE, not UPDATE_ANY
            expect(res.status).toBe(403);
        });

        it('should allow when user has all required permissions', async () => {
            const userActor = createUserActor([
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            ]);
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(
                authorizationMiddleware({
                    level: 'protected',
                    requiredPermissions: [
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]
                })
            );
            app.get('/test', (c) => c.json({ success: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
        });
    });

    describe('Logging', () => {
        it('should log authorization checks', async () => {
            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(authorizationMiddleware({ level: 'protected' }));
            app.get('/test', (c) => c.json({ success: true }));

            await app.request('/test');

            expect(mockApiLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Authorization check')
            );
        });

        it('should log unauthorized access attempts', async () => {
            const guestActor = createGuestActor();
            mockGetActorFromContext.mockReturnValue(guestActor);
            mockIsGuestActor.mockReturnValue(true);

            app.use(authorizationMiddleware({ level: 'protected' }));
            app.get('/test', (c) => c.json({ success: true }));

            await app.request('/test');

            expect(mockApiLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Unauthorized access attempt')
            );
        });

        it('should log forbidden access attempts', async () => {
            const userActor = createUserActor();
            mockGetActorFromContext.mockReturnValue(userActor);
            mockIsGuestActor.mockReturnValue(false);

            app.use(authorizationMiddleware({ level: 'admin' }));
            app.get('/test', (c) => c.json({ success: true }));

            await app.request('/test');

            expect(mockApiLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('lacks admin access')
            );
        });
    });
});
