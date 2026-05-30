/**
 * Actor permission-resolution tests (SPEC-170, R-4 hot-path).
 *
 * Exhaustively covers the `(role ∪ grants) \ denies` precedence implemented in
 * `actor.ts`, with `deny` winning over `grant` and SUPER_ADMIN exempt from the
 * whole override mechanism. A bug here is a platform-wide auth failure, so every
 * precedence case from tech-analysis §6 is pinned down here.
 *
 * Written TDD-first (T-006): these fail against the pre-SPEC-170 union-only
 * resolution and pass once T-007 lands the deny-aware resolution.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings, AuthUser } from '../../src/types';

vi.mock('../../src/utils/actor');
vi.mock('../../src/utils/logger');
vi.mock('../../src/utils/role-permissions-cache');
vi.mock('../../src/utils/user-permissions-cache');

import { actorMiddleware } from '../../src/middlewares/actor';
import { createGuestActor } from '../../src/utils/actor';
import { getPermissionsForRole } from '../../src/utils/role-permissions-cache';
import {
    getUserPermissions,
    getUserPermissionsWithEffect
} from '../../src/utils/user-permissions-cache';

const mockGetPermissionsForRole = vi.mocked(getPermissionsForRole);
const mockGetUserPermissions = vi.mocked(getUserPermissions);
const mockGetUserPermissionsWithEffect = vi.mocked(getUserPermissionsWithEffect);
const mockCreateGuestActor = vi.mocked(createGuestActor);

/** Distinct, real permissions used as P1/P2/P3 in the precedence table. */
const P1 = PermissionEnum.USER_UPDATE_PROFILE;
const P2 = PermissionEnum.POST_CREATE;
const P3 = PermissionEnum.ACCESS_API_PUBLIC;

const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const createAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: USER_ID,
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

const createTestApp = (authUser: AuthUser | null) => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
        if (authUser) {
            c.set('user', authUser);
        }
        await next();
    });
    app.use(actorMiddleware());
    app.get('/test', (c) => c.json({ actor: c.get('actor') }));
    return app;
};

/** Runs the middleware and returns the resolved actor.permissions. */
const resolvePermissions = async (authUser: AuthUser): Promise<PermissionEnum[]> => {
    const res = await createTestApp(authUser).request('/test');
    expect(res.status).toBe(200);
    const data = await res.json();
    return data.actor.permissions as PermissionEnum[];
};

describe('Actor permission resolution — deny overrides (SPEC-170)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPermissionsForRole.mockResolvedValue([]);
        mockGetUserPermissions.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [] });
        mockCreateGuestActor.mockReturnValue({
            id: '00000000-0000-4000-8000-000000000000',
            role: RoleEnum.GUEST,
            permissions: [PermissionEnum.ACCESS_API_PUBLIC]
        });
    });

    it('case 1: permission only in role, no overrides → keeps role permission', async () => {
        mockGetPermissionsForRole.mockResolvedValue([P1]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [] });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P1].sort());
    });

    it('case 2: role permission + grant override of the same permission → no duplicate', async () => {
        mockGetPermissionsForRole.mockResolvedValue([P1]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P1], denies: [] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toHaveLength(1);
        expect(perms).toContain(P1);
    });

    it('case 3: role permission + deny override → permission removed', async () => {
        mockGetPermissionsForRole.mockResolvedValue([P1]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [P1] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual([]);
    });

    it('case 4: grant override for a permission not in the role → added', async () => {
        mockGetPermissionsForRole.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P2], denies: [] });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P2].sort());
    });

    it('case 5: deny override for a permission not in the role → no-op', async () => {
        mockGetPermissionsForRole.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [P3] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual([]);
    });

    it('case 6: grant and deny present for the same permission → deny wins (PK prevents this in DB)', async () => {
        // The composite PK (userId, permission) makes a simultaneous grant+deny
        // impossible at the DB level; this pins the resolution to be deny-wins
        // defensively, should both ever appear.
        mockGetPermissionsForRole.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P1], denies: [P1] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual([]);
    });

    it('case 7: SUPER_ADMIN with a deny override → keeps ALL permissions (deny ignored)', async () => {
        const perms = await resolvePermissions(createAuthUser({ role: 'SUPER_ADMIN' }));

        expect(perms).toEqual(Object.values(PermissionEnum));
        expect(mockGetUserPermissionsWithEffect).not.toHaveBeenCalled();
        expect(mockGetPermissionsForRole).not.toHaveBeenCalled();
    });

    it('case 8: SUPER_ADMIN with a grant override → keeps ALL permissions (override moot)', async () => {
        const perms = await resolvePermissions(createAuthUser({ role: 'SUPER_ADMIN' }));

        expect(perms).toEqual(Object.values(PermissionEnum));
        expect(mockGetUserPermissionsWithEffect).not.toHaveBeenCalled();
    });

    it('case 9: multiple denies subtracted from the role set', async () => {
        mockGetPermissionsForRole.mockResolvedValue([P1, P2, P3]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [P1, P3] });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P2].sort());
    });

    it('case 10: mixed role + grants + denies', async () => {
        mockGetPermissionsForRole.mockResolvedValue([P1, P2]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P3], denies: [P2] });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P1, P3].sort());
    });
});
