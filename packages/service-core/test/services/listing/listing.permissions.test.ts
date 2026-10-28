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
    checkCanEditOwnOrAll,
    checkCanModerateReview,
    checkCanViewAll
} from '../../../src/services/listing/listing.permissions';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import { runWithAdministrativeAuthorization } from '../../../src/utils/administrative-authorization';
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
    it('should allow actor with VENUE_CREATE', () => {
        expect(() =>
            checkCanCreateListing(makeActor([PermissionEnum.VENUE_CREATE]), {})
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
    it('should allow actor with VENUE_EDIT_ALL', () => {
        expect(() =>
            checkCanEditAll(makeActor([PermissionEnum.VENUE_EDIT_ALL]), {}, 'venue')
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_EDIT_ALL', () => {
        expectForbidden(() => checkCanEditAll(makeActor([]), {}, 'venue'));
    });
});

// ---------------------------------------------------------------------------
// checkCanEditOwn (SPEC-253 D2=b: single VENUE_EDIT_OWN, section param dropped)
// ---------------------------------------------------------------------------

describe('checkCanEditOwn', () => {
    const entity = { ownerId: 'actor-1' };
    const nonOwnedEntity = { ownerId: 'other-user' };

    it('should allow actor with VENUE_EDIT_ALL (staff bypass, any entity)', () => {
        expect(() =>
            checkCanEditOwn(makeActor([PermissionEnum.VENUE_EDIT_ALL]), nonOwnedEntity, 'venue')
        ).not.toThrow();
    });

    it('should allow owner with VENUE_EDIT_OWN', () => {
        expect(() =>
            checkCanEditOwn(makeActor([PermissionEnum.VENUE_EDIT_OWN], 'actor-1'), entity, 'venue')
        ).not.toThrow();
    });

    it('should forbid owner with VENUE_EDIT_OWN who is NOT the entity owner', () => {
        expectForbidden(() =>
            checkCanEditOwn(
                makeActor([PermissionEnum.VENUE_EDIT_OWN], 'other-actor'),
                entity,
                'venue'
            )
        );
    });

    it('should forbid actor with no permissions', () => {
        expectForbidden(() => checkCanEditOwn(makeActor([]), entity, 'venue'));
    });
});

// ---------------------------------------------------------------------------
// checkCanDeleteListing
// ---------------------------------------------------------------------------

describe('checkCanDeleteListing', () => {
    it('should allow actor with VENUE_DELETE', () => {
        expect(() =>
            checkCanDeleteListing(makeActor([PermissionEnum.VENUE_DELETE]), {}, 'venue')
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_DELETE', () => {
        expectForbidden(() => checkCanDeleteListing(makeActor([]), {}, 'venue'));
    });
});

// ---------------------------------------------------------------------------
// checkCanViewAll
// ---------------------------------------------------------------------------

describe('checkCanViewAll', () => {
    it('should allow actor with VENUE_VIEW_ALL', () => {
        expect(() =>
            checkCanViewAll(makeActor([PermissionEnum.VENUE_VIEW_ALL]), 'venue')
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_VIEW_ALL', () => {
        expectForbidden(() => checkCanViewAll(makeActor([]), 'venue'));
    });
});

// ---------------------------------------------------------------------------
// checkCanAdminListListings
// ---------------------------------------------------------------------------

describe('checkCanAdminListListings', () => {
    it('should allow actor with VENUE_VIEW_ALL', () => {
        expect(() =>
            checkCanAdminListListings(makeActor([PermissionEnum.VENUE_VIEW_ALL]), 'venue')
        ).not.toThrow();
    });

    it('should allow actor holding only the vertical viewAll (HOS-1077)', () => {
        expect(() =>
            checkCanAdminListListings(makeActor([PermissionEnum.VENUE_VIEW_ALL]), 'venue')
        ).not.toThrow();
    });

    it('should forbid actor with neither permission', () => {
        expectForbidden(() => checkCanAdminListListings(makeActor([]), 'venue'));
    });
});

// ---------------------------------------------------------------------------
// checkCanModerateReview
// ---------------------------------------------------------------------------

describe('checkCanModerateReview', () => {
    it('should allow actor with VENUE_MODERATE_REVIEW', () => {
        expect(() =>
            checkCanModerateReview(makeActor([PermissionEnum.VENUE_MODERATE_REVIEW]), 'venue')
        ).not.toThrow();
    });

    it('should forbid actor without VENUE_MODERATE_REVIEW', () => {
        expectForbidden(() => checkCanModerateReview(makeActor([]), 'venue'));
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
        it('rejects VENUE_EDIT_ALL on an experience check', () => {
            expectForbidden(() =>
                checkCanEditAll(makeActor([PermissionEnum.VENUE_EDIT_ALL]), {}, 'experience')
            );
        });

        it('rejects EXPERIENCE_EDIT_ALL on a venue check', () => {
            expectForbidden(() =>
                checkCanEditAll(makeActor([PermissionEnum.EXPERIENCE_EDIT_ALL]), {}, 'venue')
            );
        });

        it('rejects a venue owner editing their own experience-vertical row', () => {
            expectForbidden(() =>
                checkCanEditOwn(
                    makeActor([PermissionEnum.VENUE_EDIT_OWN], 'actor-1'),
                    ownedEntity,
                    'experience'
                )
            );
        });
    });

    describe("the vertical's own permission passes", () => {
        it('accepts VENUE_EDIT_ALL on a venue check', () => {
            expect(() =>
                checkCanEditAll(makeActor([PermissionEnum.VENUE_EDIT_ALL]), {}, 'venue')
            ).not.toThrow();
        });

        it('accepts EXPERIENCE_EDIT_ALL on an experience check', () => {
            expect(() =>
                checkCanEditAll(makeActor([PermissionEnum.EXPERIENCE_EDIT_ALL]), {}, 'experience')
            ).not.toThrow();
        });

        it('accepts VENUE_EDIT_OWN for the owner of a venue listing', () => {
            expect(() =>
                checkCanEditOwn(makeActor([PermissionEnum.VENUE_EDIT_OWN]), ownedEntity, 'venue')
            ).not.toThrow();
        });
    });

    describe('one vertical does NOT grant the other — the whole point of HOS-1077', () => {
        it('VENUE_EDIT_ALL is refused on an experience check', () => {
            expectForbidden(() =>
                checkCanEditAll(makeActor([PermissionEnum.VENUE_EDIT_ALL]), {}, 'experience')
            );
        });

        it('EXPERIENCE_EDIT_ALL is refused on a venue check', () => {
            expectForbidden(() =>
                checkCanEditAll(makeActor([PermissionEnum.EXPERIENCE_EDIT_ALL]), {}, 'venue')
            );
        });

        it('VENUE_MODERATE_REVIEW is refused on an experience review check', () => {
            expectForbidden(() =>
                checkCanModerateReview(
                    makeActor([PermissionEnum.VENUE_MODERATE_REVIEW]),
                    'experience'
                )
            );
        });

        it('VENUE_VIEW_ALL is refused on an experience admin list', () => {
            expectForbidden(() =>
                checkCanAdminListListings(makeActor([PermissionEnum.VENUE_VIEW_ALL]), 'experience')
            );
        });

        it('VENUE_DELETE is refused on an experience delete', () => {
            expectForbidden(() =>
                checkCanDeleteListing(makeActor([PermissionEnum.VENUE_DELETE]), {}, 'experience')
            );
        });
    });

    describe('delete is scoped to its vertical', () => {
        it('rejects EXPERIENCE_DELETE on a venue check', () => {
            expectForbidden(() =>
                checkCanDeleteListing(makeActor([PermissionEnum.EXPERIENCE_DELETE]), {}, 'venue')
            );
        });
    });
});

// ---------------------------------------------------------------------------
// checkCanEditOwnOrAll — action 15 own permission (ACC:15, HOS-1493)
// ---------------------------------------------------------------------------

describe('checkCanEditOwnOrAll and action 15 (explicit authorization only)', () => {
    const FOREIGN = PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT;
    // No role at all: the decision reads permissions and the scope only.
    const roleless = (permissions: PermissionEnum[], id: string): Actor => ({
        id,
        roles: [],
        permissions
    });
    const inScope = (subjectId: string, run: () => void) =>
        runWithAdministrativeAuthorization({
            authorization: { action: 'ACC_15', subjectId },
            run: async () => run()
        });

    it.each([
        'venue',
        'experience'
    ] as const)('refuses the action 15 permission alone on a foreign %s listing', (vertical) => {
        expectForbidden(() =>
            checkCanEditOwnOrAll(roleless([FOREIGN], 'admin-1'), { ownerId: 'owner-1' }, vertical)
        );
    });

    it.each([
        'venue',
        'experience'
    ] as const)('lets action 15 edit a foreign %s listing inside a scope bound to its owner', async (vertical) => {
        await inScope('owner-1', () => {
            expect(() =>
                checkCanEditOwnOrAll(
                    roleless([FOREIGN], 'admin-1'),
                    { ownerId: 'owner-1' },
                    vertical
                )
            ).not.toThrow();
        });
    });

    it('refuses a scope bound to a different owner', async () => {
        await inScope('owner-2', () => {
            expectForbidden(() =>
                checkCanEditOwnOrAll(
                    roleless([FOREIGN], 'admin-1'),
                    { ownerId: 'owner-1' },
                    'venue'
                )
            );
        });
    });

    it('does not let the owner use action 15 without EDIT_OWN', async () => {
        await inScope('owner-1', () => {
            expectForbidden(() =>
                checkCanEditOwnOrAll(
                    roleless([FOREIGN], 'owner-1'),
                    { ownerId: 'owner-1' },
                    'venue'
                )
            );
        });
    });
});
