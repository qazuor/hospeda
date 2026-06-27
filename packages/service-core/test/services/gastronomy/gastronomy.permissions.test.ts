/**
 * gastronomy.permissions.test.ts
 *
 * Unit tests for gastronomy permission helpers (SPEC-239 T-038).
 *
 * All tests use mocked `hasPermission` so they are completely decoupled
 * from the `Actor` shape and the permission registry. No DB is touched.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkGastronomyCanAdminList,
    checkGastronomyCanCreate,
    checkGastronomyCanDelete,
    checkGastronomyCanEditAll,
    checkGastronomyCanEditFaqs,
    checkGastronomyCanEditOwn,
    checkGastronomyCanHardDelete,
    checkGastronomyCanModerateReview,
    checkGastronomyCanRestore,
    checkGastronomyCanView
} from '../../../src/services/gastronomy/gastronomy.permissions';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeActor = (permissions: PermissionEnum[] = [], id = 'actor-uuid-1'): Actor => ({
    id,
    role: RoleEnum.ADMIN,
    permissions
});

const expectForbidden = (fn: () => void): void => {
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
// checkGastronomyCanCreate
// ---------------------------------------------------------------------------

describe('checkGastronomyCanCreate', () => {
    it('should allow actor with COMMERCE_CREATE', () => {
        expect(() =>
            checkGastronomyCanCreate(makeActor([PermissionEnum.COMMERCE_CREATE]), {})
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_CREATE', () => {
        expectForbidden(() => checkGastronomyCanCreate(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanEditAll
// ---------------------------------------------------------------------------

describe('checkGastronomyCanEditAll', () => {
    it('should allow actor with COMMERCE_EDIT_ALL', () => {
        expect(() =>
            checkGastronomyCanEditAll(makeActor([PermissionEnum.COMMERCE_EDIT_ALL]), {})
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_EDIT_ALL', () => {
        expectForbidden(() => checkGastronomyCanEditAll(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanEditOwn (SPEC-253 D2=b: single COMMERCE_EDIT_OWN)
// ---------------------------------------------------------------------------

describe('checkGastronomyCanEditOwn', () => {
    const entity = { ownerId: 'actor-uuid-1' };
    const nonOwnedEntity = { ownerId: 'other-owner' };

    it('should allow actor with COMMERCE_EDIT_ALL (staff bypass, any entity)', () => {
        expect(() =>
            checkGastronomyCanEditOwn(makeActor([PermissionEnum.COMMERCE_EDIT_ALL]), nonOwnedEntity)
        ).not.toThrow();
    });

    it('should allow owner with COMMERCE_EDIT_OWN', () => {
        expect(() =>
            checkGastronomyCanEditOwn(
                makeActor([PermissionEnum.COMMERCE_EDIT_OWN], 'actor-uuid-1'),
                entity
            )
        ).not.toThrow();
    });

    it('should forbid COMMERCE_EDIT_OWN actor who is NOT the owner', () => {
        expectForbidden(() =>
            checkGastronomyCanEditOwn(
                makeActor([PermissionEnum.COMMERCE_EDIT_OWN], 'other-actor'),
                entity
            )
        );
    });

    it('should forbid actor with no permissions', () => {
        expectForbidden(() => checkGastronomyCanEditOwn(makeActor([]), entity));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanDelete
// ---------------------------------------------------------------------------

describe('checkGastronomyCanDelete', () => {
    it('should allow actor with COMMERCE_DELETE', () => {
        expect(() =>
            checkGastronomyCanDelete(makeActor([PermissionEnum.COMMERCE_DELETE]), {})
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_DELETE', () => {
        expectForbidden(() => checkGastronomyCanDelete(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanHardDelete
// ---------------------------------------------------------------------------

describe('checkGastronomyCanHardDelete', () => {
    it('should allow actor with COMMERCE_DELETE', () => {
        expect(() =>
            checkGastronomyCanHardDelete(makeActor([PermissionEnum.COMMERCE_DELETE]), {})
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_DELETE', () => {
        expectForbidden(() => checkGastronomyCanHardDelete(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanRestore
// ---------------------------------------------------------------------------

describe('checkGastronomyCanRestore', () => {
    it('should allow actor with COMMERCE_EDIT_ALL', () => {
        expect(() =>
            checkGastronomyCanRestore(makeActor([PermissionEnum.COMMERCE_EDIT_ALL]), {})
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_EDIT_ALL', () => {
        expectForbidden(() => checkGastronomyCanRestore(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanAdminList
// ---------------------------------------------------------------------------

describe('checkGastronomyCanAdminList', () => {
    it('should allow actor with COMMERCE_VIEW_ALL', () => {
        expect(() =>
            checkGastronomyCanAdminList(makeActor([PermissionEnum.COMMERCE_VIEW_ALL]))
        ).not.toThrow();
    });

    it('should forbid actor with no permissions', () => {
        expectForbidden(() => checkGastronomyCanAdminList(makeActor([])));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanModerateReview
// ---------------------------------------------------------------------------

describe('checkGastronomyCanModerateReview', () => {
    it('should allow actor with COMMERCE_MODERATE_REVIEW', () => {
        expect(() =>
            checkGastronomyCanModerateReview(makeActor([PermissionEnum.COMMERCE_MODERATE_REVIEW]))
        ).not.toThrow();
    });

    it('should forbid actor without COMMERCE_MODERATE_REVIEW', () => {
        expectForbidden(() => checkGastronomyCanModerateReview(makeActor([])));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanEditFaqs (SPEC-253 D2=b: COMMERCE_FAQS_EDIT_OWN replaced by COMMERCE_EDIT_OWN)
// ---------------------------------------------------------------------------

describe('checkGastronomyCanEditFaqs', () => {
    const entity = { ownerId: 'actor-uuid-1' };
    const nonOwnedEntity = { ownerId: 'other-owner' };

    it('should allow actor with COMMERCE_EDIT_ALL on any entity', () => {
        expect(() =>
            checkGastronomyCanEditFaqs(
                makeActor([PermissionEnum.COMMERCE_EDIT_ALL]),
                nonOwnedEntity
            )
        ).not.toThrow();
    });

    it('should allow owner with COMMERCE_EDIT_OWN', () => {
        expect(() =>
            checkGastronomyCanEditFaqs(
                makeActor([PermissionEnum.COMMERCE_EDIT_OWN], 'actor-uuid-1'),
                entity
            )
        ).not.toThrow();
    });

    it('should forbid COMMERCE_EDIT_OWN actor who is NOT the owner', () => {
        expectForbidden(() =>
            checkGastronomyCanEditFaqs(
                makeActor([PermissionEnum.COMMERCE_EDIT_OWN], 'other-actor'),
                entity
            )
        );
    });

    it('should forbid actor with no commerce permissions', () => {
        expectForbidden(() => checkGastronomyCanEditFaqs(makeActor([]), entity));
    });
});

// ---------------------------------------------------------------------------
// checkGastronomyCanView (public — always allows)
// ---------------------------------------------------------------------------

describe('checkGastronomyCanView', () => {
    it('should allow any actor (public read)', () => {
        expect(() => checkGastronomyCanView(makeActor([]))).not.toThrow();
        expect(() =>
            checkGastronomyCanView(makeActor([PermissionEnum.COMMERCE_VIEW_ALL]))
        ).not.toThrow();
    });
});
