/**
 * commerce.permissions.test.ts
 *
 * Unit tests for commerce listing permission helpers (SPEC-239 T-030).
 *
 * All tests use mocked `hasPermission` so they are completely decoupled
 * from the `Actor` shape and the permission registry.  No real DB is touched.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkCanAdminListCommerce,
    checkCanCreateCommerce,
    checkCanDeleteCommerce,
    checkCanEditAll,
    checkCanEditOwn,
    checkCanModerateReview,
    checkCanViewAll
} from '../../../src/services/commerce/commerce.permissions';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeActor = (permissions: PermissionEnum[] = [], id = 'actor-1'): Actor => ({
    id,
    roles: [RoleEnum.ADMIN],
    permissions
});

const expectForbidden = (fn: () => void) => {
    expect(fn).toThrow(ServiceError);
    try {
        fn();
    } catch (err) {
        if (err instanceof ServiceError) {
            expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    }
};

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );
});

// ---------------------------------------------------------------------------
// checkCanCreateCommerce
// ---------------------------------------------------------------------------

describe('checkCanCreateCommerce', () => {
    it('should allow actor with COMMERCE_CREATE', () => {
        expect(() =>
            checkCanCreateCommerce(makeActor([PermissionEnum.COMMERCE_CREATE]), {})
        ).not.toThrow();
    });

    // HOS-687 / HOS-589 AC-27 — the service-side half of the pair.
    //
    // This is the second of the three bolts on the same door (the first is the
    // route's `requiredPermissions`, the third the web page's role gate). Both
    // server-side bolts answer identically from the caller's side, so asserting
    // only through the route would let a half-fix read as a whole one. This
    // block asserts the PREDICATE directly, with no HTTP in the picture.
    it('allows a signed-in account holding NO commerce permission at all (AC-27)', () => {
        expect(() => checkCanCreateCommerce(makeActor([]), {})).not.toThrow();
    });

    it('allows a plain USER whose only hat is USER (AC-1: the pre-owner case)', () => {
        const plainUser: Actor = { id: 'actor-plain', roles: [RoleEnum.USER], permissions: [] };
        expect(() => checkCanCreateCommerce(plainUser, {})).not.toThrow();
    });

    it('rejects a guest actor with UNAUTHORIZED, not FORBIDDEN', () => {
        // The guest sentinel carries a REAL uuid, so `!actor.id` is not a usable
        // authentication test — the predicate has to read the role set.
        const guest: Actor = {
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: []
        };
        expect(() => checkCanCreateCommerce(guest, {})).toThrow(ServiceError);
        try {
            checkCanCreateCommerce(guest, {});
            expect.unreachable('guest actor must be rejected');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.UNAUTHORIZED);
        }
    });

    it('rejects an actor carrying no roles at all', () => {
        const roleless: Actor = { id: 'actor-roleless', roles: [], permissions: [] };
        expect(() => checkCanCreateCommerce(roleless, {})).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkCanEditAll
// ---------------------------------------------------------------------------

describe('checkCanEditAll', () => {
    it('should allow actor with COMMERCE_EDIT_ALL', () => {
        expect(() =>
            checkCanEditAll(makeActor([PermissionEnum.COMMERCE_EDIT_ALL]), {})
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_EDIT_ALL', () => {
        expectForbidden(() => checkCanEditAll(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkCanEditOwn (SPEC-253 D2=b: single COMMERCE_EDIT_OWN, section param dropped)
// ---------------------------------------------------------------------------

describe('checkCanEditOwn', () => {
    const entity = { ownerId: 'actor-1' };
    const nonOwnedEntity = { ownerId: 'other-user' };

    it('should allow actor with COMMERCE_EDIT_ALL (staff bypass, any entity)', () => {
        expect(() =>
            checkCanEditOwn(makeActor([PermissionEnum.COMMERCE_EDIT_ALL]), nonOwnedEntity)
        ).not.toThrow();
    });

    it('should allow owner with COMMERCE_EDIT_OWN', () => {
        expect(() =>
            checkCanEditOwn(makeActor([PermissionEnum.COMMERCE_EDIT_OWN], 'actor-1'), entity)
        ).not.toThrow();
    });

    it('should forbid owner with COMMERCE_EDIT_OWN who is NOT the entity owner', () => {
        expectForbidden(() =>
            checkCanEditOwn(makeActor([PermissionEnum.COMMERCE_EDIT_OWN], 'other-actor'), entity)
        );
    });

    it('should forbid actor with no permissions', () => {
        expectForbidden(() => checkCanEditOwn(makeActor([]), entity));
    });
});

// ---------------------------------------------------------------------------
// checkCanDeleteCommerce
// ---------------------------------------------------------------------------

describe('checkCanDeleteCommerce', () => {
    it('should allow actor with COMMERCE_DELETE', () => {
        expect(() =>
            checkCanDeleteCommerce(makeActor([PermissionEnum.COMMERCE_DELETE]), {})
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_DELETE', () => {
        expectForbidden(() => checkCanDeleteCommerce(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkCanViewAll
// ---------------------------------------------------------------------------

describe('checkCanViewAll', () => {
    it('should allow actor with COMMERCE_VIEW_ALL', () => {
        expect(() => checkCanViewAll(makeActor([PermissionEnum.COMMERCE_VIEW_ALL]))).not.toThrow();
    });

    it('should forbid actor without COMMERCE_VIEW_ALL', () => {
        expectForbidden(() => checkCanViewAll(makeActor([])));
    });
});

// ---------------------------------------------------------------------------
// checkCanAdminListCommerce
// ---------------------------------------------------------------------------

describe('checkCanAdminListCommerce', () => {
    it('should allow actor with COMMERCE_VIEW_ALL', () => {
        expect(() =>
            checkCanAdminListCommerce(makeActor([PermissionEnum.COMMERCE_VIEW_ALL]))
        ).not.toThrow();
    });

    it('should allow actor with custom viewOwnPermission (COMMERCE_EDIT_OWN)', () => {
        expect(() =>
            checkCanAdminListCommerce(
                makeActor([PermissionEnum.COMMERCE_EDIT_OWN]),
                PermissionEnum.COMMERCE_EDIT_OWN
            )
        ).not.toThrow();
    });

    it('should forbid actor with neither permission', () => {
        expectForbidden(() => checkCanAdminListCommerce(makeActor([])));
    });
});

// ---------------------------------------------------------------------------
// checkCanModerateReview
// ---------------------------------------------------------------------------

describe('checkCanModerateReview', () => {
    it('should allow actor with COMMERCE_MODERATE_REVIEW', () => {
        expect(() =>
            checkCanModerateReview(makeActor([PermissionEnum.COMMERCE_MODERATE_REVIEW]))
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_MODERATE_REVIEW', () => {
        expectForbidden(() => checkCanModerateReview(makeActor([])));
    });
});
