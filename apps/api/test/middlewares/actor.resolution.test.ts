/**
 * Actor permission-resolution tests (SPEC-170 R-4 hot-path, HOS-296 AC-3).
 *
 * Exhaustively covers the effective-permission formula implemented in
 * `actor.ts`:
 *
 * ```
 * effectivePermissions = (⋃ perms(role) for role in roles ∪ grants) \ denies
 * ```
 *
 * Two things are pinned here and a bug in either is a platform-wide auth
 * failure:
 *
 * 1. **Deny beats grant** (SPEC-170), and SUPER_ADMIN is exempt from the whole
 *    override mechanism.
 * 2. **The union is over EVERY held role** (HOS-296) — an account wears several
 *    hats at once, the role-derived set is their union, and a deny still wins
 *    over a grant arriving from ANY of them. That last part is the mitigation
 *    for R-1 (privilege escalation by accumulating hats): collecting roles must
 *    never be a way around an explicit per-user deny.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings, AuthUser } from '../../src/types';

vi.mock('../../src/utils/actor');
vi.mock('../../src/utils/logger');
vi.mock('../../src/utils/role-permissions-cache');
vi.mock('../../src/utils/user-permissions-cache');
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, getUserRoles: vi.fn() };
});

import { getUserRoles } from '@repo/service-core';
import { actorMiddleware } from '../../src/middlewares/actor';
import { createGuestActor } from '../../src/utils/actor';
import { getPermissionsForRoles } from '../../src/utils/role-permissions-cache';
import {
    getUserPermissions,
    getUserPermissionsWithEffect
} from '../../src/utils/user-permissions-cache';

const mockGetPermissionsForRoles = vi.mocked(getPermissionsForRoles);
const mockGetUserPermissions = vi.mocked(getUserPermissions);
const mockGetUserPermissionsWithEffect = vi.mocked(getUserPermissionsWithEffect);
const mockCreateGuestActor = vi.mocked(createGuestActor);
const mockGetUserRoles = vi.mocked(getUserRoles);

/** Distinct, real permissions used as P1/P2/P3 in the precedence table. */
const P1 = PermissionEnum.USER_UPDATE_PROFILE;
const P2 = PermissionEnum.POST_CREATE;
const P3 = PermissionEnum.ACCESS_API_PUBLIC;
/** A fourth, used only by the multi-role cases so unions are unambiguous. */
const P4 = PermissionEnum.ACCOMMODATION_CREATE;

const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const createAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: USER_ID,
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
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

/** Runs the middleware and returns the resolved actor. */
const resolveActor = async (
    authUser: AuthUser
): Promise<{ roles: RoleEnum[]; permissions: PermissionEnum[] }> => {
    const res = await createTestApp(authUser).request('/test');
    expect(res.status).toBe(200);
    const data = await res.json();
    return {
        roles: data.actor.roles as RoleEnum[],
        permissions: data.actor.permissions as PermissionEnum[]
    };
};

/** Runs the middleware and returns only `actor.permissions`. */
const resolvePermissions = async (authUser: AuthUser): Promise<PermissionEnum[]> =>
    (await resolveActor(authUser)).permissions;

describe('Actor permission resolution — deny overrides (SPEC-170)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserRoles.mockResolvedValue([RoleEnum.USER]);
        mockGetPermissionsForRoles.mockResolvedValue([]);
        mockGetUserPermissions.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [] });
        mockCreateGuestActor.mockReturnValue({
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: [PermissionEnum.ACCESS_API_PUBLIC]
        });
    });

    it('case 1: permission only in role, no overrides → keeps role permission', async () => {
        mockGetPermissionsForRoles.mockResolvedValue([P1]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [] });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P1].sort());
    });

    it('case 2: role permission + grant override of the same permission → no duplicate', async () => {
        mockGetPermissionsForRoles.mockResolvedValue([P1]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P1], denies: [] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toHaveLength(1);
        expect(perms).toContain(P1);
    });

    it('case 3: role permission + deny override → permission removed', async () => {
        mockGetPermissionsForRoles.mockResolvedValue([P1]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [P1] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual([]);
    });

    it('case 4: grant override for a permission not in the role → added', async () => {
        mockGetPermissionsForRoles.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P2], denies: [] });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P2].sort());
    });

    it('case 5: deny override for a permission not in the role → no-op', async () => {
        mockGetPermissionsForRoles.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [P3] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual([]);
    });

    it('case 6: grant and deny present for the same permission → deny wins (PK prevents this in DB)', async () => {
        // The composite PK (userId, permission) makes a simultaneous grant+deny
        // impossible at the DB level; this pins the resolution to be deny-wins
        // defensively, should both ever appear.
        mockGetPermissionsForRoles.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P1], denies: [P1] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual([]);
    });

    it('case 7: SUPER_ADMIN with a deny override → keeps ALL permissions (deny ignored)', async () => {
        mockGetUserRoles.mockResolvedValue([RoleEnum.SUPER_ADMIN]);

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual(Object.values(PermissionEnum));
        expect(mockGetUserPermissionsWithEffect).not.toHaveBeenCalled();
        expect(mockGetPermissionsForRoles).not.toHaveBeenCalled();
    });

    it('case 8: SUPER_ADMIN with a grant override → keeps ALL permissions (override moot)', async () => {
        mockGetUserRoles.mockResolvedValue([RoleEnum.SUPER_ADMIN]);

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual(Object.values(PermissionEnum));
        expect(mockGetUserPermissionsWithEffect).not.toHaveBeenCalled();
    });

    it('case 9: multiple denies subtracted from the role set', async () => {
        mockGetPermissionsForRoles.mockResolvedValue([P1, P2, P3]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [P1, P3] });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P2].sort());
    });

    it('case 10: mixed role + grants + denies', async () => {
        mockGetPermissionsForRoles.mockResolvedValue([P1, P2]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P3], denies: [P2] });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P1, P3].sort());
    });
});

