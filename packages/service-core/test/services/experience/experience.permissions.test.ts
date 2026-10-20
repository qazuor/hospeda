/**
 * experience.permissions.test.ts
 *
 * Unit tests for experience permission helpers (SPEC-240 T-015).
 *
 * Verifies that each helper throws FORBIDDEN (via ServiceError) when the actor
 * lacks the required per-vertical permission, and does NOT throw when the actor
 * has it.  All helpers delegate to the shared listing.permissions helpers — we
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
    roles: [RoleEnum.ADMIN],
    permissions: [
        PermissionEnum.EXPERIENCE_CREATE,
        PermissionEnum.EXPERIENCE_EDIT_ALL,
        PermissionEnum.EXPERIENCE_DELETE,
        PermissionEnum.EXPERIENCE_VIEW_ALL,
        PermissionEnum.EXPERIENCE_MODERATE_REVIEW
    ]
};

const ownerActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.EXPERIENCE_OWNER],
    // SPEC-253 D2=b: single EXPERIENCE_EDIT_OWN replaces the per-section perms
    permissions: [PermissionEnum.EXPERIENCE_EDIT_OWN]
};

const noPermActor: Actor = {
    id: 'no-perm-user',
    roles: [RoleEnum.USER],
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
    it('should not throw for actor with EXPERIENCE_CREATE', () => {
        expect(() => checkExperienceCanCreate(staffActor, {})).not.toThrow();
    });

    // HOS-687 / HOS-589 AC-27 (service predicate, experience vertical).
    it('allows a signed-in account holding NO listing permission (AC-27)', () => {
        expect(() => checkExperienceCanCreate(noPermActor, {})).not.toThrow();
    });

    it('still rejects a guest actor', () => {
        const guest: Actor = {
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: []
        };
        expect(() => checkExperienceCanCreate(guest, {})).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanEditAll
// ---------------------------------------------------------------------------

describe('checkExperienceCanEditAll', () => {
    it('should not throw for actor with EXPERIENCE_EDIT_ALL', () => {
        expect(() => checkExperienceCanEditAll(staffActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without EXPERIENCE_EDIT_ALL', () => {
        expect(() => checkExperienceCanEditAll(noPermActor, entity)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanEditOwn (SPEC-253 D2=b: single EXPERIENCE_EDIT_OWN)
// ---------------------------------------------------------------------------

describe('checkExperienceCanEditOwn', () => {
    it('should not throw for the listing owner with EXPERIENCE_EDIT_OWN', () => {
        expect(() => checkExperienceCanEditOwn(ownerActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for a non-owner actor with no permissions', () => {
        expect(() => checkExperienceCanEditOwn(noPermActor, entity)).toThrow(ServiceError);
    });

    it('should throw FORBIDDEN for owner of a different listing (entity mismatch)', () => {
        // ownerActor.id === OWNER_ID, but entityOtherOwner.ownerId !== OWNER_ID
        expect(() => checkExperienceCanEditOwn(ownerActor, entityOtherOwner)).toThrow(ServiceError);
    });

    it('should not throw for staff with EXPERIENCE_EDIT_ALL (bypasses ownership check)', () => {
        expect(() => checkExperienceCanEditOwn(staffActor, entityOtherOwner)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanDelete
// ---------------------------------------------------------------------------

describe('checkExperienceCanDelete', () => {
    it('should not throw for actor with EXPERIENCE_DELETE', () => {
        expect(() => checkExperienceCanDelete(staffActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without EXPERIENCE_DELETE', () => {
        expect(() => checkExperienceCanDelete(noPermActor, entity)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanHardDelete
// ---------------------------------------------------------------------------

describe('checkExperienceCanHardDelete', () => {
    it('should not throw for actor with EXPERIENCE_DELETE', () => {
        expect(() => checkExperienceCanHardDelete(staffActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without EXPERIENCE_DELETE', () => {
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
    it('should not throw for actor with EXPERIENCE_EDIT_ALL', () => {
        expect(() => checkExperienceCanRestore(staffActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without EXPERIENCE_EDIT_ALL', () => {
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
    it('should not throw for actor with EXPERIENCE_VIEW_ALL', () => {
        expect(() => checkExperienceCanAdminList(staffActor)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without EXPERIENCE_VIEW_ALL', () => {
        expect(() => checkExperienceCanAdminList(noPermActor)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanModerateReview
// ---------------------------------------------------------------------------

describe('checkExperienceCanModerateReview', () => {
    it('should not throw for actor with EXPERIENCE_MODERATE_REVIEW', () => {
        expect(() => checkExperienceCanModerateReview(staffActor)).not.toThrow();
    });

    it('should throw FORBIDDEN for actor without EXPERIENCE_MODERATE_REVIEW', () => {
        expect(() => checkExperienceCanModerateReview(noPermActor)).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkExperienceCanEditFaqs (SPEC-253 D2=b: the per-section FAQ permission -> EXPERIENCE_EDIT_OWN)
// ---------------------------------------------------------------------------

describe('checkExperienceCanEditFaqs', () => {
    it('should not throw for the listing owner with EXPERIENCE_EDIT_OWN', () => {
        expect(() => checkExperienceCanEditFaqs(ownerActor, entity)).not.toThrow();
    });

    it('should throw FORBIDDEN for a non-owner with no permissions', () => {
        expect(() => checkExperienceCanEditFaqs(noPermActor, entity)).toThrow(ServiceError);
    });

    it('should not throw for staff with EXPERIENCE_EDIT_ALL (any entity)', () => {
        expect(() => checkExperienceCanEditFaqs(staffActor, entityOtherOwner)).not.toThrow();
    });

    it('should throw FORBIDDEN for EXPERIENCE_EDIT_OWN actor who is NOT the owner', () => {
        expect(() => checkExperienceCanEditFaqs(ownerActor, entityOtherOwner)).toThrow(
            ServiceError
        );
    });
});
