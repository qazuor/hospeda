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
    checkVenueCanAdminList,
    checkVenueCanCreate,
    checkVenueCanDelete,
    checkVenueCanEditAll,
    checkVenueCanEditFaqs,
    checkVenueCanEditOwn,
    checkVenueCanHardDelete,
    checkVenueCanModerateReview,
    checkVenueCanRestore,
    checkVenueCanView
} from '../../../src/services/venue/venue.permissions';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeActor = (permissions: PermissionEnum[] = [], id = 'actor-uuid-1'): Actor => ({
    id,
    roles: [RoleEnum.ADMIN],
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
// checkVenueCanCreate
// ---------------------------------------------------------------------------

describe('checkGastronomyCanCreate', () => {
    it('should allow actor with VENUE_CREATE', () => {
        expect(() =>
            checkVenueCanCreate(makeActor([PermissionEnum.VENUE_CREATE]), {})
        ).not.toThrow();
    });

    // HOS-687 / HOS-589 AC-27 (service predicate, gastronomy vertical).
    it('allows a signed-in account holding NO listing permission (AC-27)', () => {
        const plainUser: Actor = { id: 'actor-plain', roles: [RoleEnum.USER], permissions: [] };
        expect(() => checkVenueCanCreate(plainUser, {})).not.toThrow();
    });

    it('still rejects a guest actor', () => {
        const guest: Actor = {
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: []
        };
        expect(() => checkVenueCanCreate(guest, {})).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanEditAll
// ---------------------------------------------------------------------------

describe('checkGastronomyCanEditAll', () => {
    it('should allow actor with VENUE_EDIT_ALL', () => {
        expect(() =>
            checkVenueCanEditAll(makeActor([PermissionEnum.VENUE_EDIT_ALL]), {})
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_EDIT_ALL', () => {
        expectForbidden(() => checkVenueCanEditAll(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanEditOwn (SPEC-253 D2=b: single VENUE_EDIT_OWN)
// ---------------------------------------------------------------------------

describe('checkGastronomyCanEditOwn', () => {
    const entity = { ownerId: 'actor-uuid-1' };
    const nonOwnedEntity = { ownerId: 'other-owner' };

    it('should allow actor with VENUE_EDIT_ALL (staff bypass, any entity)', () => {
        expect(() =>
            checkVenueCanEditOwn(makeActor([PermissionEnum.VENUE_EDIT_ALL]), nonOwnedEntity)
        ).not.toThrow();
    });

    it('should allow owner with VENUE_EDIT_OWN', () => {
        expect(() =>
            checkVenueCanEditOwn(makeActor([PermissionEnum.VENUE_EDIT_OWN], 'actor-uuid-1'), entity)
        ).not.toThrow();
    });

    it('should forbid VENUE_EDIT_OWN actor who is NOT the owner', () => {
        expectForbidden(() =>
            checkVenueCanEditOwn(makeActor([PermissionEnum.VENUE_EDIT_OWN], 'other-actor'), entity)
        );
    });

    it('should forbid actor with no permissions', () => {
        expectForbidden(() => checkVenueCanEditOwn(makeActor([]), entity));
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanDelete
// ---------------------------------------------------------------------------

describe('checkGastronomyCanDelete', () => {
    it('should allow actor with VENUE_DELETE', () => {
        expect(() =>
            checkVenueCanDelete(makeActor([PermissionEnum.VENUE_DELETE]), {})
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_DELETE', () => {
        expectForbidden(() => checkVenueCanDelete(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanHardDelete
// ---------------------------------------------------------------------------

describe('checkGastronomyCanHardDelete', () => {
    it('should allow actor with VENUE_DELETE', () => {
        expect(() =>
            checkVenueCanHardDelete(makeActor([PermissionEnum.VENUE_DELETE]), {})
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_DELETE', () => {
        expectForbidden(() => checkVenueCanHardDelete(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanRestore
// ---------------------------------------------------------------------------

describe('checkGastronomyCanRestore', () => {
    it('should allow actor with VENUE_EDIT_ALL', () => {
        expect(() =>
            checkVenueCanRestore(makeActor([PermissionEnum.VENUE_EDIT_ALL]), {})
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_EDIT_ALL', () => {
        expectForbidden(() => checkVenueCanRestore(makeActor([]), {}));
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanAdminList
// ---------------------------------------------------------------------------

describe('checkGastronomyCanAdminList', () => {
    it('should allow actor with VENUE_VIEW_ALL', () => {
        expect(() =>
            checkVenueCanAdminList(makeActor([PermissionEnum.VENUE_VIEW_ALL]))
        ).not.toThrow();
    });

    it('should forbid actor with no permissions', () => {
        expectForbidden(() => checkVenueCanAdminList(makeActor([])));
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanModerateReview
// ---------------------------------------------------------------------------

describe('checkGastronomyCanModerateReview', () => {
    it('should allow actor with VENUE_MODERATE_REVIEW', () => {
        expect(() =>
            checkVenueCanModerateReview(makeActor([PermissionEnum.VENUE_MODERATE_REVIEW]))
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_MODERATE_REVIEW', () => {
        expectForbidden(() => checkVenueCanModerateReview(makeActor([])));
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanEditFaqs (SPEC-253 D2=b: the per-section FAQ permission replaced by VENUE_EDIT_OWN)
// ---------------------------------------------------------------------------

describe('checkGastronomyCanEditFaqs', () => {
    const entity = { ownerId: 'actor-uuid-1' };
    const nonOwnedEntity = { ownerId: 'other-owner' };

    it('should allow actor with VENUE_EDIT_ALL on any entity', () => {
        expect(() =>
            checkVenueCanEditFaqs(makeActor([PermissionEnum.VENUE_EDIT_ALL]), nonOwnedEntity)
        ).not.toThrow();
    });

    it('should allow owner with VENUE_EDIT_OWN', () => {
        expect(() =>
            checkVenueCanEditFaqs(
                makeActor([PermissionEnum.VENUE_EDIT_OWN], 'actor-uuid-1'),
                entity
            )
        ).not.toThrow();
    });

    it('should forbid VENUE_EDIT_OWN actor who is NOT the owner', () => {
        expectForbidden(() =>
            checkVenueCanEditFaqs(makeActor([PermissionEnum.VENUE_EDIT_OWN], 'other-actor'), entity)
        );
    });

    it('should forbid actor with no listing permission', () => {
        expectForbidden(() => checkVenueCanEditFaqs(makeActor([]), entity));
    });
});

// ---------------------------------------------------------------------------
// checkVenueCanView (public — always allows)
// ---------------------------------------------------------------------------

describe('checkGastronomyCanView', () => {
    it('should allow any actor (public read)', () => {
        expect(() => checkVenueCanView(makeActor([]))).not.toThrow();
        expect(() => checkVenueCanView(makeActor([PermissionEnum.VENUE_VIEW_ALL]))).not.toThrow();
    });
});