describe('Actor permission resolution — multi-role union (HOS-296 AC-3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserRoles.mockResolvedValue([RoleEnum.USER]);
        mockGetPermissionsForRoles.mockResolvedValue([]);
        mockGetUserPermissions.mockResolvedValue([]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [] });
        mockCreateGuestActor.mockReturnValue({
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: [PermissionEnum.ACCESS_API_PUBLIC]
        });
    });

    it('carries EVERY held role onto the actor, in the order user_role returned them', async () => {
        mockGetUserRoles.mockResolvedValue([RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]);

        const { roles } = await resolveActor(createAuthUser());

        expect(roles).toEqual([RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]);
    });

    it('asks the cache for the WHOLE role set, not one role at a time', async () => {
        mockGetUserRoles.mockResolvedValue([RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]);

        await resolveActor(createAuthUser());

        expect(mockGetPermissionsForRoles).toHaveBeenCalledTimes(1);
        expect(mockGetPermissionsForRoles).toHaveBeenCalledWith({
            roles: [RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]
        });
    });

    it('resolves the UNION of the permissions of both hats', async () => {
        mockGetUserRoles.mockResolvedValue([RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]);
        // The cache is the component that computes the union; the middleware
        // consumes whatever it returns for the whole set.
        mockGetPermissionsForRoles.mockResolvedValue([P1, P4]);

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P1, P4].sort());
    });

    it('AC-3: a DENY beats a grant that comes from ANY held role', async () => {
        // P1 arrives from the HOST hat, P4 from the COMMERCE_OWNER hat, and P2
        // from an explicit per-user grant. The deny list names P1 and P4 — one
        // permission from each hat — and both must be stripped. Accumulating a
        // second hat cannot be a way around an explicit deny (R-1).
        mockGetUserRoles.mockResolvedValue([RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]);
        mockGetPermissionsForRoles.mockResolvedValue([P1, P4]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({
            grants: [P2],
            denies: [P1, P4]
        });

        const perms = await resolvePermissions(createAuthUser());

        expect([...perms].sort()).toEqual([P2].sort());
        expect(perms).not.toContain(P1);
        expect(perms).not.toContain(P4);
    });

    it('AC-3: a DENY also beats a per-user GRANT of the same permission held by a role', async () => {
        mockGetUserRoles.mockResolvedValue([RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]);
        mockGetPermissionsForRoles.mockResolvedValue([P1]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [P1], denies: [P1] });

        const perms = await resolvePermissions(createAuthUser());

        expect(perms).toEqual([]);
    });

    it('holding SUPER_ADMIN alongside other hats still short-circuits to every permission', async () => {
        mockGetUserRoles.mockResolvedValue([RoleEnum.USER, RoleEnum.SUPER_ADMIN, RoleEnum.HOST]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({ grants: [], denies: [P1] });

        const { roles, permissions } = await resolveActor(createAuthUser());

        expect(roles).toEqual([RoleEnum.USER, RoleEnum.SUPER_ADMIN, RoleEnum.HOST]);
        expect(permissions).toEqual(Object.values(PermissionEnum));
        // Neither the role-permission cache nor the override cache is consulted.
        expect(mockGetPermissionsForRoles).not.toHaveBeenCalled();
        expect(mockGetUserPermissionsWithEffect).not.toHaveBeenCalled();
    });

    it('falls back to [USER] when the account holds no role at all', async () => {
        // A data-integrity failure, not a legitimate state: signup grants the
        // baseline hat and `revokeRole` refuses to remove the last one.
        // Resolving to an EMPTY set here would silently strip every permission,
        // so the middleware substitutes the baseline instead.
        mockGetUserRoles.mockResolvedValue([]);
        mockGetPermissionsForRoles.mockResolvedValue([P3]);

        const { roles, permissions } = await resolveActor(createAuthUser());

        expect(roles).toEqual([RoleEnum.USER]);
        expect(mockGetPermissionsForRoles).toHaveBeenCalledWith({ roles: [RoleEnum.USER] });
        expect(permissions).toEqual([P3]);
    });

    it('returns 503 when the user_role read fails, instead of an actor with no hats', async () => {
        mockGetUserRoles.mockRejectedValue(new Error('Database error'));

        const res = await createTestApp(createAuthUser()).request('/test');

        expect(res.status).toBe(503);
    });
});
