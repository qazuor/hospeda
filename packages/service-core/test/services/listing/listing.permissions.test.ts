/**
 * listing.permissions.test.ts
 *
 * Unit tests for listing permission helpers (SPEC-239 T-030).
 *
 * All tests use mocked `hasPermission` so they are completely decoupled
 * from the `Actor` shape and the permission registry.  No real DB is touched.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkCanAdminListListings,
    checkCanCreateListing,
    checkCanDeleteListing,
    checkCanEditAll,
    checkCanEditOwn,
    checkCanModerateListing,
    checkCanModerateReview,
    checkCanViewAll
} from '../../../src/services/listing/listing.permissions';
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
// checkCanCreateListing
// ---------------------------------------------------------------------------

describe('checkCanCreateListing', () => {
    it('should allow actor with GASTRONOMY_CREATE', () => {
        expect(() =>
            checkCanCreateListing(makeActor([PermissionEnum.GASTRONOMY_CREATE]), {})
        ).not.toThrow();
    });

    // HOS-687 / HOS-589 AC-27 — the service-side half of the pair.
    //
    // This is the second of the three bolts on the same door (the first is the
    // route's `requiredPermissions`, the third the web page's role gate). Both
    // server-side bolts answer identically from the caller's side, so asserting
    // only through the route would let a half-fix read as a whole one. This
    // block asserts the PREDICATE directly, with no HTTP in the picture.
    it('allows a signed-in account holding NO listing permission at all (AC-27)', () => {
        expect(() => checkCanCreateListing(makeActor([]), {})).not.toThrow();
    });

    it('allows a plain USER whose only hat is USER (AC-1: the pre-owner case)', () => {
        const plainUser: Actor = { id: 'actor-plain', roles: [RoleEnum.USER], permissions: [] };
        expect(() => checkCanCreateListing(plainUser, {})).not.toThrow();
    });

    it('rejects a guest actor with UNAUTHORIZED, not FORBIDDEN', () => {
        // The guest sentinel carries a REAL uuid, so `!actor.id` is not a usable
        // authentication test — the predicate has to read the role set.
        const guest: Actor = {
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: []
        };
        expect(() => checkCanCreateListing(guest, {})).toThrow(ServiceError);
        try {
            checkCanCreateListing(guest, {});
            expect.unreachable('guest actor must be rejected');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.UNAUTHORIZED);
        }
    });

    it('rejects an actor carrying no roles at all', () => {
        const roleless: Actor = { id: 'actor-roleless', roles: [], permissions: [] };
        expect(() => checkCanCreateListing(roleless, {})).toThrow(ServiceError);
    });
});

// ---------------------------------------------------------------------------
// checkCanEditAll
// ---------------------------------------------------------------------------

describe('checkCanEditAll', () => {
    it('should allow actor with GASTRONOMY_EDIT_ALL', () => {
        expect(() =>
            checkCanEditAll(makeActor([PermissionEnum.GASTRONOMY_EDIT_ALL]), {}, 'gastronomy')
        ).not.toThrow();
    });

    it('should forbid actor without GASTRONOMY_EDIT_ALL', () => {
        expectForbidden(() => checkCanEditAll(makeActor([]), {}, 'gastronomy'));
    });
});

// ---------------------------------------------------------------------------
// checkCanEditOwn (SPEC-253 D2=b: single GASTRONOMY_EDIT_OWN, section param dropped)
// ---------------------------------------------------------------------------

describe('checkCanEditOwn', () => {
    const entity = { ownerId: 'actor-1' };
    const nonOwnedEntity = { ownerId: 'other-user' };

    it('should allow actor with GASTRONOMY_EDIT_ALL (staff bypass, any entity)', () => {
        expect(() =>
            checkCanEditOwn(
                makeActor([PermissionEnum.GASTRONOMY_EDIT_ALL]),
                nonOwnedEntity,
                'gastronomy'
            )
        ).not.toThrow();
    });

    it('should allow owner with GASTRONOMY_EDIT_OWN', () => {
        expect(() =>
            checkCanEditOwn(
                makeActor([PermissionEnum.GASTRONOMY_EDIT_OWN], 'actor-1'),
                entity,
                'gastronomy'
            )
        ).not.toThrow();
    });

    it('should forbid owner with GASTRONOMY_EDIT_OWN who is NOT the entity owner', () => {
        expectForbidden(() =>
            checkCanEditOwn(
                makeActor([PermissionEnum.GASTRONOMY_EDIT_OWN], 'other-actor'),
                entity,
                'gastronomy'
            )
        );
    });

    it('should forbid actor with no permissions', () => {
        expectForbidden(() => checkCanEditOwn(makeActor([]), entity, 'gastronomy'));
    });
});

// ---------------------------------------------------------------------------
// checkCanDeleteListing
// ---------------------------------------------------------------------------

describe('checkCanDeleteListing', () => {
    it('should allow actor with GASTRONOMY_DELETE', () => {
        expect(() =>
            checkCanDeleteListing(makeActor([PermissionEnum.GASTRONOMY_DELETE]), {}, 'gastronomy')
        ).not.toThrow();
    });

    it('should forbid actor without GASTRONOMY_DELETE', () => {
        expectForbidden(() => checkCanDeleteListing(makeActor([]), {}, 'gastronomy'));
    });
});

// ---------------------------------------------------------------------------
// checkCanViewAll
// ---------------------------------------------------------------------------

describe('checkCanViewAll', () => {
    it('should allow actor with GASTRONOMY_VIEW_ALL', () => {
        expect(() =>
            checkCanViewAll(makeActor([PermissionEnum.GASTRONOMY_VIEW_ALL]), 'gastronomy')
        ).not.toThrow();
    });

    it('should forbid actor without GASTRONOMY_VIEW_ALL', () => {
        expectForbidden(() => checkCanViewAll(makeActor([]), 'gastronomy'));
    });
});

// ---------------------------------------------------------------------------
// checkCanAdminListListings
// ---------------------------------------------------------------------------

describe('checkCanAdminListListings', () => {
    it('should allow actor with GASTRONOMY_VIEW_ALL', () => {
        expect(() =>
            checkCanAdminListListings(makeActor([PermissionEnum.GASTRONOMY_VIEW_ALL]), 'gastronomy')
        ).not.toThrow();
    });

    it('should allow actor holding only the vertical viewAll (HOS-1077)', () => {
        expect(() =>
            checkCanAdminListListings(makeActor([PermissionEnum.GASTRONOMY_VIEW_ALL]), 'gastronomy')
        ).not.toThrow();
    });

    it('should forbid actor with neither permission', () => {
        expectForbidden(() => checkCanAdminListListings(makeActor([]), 'gastronomy'));
    });
});

// ---------------------------------------------------------------------------
// checkCanModerateReview
// ---------------------------------------------------------------------------

describe('checkCanModerateReview', () => {
    it('should allow actor with GASTRONOMY_MODERATE_REVIEW', () => {
        expect(() =>
            checkCanModerateReview(
                makeActor([PermissionEnum.GASTRONOMY_MODERATE_REVIEW]),
                'gastronomy'
            )
        ).not.toThrow();
    });

    it('should forbid actor without GASTRONOMY_MODERATE_REVIEW', () => {
        expectForbidden(() => checkCanModerateReview(makeActor([]), 'gastronomy'));
    });
});

// ---------------------------------------------------------------------------
// HOS-1077 — per-vertical split
//
// Every check names its vertical, and only that vertical's permission passes.
// ---------------------------------------------------------------------------

describe('HOS-1077 per-vertical permission split', () => {
    const ownedEntity = { ownerId: 'actor-1' };

    describe('one vertical never authorizes the other (HOS-1417 fail-closed)', () => {
        it('rejects GASTRONOMY_EDIT_ALL on an experience check', () => {
            expectForbidden(() =>
                checkCanEditAll(makeActor([PermissionEnum.GASTRONOMY_EDIT_ALL]), {}, 'experience')
            );
        });

        it('rejects EXPERIENCE_EDIT_ALL on a gastronomy check', () => {
            expectForbidden(() =>
                checkCanEditAll(makeActor([PermissionEnum.EXPERIENCE_EDIT_ALL]), {}, 'gastronomy')
            );
        });

        it('rejects EXPERIENCE_MODERATION_CHANGE on a gastronomy check', () => {
            expectForbidden(() =>
                checkCanModerateListing(
                    makeActor([PermissionEnum.EXPERIENCE_MODERATION_CHANGE]),
                    'gastronomy'
                )
            );
        });

        it('rejects a gastronomy owner editing their own experience-vertical row', () => {
            expectForbidden(() =>
                checkCanEditOwn(
                    makeActor([PermissionEnum.GASTRONOMY_EDIT_OWN], 'actor-1'),
                    ownedEntity,
                    'experience'
                )
            );
        });
    });

    describe("the vertical's own permission passes", () => {
        it('accepts GASTRONOMY_EDIT_ALL on a gastronomy check', () => {
            expect(() =>
                checkCanEditAll(makeActor([PermissionEnum.GASTRONOMY_EDIT_ALL]), {}, 'gastronomy')
            ).not.toThrow();
        });

        it('accepts EXPERIENCE_EDIT_ALL on an experience check', () => {
            expect(() =>
                checkCanEditAll(makeActor([PermissionEnum.EXPERIENCE_EDIT_ALL]), {}, 'experience')
            ).not.toThrow();
        });

        it('accepts GASTRONOMY_EDIT_OWN for the owner of a gastronomy listing', () => {
            expect(() =>
                checkCanEditOwn(
                    makeActor([PermissionEnum.GASTRONOMY_EDIT_OWN]),
                    ownedEntity,
                    'gastronomy'
                )
            ).not.toThrow();
        });

        it('accepts EXPERIENCE_MODERATION_CHANGE on an experience listing', () => {
            expect(() =>
                checkCanModerateListing(
                    makeActor([PermissionEnum.EXPERIENCE_MODERATION_CHANGE]),
                    'experience'
                )
            ).not.toThrow();
        });
    });

    describe('one vertical does NOT grant the other — the whole point of HOS-1077', () => {
        it('GASTRONOMY_EDIT_ALL is refused on an experience check', () => {
            expectForbidden(() =>
                checkCanEditAll(makeActor([PermissionEnum.GASTRONOMY_EDIT_ALL]), {}, 'experience')
            );
        });

        it('EXPERIENCE_EDIT_ALL is refused on a gastronomy check', () => {
            expectForbidden(() =>
                checkCanEditAll(makeActor([PermissionEnum.EXPERIENCE_EDIT_ALL]), {}, 'gastronomy')
            );
        });

        it('GASTRONOMY_MODERATE_REVIEW is refused on an experience review check', () => {
            expectForbidden(() =>
                checkCanModerateReview(
                    makeActor([PermissionEnum.GASTRONOMY_MODERATE_REVIEW]),
                    'experience'
                )
            );
        });

        it('EXPERIENCE_MODERATION_CHANGE is refused on a gastronomy listing', () => {
            expectForbidden(() =>
                checkCanModerateListing(
                    makeActor([PermissionEnum.EXPERIENCE_MODERATION_CHANGE]),
                    'gastronomy'
                )
            );
        });

        it('GASTRONOMY_VIEW_ALL is refused on an experience admin list', () => {
            expectForbidden(() =>
                checkCanAdminListListings(
                    makeActor([PermissionEnum.GASTRONOMY_VIEW_ALL]),
                    'experience'
                )
            );
        });

        it('GASTRONOMY_DELETE is refused on an experience delete', () => {
            expectForbidden(() =>
                checkCanDeleteListing(
                    makeActor([PermissionEnum.GASTRONOMY_DELETE]),
                    {},
                    'experience'
                )
            );
        });
    });

    describe('delete is scoped to its vertical', () => {
        it('rejects EXPERIENCE_DELETE on a gastronomy check', () => {
            expectForbidden(() =>
                checkCanDeleteListing(
                    makeActor([PermissionEnum.EXPERIENCE_DELETE]),
                    {},
                    'gastronomy'
                )
            );
        });
    });
});
