/**
 * experience.permissions.test.ts
 *
 * Unit tests for experience permission helpers (SPEC-240 T-015).
 *
 * Verifies that each helper throws FORBIDDEN (via ServiceError) when the actor
 * lacks the required COMMERCE_* permission, and does NOT throw when the actor
 * has it.  All helpers delegate to the shared commerce.permissions helpers — we
 * test the delegation contract, not re-test the underlying implementation.
 *
 * DB interactions: none — pure function tests.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkExperienceCanAdminList,
    checkExperienceCanCreate,
    checkExperienceCanDelete,
    checkExperienceCanEditAll,
    checkExperienceCanEditFaqs,
    checkExperienceCanEditOwn,
    checkExperienceCanHardDelete,
    checkExperienceCanModerateReview,
    checkExperienceCanRestore,
    checkExperienceCanView
} from '../../../src/services/experience/experience.permissions';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Actor fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = '00000000-0000-4000-a000-000000000001';

const staffActor: Actor = {
    id: 'staff-uuid',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.COMMERCE_CREATE,
        PermissionEnum.COMMERCE_EDIT_ALL,
        PermissionEnum.COMMERCE_DELETE,
        PermissionEnum.COMMERCE_VIEW_ALL,
        PermissionEnum.COMMERCE_MODERATE_REVIEW
    ]
};

const ownerActor: Actor = {
    id: OWNER_ID,
    role: RoleEnum.COMMERCE_OWNER,
    // SPEC-253 D2=b: single COMMERCE_EDIT_OWN replaces the per-section perms
    permissions: [PermissionEnum.COMMERCE_EDIT_OWN]
};

const noPermActor: Actor = {
    id: 'no-perm-user',
    role: RoleEnum.USER,
    permissions: []
};

const entity = { id: 'ent-1', ownerId: OWNER_ID };
const entityOtherOwner = { id: 'ent-2', ownerId: 'other-owner-id' };

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );
});

// ---------------------------------------------------------------------------
// checkExperienceCanCreate
// ---------------------------------------------------------------------------

describe('checkExperienceCanCreate', () => {
    it('should not throw for actor with COMMERCE_CREATE', () => {
        expect(() => checkExperienceCanCreate(staffActor, {})).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without COMMERCE_CREATE', () => {
        expect(() => checkExperienceCanCreate(noPermActor, {})).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanEditAll
// ---------------------------------------------------------------------------

describe('checkExperienceCanEditAll', () => {
    it('should not throw for actor with COMMERCE_EDIT_ALL', () => {
        expect(() => checkExperienceCanEditAll(staffActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without COMMERCE_EDIT_ALL', () => {
        expect(() => checkExperienceCanEditAll(noPermActor, entity)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanEditOwn (SPEC-253 D2=b: single COMMERCE_EDIT_OWN)
// ---------------------------------------------------------------------------

describe('checkExperienceCanEditOwn', () => {
    it('should not throw for the listing owner with COMMERCE_EDIT_OWN', () => {
        expect(() => checkExperienceCanEditOwn(ownerActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for a non-owner actor with no permissions', () => {
        expect(() => checkExperienceCanEditOwn(noPermActor, entity)).toThrow(ServiceError);
    });

    it('should throw FORBIDDEN for owner of a different listing (entity mismatch)', () => {
        // ownerActor.id === OWNER_ID, but entityOtherOwner.ownerId !== OWNER_ID
        expect(() => checkExperienceCanEditOwn(ownerActor, entityOtherOwner)).toThrow(ServiceError);
    });

    it('should not throw for staff with COMMERCE_EDIT_ALL (bypasses ownership check)', () => {
        expect(() => checkExperienceCanEditOwn(staffActor, entityOtherOwner)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanDelete
// ---------------------------------------------------------------------------

describe('checkExperienceCanDelete', () => {
    it('should not throw for actor with COMMERCE_DELETE', () => {
        expect(() => checkExperienceCanDelete(staffActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without COMMERCE_DELETE', () => {
        expect(() => checkExperienceCanDelete(noPermActor, entity)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanHardDelete
// ---------------------------------------------------------------------------

describe('checkExperienceCanHardDelete', () => {
    it('should not throw for actor with COMMERCE_DELETE', () => {
        expect(() => checkExperienceCanHardDelete(staffActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without COMMERCE_DELETE', () => {
        try {
            checkExperienceCanHardDelete(noPermActor, entity);
            expect.fail('Expected FORBIDDEN ServiceError to be thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanRestore
// ---------------------------------------------------------------------------

describe('checkExperienceCanRestore', () => {
    it('should not throw for actor with COMMERCE_EDIT_ALL', () => {
        expect(() => checkExperienceCanRestore(staffActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without COMMERCE_EDIT_ALL', () => {
        expect(() => checkExperienceCanRestore(noPermActor, entity)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanView (always passes)
// ---------------------------------------------------------------------------

describe('checkExperienceCanView', () => {
    it('should not throw for any actor (public listings are open)', () => {
        expect(() => checkExperienceCanView(noPermActor)).not.toThrow();
        expect(() => checkExperienceCanView(staffActor)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanAdminList
// ---------------------------------------------------------------------------

describe('checkExperienceCanAdminList', () => {
    it('should not throw for actor with COMMERCE_VIEW_ALL', () => {
        expect(() => checkExperienceCanAdminList(staffActor)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without COMMERCE_VIEW_ALL', () => {
        expect(() => checkExperienceCanAdminList(noPermActor)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanModerateReview
// ---------------------------------------------------------------------------

describe('checkExperienceCanModerateReview', () => {
    it('should not throw for actor with COMMERCE_MODERATE_REVIEW', () => {
        expect(() => checkExperienceCanModerateReview(staffActor)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without COMMERCE_MODERATE_REVIEW', () => {
        expect(() => checkExperienceCanModerateReview(noPermActor)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanEditFaqs (SPEC-253 D2=b: COMMERCE_FAQS_EDIT_OWN -> COMMERCE_EDIT_OWN)
// ---------------------------------------------------------------------------

describe('checkExperienceCanEditFaqs', () => {
    it('should not throw for the listing owner with COMMERCE_EDIT_OWN', () => {
        expect(() => checkExperienceCanEditFaqs(ownerActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for a non-owner with no permissions', () => {
        expect(() => checkExperienceCanEditFaqs(noPermActor, entity)).toThrow(ServiceError);
    });

    it('should not throw for staff with COMMERCE_EDIT_ALL (any entity)', () => {
        expect(() => checkExperienceCanEditFaqs(staffActor, entityOtherOwner)).not.toThrow();
    });

    it('should throw FORBIDDEN for COMMERCE_EDIT_OWN actor who is NOT the owner', () => {
        expect(() => checkExperienceCanEditFaqs(ownerActor, entityOtherOwner)).toThrow(
            ServiceError
        );
    });
});
