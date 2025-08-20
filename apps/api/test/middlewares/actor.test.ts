import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    type UserType,
    VisibilityEnum
} from '@repo/types';
/**
 * Actor Middleware Tests
 * Tests the universal actor middleware functionality
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actorMiddleware } from '../../src/middlewares/actor';

// Mock Clerk auth
vi.mock('@hono/clerk-auth');

// Mock service-core
vi.mock('@repo/service-core');

// Mock utils
vi.mock('../../src/utils/actor');

// Mock logger
vi.mock('../../src/utils/logger');

// Mock user-cache
vi.mock('../../src/utils/user-cache');

// Import mocked modules
import { getAuth } from '@hono/clerk-auth';
import { UserService } from '@repo/service-core';
import { createGuestActor } from '../../src/utils/actor';
import { apiLogger } from '../../src/utils/logger';
import { userCache } from '../../src/utils/user-cache';

// Create mock references
const mockGetAuth = vi.mocked(getAuth);
const mockUserService = {
    getById: vi.fn()
};
const mockUserCache = vi.mocked(userCache);
const mockCreateGuestActor = vi.mocked(createGuestActor);
const mockApiLogger = vi.mocked(apiLogger);

// Helper function to create a complete UserType mock
const createMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: 'user-123' as UserId,
    slug: 'test-user',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC],
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: 'creator-id' as UserId,
    updatedById: 'updater-id' as UserId,
    ...overrides
});

// Helper functions for creating auth objects
const createSignedInAuth = (userId: string) =>
    ({
        userId,
        sessionClaims: {
            iss: 'https://clerk.dev',
            sub: userId,
            aud: 'test-app',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
            __raw: 'test-raw-token',
            sid: 'session-123',
            v: 2
        },
        sessionId: 'session-123',
        sessionStatus: 'active' as const,
        actor: null,
        orgId: null,
        orgRole: null,
        orgSlug: null,
        hasVerifiedEmailAddress: true,
        hasVerifiedPhoneNumber: false,
        orgPermissions: [],
        factorVerificationAge: [null, null]
    }) as any;

const createSignedOutAuth = () =>
    ({
        userId: null,
        sessionClaims: null,
        sessionId: null,
        sessionStatus: null,
        actor: null,
        orgId: null,
        orgRole: null,
        orgSlug: null,
        hasVerifiedEmailAddress: false,
        hasVerifiedPhoneNumber: false,
        tokenType: 'email' as const,
        orgPermissions: [],
        factorVerificationAge: [null, null],
        getToken: vi.fn(),
        experimental_hasImage: false,
        __experimental_factorVerificationAge: [null, null],
        signOut: vi.fn(),
        has: vi.fn(),
        debug: vi.fn(),
        isAuthenticated: false
    }) as any;

describe('Actor Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        app.use(actorMiddleware());
        vi.clearAllMocks();

        // Setup UserService mock after clearing mocks
        vi.mocked(UserService).mockImplementation(() => mockUserService as any);

        // Setup userCache mock
        mockUserCache.getUser = vi.fn();

        // Default mock implementations
        mockCreateGuestActor.mockReturnValue({
            id: 'guest-actor-id',
            role: RoleEnum.GUEST,
            permissions: []
        });
    });

    describe('Guest User Handling', () => {
        it('should create guest actor for unauthenticated users', async () => {
            mockGetAuth.mockReturnValue(null);

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor).toEqual({
                id: 'guest-actor-id',
                role: 'GUEST',
                permissions: []
            });
            expect(mockCreateGuestActor).toHaveBeenCalled();
        });

        it('should create guest actor when auth has no userId', async () => {
            mockGetAuth.mockReturnValue(createSignedOutAuth());

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
            expect(mockCreateGuestActor).toHaveBeenCalled();
        });
    });

    describe('Authenticated User Handling', () => {
        it('should create user actor for authenticated users', async () => {
            const mockUser = createMockUser({
                id: 'user-123' as UserId,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.USER_UPDATE_PROFILE]
            });

            mockGetAuth.mockReturnValue(createSignedInAuth('user-123'));
            mockUserCache.getUser.mockResolvedValue(mockUser);

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor).toEqual({
                id: 'user-123',
                role: RoleEnum.USER,
                permissions: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.USER_UPDATE_PROFILE]
            });
            expect(mockUserCache.getUser).toHaveBeenCalledWith('user-123');
        });

        it('should fallback to guest actor when user not found in database', async () => {
            mockGetAuth.mockReturnValue(createSignedInAuth('user-123'));
            mockUserCache.getUser.mockResolvedValue(null);

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
            expect(mockApiLogger.warn).toHaveBeenCalledWith(
                'User user-123 not found in database, using guest actor'
            );
        });

        it('should fallback to guest actor when database query fails', async () => {
            mockGetAuth.mockReturnValue(createSignedInAuth('user-123'));
            mockUserCache.getUser.mockRejectedValue(new Error('Database error'));

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
            expect(mockApiLogger.error).toHaveBeenCalledWith(
                'Error getting user actor:',
                'Database error'
            );
        });

        it('should handle non-Error exceptions gracefully', async () => {
            mockGetAuth.mockReturnValue(createSignedInAuth('user-123'));
            mockUserCache.getUser.mockRejectedValue('String error');

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
            expect(mockApiLogger.error).toHaveBeenCalledWith(
                'Error getting user actor:',
                'String error'
            );
        });
    });

    describe('Actor Injection', () => {
        it('should inject actor into context for all routes', async () => {
            mockGetAuth.mockReturnValue(null);

            app.get('/route1', (c: any) => {
                const actor = c.get('actor');
                return c.json({ route: 'route1', actor });
            });

            app.post('/route2', (c: any) => {
                const actor = c.get('actor');
                return c.json({ route: 'route2', actor });
            });

            const res1 = await app.request('/route1');
            const res2 = await app.request('/route2', { method: 'POST' });

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);

            const data1 = await res1.json();
            const data2 = await res2.json();

            expect(data1.actor).toBeDefined();
            expect(data2.actor).toBeDefined();
            expect(data1.actor.role).toBe('GUEST');
            expect(data2.actor.role).toBe('GUEST');
        });

        it('should inject actor with correct properties', async () => {
            mockGetAuth.mockReturnValue(null);

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({
                    hasId: 'id' in actor,
                    hasRole: 'role' in actor,
                    hasPermissions: 'permissions' in actor
                });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.hasId).toBe(true);
            expect(data.hasRole).toBe(true);
            expect(data.hasPermissions).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle middleware errors gracefully', async () => {
            mockGetAuth.mockImplementation(() => {
                throw new Error('Auth error');
            });

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(500);
        });

        it('should handle userCache errors gracefully', async () => {
            mockGetAuth.mockReturnValue(createSignedInAuth('user-123'));
            mockUserCache.getUser.mockRejectedValue(new Error('Cache error'));

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
            expect(mockApiLogger.error).toHaveBeenCalledWith(
                'Error getting user actor:',
                'Cache error'
            );
        });
    });

    describe('Integration with Other Middlewares', () => {
        it('should work with error handler middleware', async () => {
            mockGetAuth.mockReturnValue(null);

            app.get('/error', () => {
                throw new Error('Test error');
            });

            const res = await app.request('/error');

            expect(res.status).toBe(500);
        });

        it('should work with response formatting middleware', async () => {
            mockGetAuth.mockReturnValue(null);

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ message: 'success', actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('success');
            expect(data.actor).toBeDefined();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
        });
    });

    describe('Performance and Caching', () => {
        it('should create new actor for each request', async () => {
            mockGetAuth.mockReturnValue(null);

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actorId: actor.id });
            });

            await app.request('/test');
            await app.request('/test');

            // Each request should get a fresh actor
            expect(mockCreateGuestActor).toHaveBeenCalledTimes(2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty auth object', async () => {
            mockGetAuth.mockReturnValue(createSignedOutAuth());

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
        });

        it('should handle auth with undefined userId', async () => {
            mockGetAuth.mockReturnValue(createSignedOutAuth());

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
        });

        it('should handle user with minimal permissions', async () => {
            // Create a user with minimal permissions to test edge cases
            const mockUser = createMockUser({
                id: 'user-123' as UserId,
                role: RoleEnum.USER,
                permissions: [] // Empty permissions array
            });

            mockGetAuth.mockReturnValue(createSignedInAuth('user-123'));
            mockUserCache.getUser.mockResolvedValue(mockUser);

            app.get('/test', (c: any) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.id).toBe('user-123');
            expect(data.actor.role).toBe(RoleEnum.USER);
            expect(data.actor.permissions).toEqual([]); // Empty array instead of undefined
            expect(mockUserCache.getUser).toHaveBeenCalledWith('user-123');
        });
    });
});
