/**
 * HOS-1674 — a failed read of the per-user permission overrides fails CLOSED.
 *
 * `getUserPermissionsWithEffect` used to swallow a database error and return
 * `{ grants: [], denies: [] }`. The actor's effective set is
 * `(role ∪ grants) \ denies`, so losing the denies handed back, for that
 * request, a permission the account's role grants but an override takes away
 * (SPEC-170). The read now throws, and the actor middleware answers 503 — or,
 * on the one actor-optional route (the QR redirect), degrades to the guest
 * actor — but never resolves an actor holding the denied permission.
 *
 * ## Why this file exists apart from `actor.test.ts`
 *
 * `actor.test.ts` and `actor.resolution.test.ts` automock the whole
 * `user-permissions-cache` module, so they cannot see what the REAL cache does
 * on a failed read. Here the cache runs for real and only the database model
 * underneath it is replaced. That is what lets a mutation restoring the old
 * `return { grants: [], denies: [] }` turn this file red.
 *
 * The control case (the deny override read SUCCEEDS and the permission is
 * absent with a 200) proves the failure cases are red for the right reason.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings, AuthUser } from '../../src/types';

const { findAllMock } = vi.hoisted(() => ({ findAllMock: vi.fn() }));

// The cache instantiates the model at module level, and `@repo/service-core`
// imports `@repo/db` for real, so start from the global double and override
// only the overrides model.
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    return {
        ...createDbMock(),
        RUserPermissionModel: class {
            findAll = findAllMock;
        }
    };
});
vi.mock('../../src/utils/logger');
vi.mock('../../src/utils/role-permissions-cache');
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, getUserRoles: vi.fn() };
});

import { getUserRoles } from '@repo/service-core';
import { actorMiddleware } from '../../src/middlewares/actor';
import { getPermissionsForRoles } from '../../src/utils/role-permissions-cache';
import { destroyUserPermissionsCache } from '../../src/utils/user-permissions-cache';

const mockGetUserRoles = vi.mocked(getUserRoles);
const mockGetPermissionsForRoles = vi.mocked(getPermissionsForRoles);

/** The permission the role grants and the override denies. Outside the guest set. */
const DENIED = PermissionEnum.USER_UPDATE_PROFILE;

const authUser: AuthUser = {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    name: 'Denied User',
    email: 'denied@example.com',
    emailVerified: true,
    image: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    banned: false,
    banReason: null,
    banExpires: null
};

/**
 * Builds an app with the session user already on the context and the REAL
 * actor middleware, mounting a handler at `path` that counts its runs and
 * echoes the resolved actor.
 */
const buildApp = (params: { path: string }) => {
    const handlerRuns = { count: 0 };
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
        c.set('user', authUser);
        await next();
    });
    app.use(actorMiddleware());
    app.get(params.path, (c) => {
        handlerRuns.count += 1;
        const actor = c.get('actor');
        return c.json({ roles: actor.roles, permissions: actor.permissions });
    });
    return { app, handlerRuns };
};

describe('actor middleware when the per-user overrides cannot be read (HOS-1674)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findAllMock.mockReset();
        destroyUserPermissionsCache();
        mockGetUserRoles.mockResolvedValue([RoleEnum.USER]);
        mockGetPermissionsForRoles.mockResolvedValue([DENIED]);
    });

    it('control: a readable deny override strips the role permission (200 without it)', async () => {
        // Arrange
        findAllMock.mockResolvedValue({ items: [{ permission: DENIED, effect: 'deny' }] });
        const { app, handlerRuns } = buildApp({ path: '/test' });

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as { permissions: PermissionEnum[] };
        expect(body.permissions).not.toContain(DENIED);
        expect(handlerRuns.count).toBe(1);
        expect(findAllMock).toHaveBeenCalledTimes(1);
    });

    // TEST:M1674:3
    it('answers 503 and never runs the handler when the overrides read fails', async () => {
        // Arrange
        findAllMock.mockRejectedValue(new Error('user_permission unreadable'));
        const { app, handlerRuns } = buildApp({ path: '/test' });

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(503);
        expect(handlerRuns.count).toBe(0);
        expect(findAllMock).toHaveBeenCalledTimes(1);
    });

    // TEST:M1674:4
    it('degrades to the guest actor, never to an actor holding the denied permission, on the QR route', async () => {
        // Arrange
        findAllMock.mockRejectedValue(new Error('user_permission unreadable'));
        const { app, handlerRuns } = buildApp({ path: '/api/v1/public/qr/abc' });

        // Act
        const res = await app.request('/api/v1/public/qr/abc');

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as { roles: RoleEnum[]; permissions: PermissionEnum[] };
        expect(body.roles).toEqual([RoleEnum.GUEST]);
        expect(body.permissions).not.toContain(DENIED);
        expect(handlerRuns.count).toBe(1);
        expect(findAllMock).toHaveBeenCalledTimes(1);
    });
});
