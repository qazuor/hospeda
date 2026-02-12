/**
 * Actor Middleware Tests
 * Tests the universal actor middleware that builds Actor from Better Auth session user
 */
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type User,
    type UserIdType,
    VisibilityEnum
} from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings, AuthUser } from '../../src/types';

// Mock utils
vi.mock('../../src/utils/actor');
vi.mock('../../src/utils/logger');
vi.mock('../../src/utils/user-cache');

// Import mocked modules
import { actorMiddleware } from '../../src/middlewares/actor';
import { createGuestActor } from '../../src/utils/actor';
import { apiLogger } from '../../src/utils/logger';
import { userCache } from '../../src/utils/user-cache';

const mockUserCache = vi.mocked(userCache);
const mockCreateGuestActor = vi.mocked(createGuestActor);
const _mockApiLogger = vi.mocked(apiLogger);

/** Helper to create a complete User mock from the database */
const createMockDbUser = (overrides: Partial<User> = {}): User => ({
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as UserIdType,
    slug: 'test-user',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC],
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: 'creator-id' as UserIdType,
    updatedById: 'updater-id' as UserIdType,
    ...overrides
});

/** Helper to create an AuthUser (from Better Auth session) */
const createAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    role: 'USER',
    banned: false,
    banReason: null,
    banExpires: null,
    ...overrides
});

/**
 * Creates a test app that sets the user on context before actor middleware.
 * This simulates what the auth middleware does in production.
 */
const createTestApp = (authUser: AuthUser | null) => {
    const app = new Hono<AppBindings>();

    // Simulate auth middleware setting user on context
    app.use(async (c, next) => {
        if (authUser) {
            c.set('user', authUser);
        }
        await next();
    });

    app.use(actorMiddleware());

    return app;
};

