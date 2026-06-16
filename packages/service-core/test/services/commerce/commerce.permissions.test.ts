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
    role: RoleEnum.ADMIN,
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

    it('should forbid actor without COMMERCE_CREATE', () => {
        expectForbidden(() => checkCanCreateCommerce(makeActor([]), {}));
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
// checkCanEditOwn
// ---------------------------------------------------------------------------

describe('checkCanEditOwn', () => {
    const entity = { ownerId: 'actor-1' };
    const nonOwnedEntity = { ownerId: 'other-user' };

    it('should allow actor with COMMERCE_EDIT_ALL (any entity)', () => {
        expect(() =>
            checkCanEditOwn(
                makeActor([PermissionEnum.COMMERCE_EDIT_ALL]),
                nonOwnedEntity,
                PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN
            )
        ).not.toThrow();
    });

    it('should allow actor with section own permission who is the owner', () => {
        expect(() =>
            checkCanEditOwn(
                makeActor([PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN], 'actor-1'),
                entity,
                PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN
            )
        ).not.toThrow();
    });

    it('should forbid actor with section own permission who is NOT the owner', () => {
        expectForbidden(() =>
            checkCanEditOwn(
                makeActor([PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN], 'other-actor'),
                entity,
                PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN
            )
        );
    });

    it('should forbid actor with no permissions', () => {
        expectForbidden(() =>
            checkCanEditOwn(makeActor([]), entity, PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN)
        );
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

    it('should allow actor with custom viewOwnPermission', () => {
        expect(() =>
            checkCanAdminListCommerce(
                makeActor([PermissionEnum.COMMERCE_AMENITIES_EDIT_OWN]),
                PermissionEnum.COMMERCE_AMENITIES_EDIT_OWN
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