describe('Actor Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockUserCache.getUser = vi.fn();

        mockCreateGuestActor.mockReturnValue({
            id: '00000000-0000-4000-8000-000000000000',
            role: RoleEnum.GUEST,
            permissions: [PermissionEnum.ACCESS_API_PUBLIC]
        });
    });

    describe('Guest User Handling', () => {
        it('should create guest actor for unauthenticated users', async () => {
            const app = createTestApp(null);
            app.get('/test', (c) => {
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
        it('should create user actor with permissions from DB', async () => {
            const authUser = createAuthUser({ role: 'USER' });
            const dbUser = createMockDbUser({
                permissions: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.USER_UPDATE_PROFILE]
            });

            mockUserCache.getUser.mockResolvedValue(dbUser);

            const app = createTestApp(authUser);
            app.get('/test', (c) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.id).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
            expect(data.actor.role).toBe(RoleEnum.USER);
            expect(data.actor.permissions).toEqual([
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.USER_UPDATE_PROFILE
            ]);
            expect(mockUserCache.getUser).toHaveBeenCalledWith(
                'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
            );
        });

        it('should grant all permissions to SUPER_ADMIN without DB lookup', async () => {
            const authUser = createAuthUser({
                id: 'admin-uuid',
                role: 'SUPER_ADMIN'
            });

            const app = createTestApp(authUser);
            app.get('/test', (c) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.id).toBe('admin-uuid');
            expect(data.actor.role).toBe(RoleEnum.SUPER_ADMIN);
            expect(data.actor.permissions).toEqual(Object.values(PermissionEnum));
            // SUPER_ADMIN should NOT trigger a DB lookup
            expect(mockUserCache.getUser).not.toHaveBeenCalled();
        });

        it('should use empty permissions when user not found in DB', async () => {
            const authUser = createAuthUser();
            mockUserCache.getUser.mockResolvedValue(null);

            const app = createTestApp(authUser);
            app.get('/test', (c) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.id).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
            expect(data.actor.role).toBe(RoleEnum.USER);
            expect(data.actor.permissions).toEqual([]);
        });

        it('should fallback to guest actor when DB query fails', async () => {
            const authUser = createAuthUser();
            mockUserCache.getUser.mockRejectedValue(new Error('Database error'));

            const app = createTestApp(authUser);
            app.get('/test', (c) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.GUEST);
            expect(mockCreateGuestActor).toHaveBeenCalled();
        });

        it('should default role to USER when auth user has no role', async () => {
            const authUser = createAuthUser({ role: null });
            const dbUser = createMockDbUser({ permissions: [] });
            mockUserCache.getUser.mockResolvedValue(dbUser);

            const app = createTestApp(authUser);
            app.get('/test', (c) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.role).toBe(RoleEnum.USER);
        });
    });

    describe('Actor Injection', () => {
        it('should inject actor into context for all routes', async () => {
            const app = createTestApp(null);

            app.get('/route1', (c) => {
                const actor = c.get('actor');
                return c.json({ route: 'route1', hasActor: !!actor });
            });

            app.post('/route2', (c) => {
                const actor = c.get('actor');
                return c.json({ route: 'route2', hasActor: !!actor });
            });

            const res1 = await app.request('/route1');
            const res2 = await app.request('/route2', { method: 'POST' });

            const data1 = await res1.json();
            const data2 = await res2.json();

            expect(data1.hasActor).toBe(true);
            expect(data2.hasActor).toBe(true);
        });

        it('should inject actor with required properties', async () => {
            const app = createTestApp(null);
            app.get('/test', (c) => {
                const actor = c.get('actor');
                return c.json({
                    hasId: 'id' in actor,
                    hasRole: 'role' in actor,
                    hasPermissions: 'permissions' in actor
                });
            });

            const res = await app.request('/test');
            const data = await res.json();

            expect(data.hasId).toBe(true);
            expect(data.hasRole).toBe(true);
            expect(data.hasPermissions).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle user with empty permissions array', async () => {
            const authUser = createAuthUser();
            const dbUser = createMockDbUser({ permissions: [] });
            mockUserCache.getUser.mockResolvedValue(dbUser);

            const app = createTestApp(authUser);
            app.get('/test', (c) => {
                const actor = c.get('actor');
                return c.json({ actor });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.actor.permissions).toEqual([]);
        });

        it('should create fresh actor for each request', async () => {
            const app = createTestApp(null);
            app.get('/test', (c) => {
                const actor = c.get('actor');
                return c.json({ actorId: actor.id });
            });

            await app.request('/test');
            await app.request('/test');

            expect(mockCreateGuestActor).toHaveBeenCalledTimes(2);
        });
    });

    describe('Mock Actor Headers (Test Mode)', () => {
        it('should process mock actor headers when ALLOW_MOCK_ACTOR is true', async () => {
            const originalAllowMock = process.env.ALLOW_MOCK_ACTOR;
            process.env.ALLOW_MOCK_ACTOR = 'true';
            process.env.NODE_ENV = 'test';

            try {
                const app = createTestApp(null);
                app.get('/test', (c) => {
                    const actor = c.get('actor');
                    return c.json({ actor });
                });

                const res = await app.request('/test', {
                    headers: {
                        'x-mock-actor-id': 'mock-user-id',
                        'x-mock-actor-role': RoleEnum.ADMIN,
                        'x-mock-actor-permissions': JSON.stringify([
                            PermissionEnum.ACCESS_API_PUBLIC
                        ])
                    }
                });

                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data.actor.id).toBe('mock-user-id');
                expect(data.actor.role).toBe(RoleEnum.ADMIN);
                expect(data.actor.permissions).toEqual([PermissionEnum.ACCESS_API_PUBLIC]);
            } finally {
                process.env.ALLOW_MOCK_ACTOR = originalAllowMock;
            }
        });

        it('should reject invalid mock actor role', async () => {
            const originalAllowMock = process.env.ALLOW_MOCK_ACTOR;
            process.env.ALLOW_MOCK_ACTOR = 'true';
            process.env.NODE_ENV = 'test';

            try {
                const app = createTestApp(null);
                app.onError((err, c) => {
                    if ('status' in err) {
                        return c.json({ error: err.message }, err.status as 400);
                    }
                    return c.json({ error: 'Internal error' }, 500);
                });
                app.get('/test', (c) => c.json({ ok: true }));

                const res = await app.request('/test', {
                    headers: {
                        'x-mock-actor-id': 'mock-user-id',
                        'x-mock-actor-role': 'INVALID_ROLE',
                        'x-mock-actor-permissions': '[]'
                    }
                });

                expect(res.status).toBe(400);
            } finally {
                process.env.ALLOW_MOCK_ACTOR = originalAllowMock;
            }
        });
    });
});
