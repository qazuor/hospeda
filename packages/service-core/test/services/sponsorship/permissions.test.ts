import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanCount,
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from '../../../src/services/sponsorship/sponsorship.permissions';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import {
    createMockSponsorship,
    createMockSponsorshipCreateInput,
    getMockSponsorshipId
} from '../../factories/sponsorshipFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that a permission-check function throws a ServiceError with FORBIDDEN code.
 */
function expectForbidden(fn: () => void): void {
    expect(fn).toThrow(ServiceError);
    try {
        fn();
    } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
    }
}

/**
 * Asserts that a permission-check function does NOT throw.
 */
function expectAllowed(fn: () => void): void {
    expect(fn).not.toThrow();
}

// ---------------------------------------------------------------------------
// checkCanCreate
// ---------------------------------------------------------------------------

describe('checkCanCreate', () => {
    it('should allow actor with SPONSORSHIP_CREATE permission', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_CREATE] });
        const data = createMockSponsorshipCreateInput();
        expectAllowed(() => checkCanCreate(actor, data));
    });

    it('should throw FORBIDDEN when actor lacks SPONSORSHIP_CREATE permission', () => {
        const actor = createActor({ permissions: [] });
        const data = createMockSponsorshipCreateInput();
        expectForbidden(() => checkCanCreate(actor, data));
    });

    it('should throw FORBIDDEN when actor has unrelated permissions only', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });
        const data = createMockSponsorshipCreateInput();
        expectForbidden(() => checkCanCreate(actor, data));
    });
});

// ---------------------------------------------------------------------------
// checkCanUpdate
// ---------------------------------------------------------------------------

describe('checkCanUpdate', () => {
    const sponsorId = 'owner-user-id';
    const entity = createMockSponsorship({
        id: getMockSponsorshipId('owned'),
        sponsorUserId: sponsorId as never
    });

    it('should allow actor with UPDATE_ANY permission regardless of ownership', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_UPDATE_ANY] });
        expectAllowed(() => checkCanUpdate(actor, entity));
    });

    it('should allow actor with UPDATE_OWN permission when actor is the sponsor', () => {
        const actor = createActor({
            id: sponsorId,
            permissions: [PermissionEnum.SPONSORSHIP_UPDATE_OWN]
        });
        expectAllowed(() => checkCanUpdate(actor, entity));
    });

    it('should throw FORBIDDEN when actor has UPDATE_OWN but is not the sponsor', () => {
        const actor = createActor({
            id: 'different-user-id',
            permissions: [PermissionEnum.SPONSORSHIP_UPDATE_OWN]
        });
        expectForbidden(() => checkCanUpdate(actor, entity));
    });

    it('should throw FORBIDDEN when actor has no update permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanUpdate(actor, entity));
    });
});

// ---------------------------------------------------------------------------
// checkCanSoftDelete
// ---------------------------------------------------------------------------

describe('checkCanSoftDelete', () => {
    const sponsorId = 'owner-user-id';
    const entity = createMockSponsorship({
        id: getMockSponsorshipId('owned'),
        sponsorUserId: sponsorId as never
    });

    it('should allow actor with SOFT_DELETE_ANY permission regardless of ownership', () => {
        const actor = createActor({
            permissions: [PermissionEnum.SPONSORSHIP_SOFT_DELETE_ANY]
        });
        expectAllowed(() => checkCanSoftDelete(actor, entity));
    });

    it('should allow actor with SOFT_DELETE_OWN permission when actor is the sponsor', () => {
        const actor = createActor({
            id: sponsorId,
            permissions: [PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN]
        });
        expectAllowed(() => checkCanSoftDelete(actor, entity));
    });

    it('should throw FORBIDDEN when actor has SOFT_DELETE_OWN but is not the sponsor', () => {
        const actor = createActor({
            id: 'different-user-id',
            permissions: [PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN]
        });
        expectForbidden(() => checkCanSoftDelete(actor, entity));
    });

    it('should throw FORBIDDEN when actor has no soft-delete permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanSoftDelete(actor, entity));
    });
});

// ---------------------------------------------------------------------------
// checkCanHardDelete
// ---------------------------------------------------------------------------

describe('checkCanHardDelete', () => {
    const sponsorId = 'owner-user-id';
    const entity = createMockSponsorship({
        id: getMockSponsorshipId('owned'),
        sponsorUserId: sponsorId as never
    });

    it('should allow actor with HARD_DELETE_ANY permission regardless of ownership', () => {
        const actor = createActor({
            permissions: [PermissionEnum.SPONSORSHIP_HARD_DELETE_ANY]
        });
        expectAllowed(() => checkCanHardDelete(actor, entity));
    });

    it('should allow actor with HARD_DELETE_OWN permission when actor is the sponsor', () => {
        const actor = createActor({
            id: sponsorId,
            permissions: [PermissionEnum.SPONSORSHIP_HARD_DELETE_OWN]
        });
        expectAllowed(() => checkCanHardDelete(actor, entity));
    });

    it('should throw FORBIDDEN when actor has HARD_DELETE_OWN but is not the sponsor', () => {
        const actor = createActor({
            id: 'different-user-id',
            permissions: [PermissionEnum.SPONSORSHIP_HARD_DELETE_OWN]
        });
        expectForbidden(() => checkCanHardDelete(actor, entity));
    });

    it('should throw FORBIDDEN when actor has no hard-delete permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanHardDelete(actor, entity));
    });
});

// ---------------------------------------------------------------------------
// checkCanRestore
// ---------------------------------------------------------------------------

describe('checkCanRestore', () => {
    const sponsorId = 'owner-user-id';
    const entity = createMockSponsorship({
        id: getMockSponsorshipId('owned'),
        sponsorUserId: sponsorId as never,
        deletedAt: new Date()
    });

    it('should allow actor with RESTORE_ANY permission regardless of ownership', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_RESTORE_ANY] });
        expectAllowed(() => checkCanRestore(actor, entity));
    });

    it('should allow actor with RESTORE_OWN permission when actor is the sponsor', () => {
        const actor = createActor({
            id: sponsorId,
            permissions: [PermissionEnum.SPONSORSHIP_RESTORE_OWN]
        });
        expectAllowed(() => checkCanRestore(actor, entity));
    });

    it('should throw FORBIDDEN when actor has RESTORE_OWN but is not the sponsor', () => {
        const actor = createActor({
            id: 'different-user-id',
            permissions: [PermissionEnum.SPONSORSHIP_RESTORE_OWN]
        });
        expectForbidden(() => checkCanRestore(actor, entity));
    });

    it('should throw FORBIDDEN when actor has no restore permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanRestore(actor, entity));
    });
});

// ---------------------------------------------------------------------------
// checkCanView
// ---------------------------------------------------------------------------

describe('checkCanView', () => {
    const sponsorId = 'owner-user-id';
    const entity = createMockSponsorship({
        id: getMockSponsorshipId('owned'),
        sponsorUserId: sponsorId as never
    });

    it('should allow actor with VIEW_ANY permission regardless of ownership', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });
        expectAllowed(() => checkCanView(actor, entity));
    });

    it('should allow actor with VIEW_OWN permission when actor is the sponsor', () => {
        const actor = createActor({
            id: sponsorId,
            permissions: [PermissionEnum.SPONSORSHIP_VIEW_OWN]
        });
        expectAllowed(() => checkCanView(actor, entity));
    });

    it('should throw FORBIDDEN when actor has VIEW_OWN but is not the sponsor', () => {
        const actor = createActor({
            id: 'different-user-id',
            permissions: [PermissionEnum.SPONSORSHIP_VIEW_OWN]
        });
        expectForbidden(() => checkCanView(actor, entity));
    });

    it('should throw FORBIDDEN when actor has no view permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanView(actor, entity));
    });
});

// ---------------------------------------------------------------------------
// checkCanList
// ---------------------------------------------------------------------------

describe('checkCanList', () => {
    it('should allow actor with VIEW_ANY permission', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });
        expectAllowed(() => checkCanList(actor));
    });

    it('should allow actor with VIEW_OWN permission', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_OWN] });
        expectAllowed(() => checkCanList(actor));
    });

    it('should allow actor with both VIEW_ANY and VIEW_OWN permissions', () => {
        const actor = createActor({
            permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY, PermissionEnum.SPONSORSHIP_VIEW_OWN]
        });
        expectAllowed(() => checkCanList(actor));
    });

    it('should throw FORBIDDEN when actor has no view permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanList(actor));
    });

    it('should throw FORBIDDEN when actor has only unrelated permissions', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_CREATE] });
        expectForbidden(() => checkCanList(actor));
    });
});

// ---------------------------------------------------------------------------
// checkCanSearch
// ---------------------------------------------------------------------------

describe('checkCanSearch', () => {
    it('should allow actor with VIEW_ANY permission', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });
        expectAllowed(() => checkCanSearch(actor));
    });

    it('should allow actor with VIEW_OWN permission', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_OWN] });
        expectAllowed(() => checkCanSearch(actor));
    });

    it('should throw FORBIDDEN when actor has no view permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanSearch(actor));
    });
});

// ---------------------------------------------------------------------------
// checkCanCount
// ---------------------------------------------------------------------------

describe('checkCanCount', () => {
    it('should allow actor with VIEW_ANY permission', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });
        expectAllowed(() => checkCanCount(actor));
    });

    it('should allow actor with VIEW_OWN permission', () => {
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_OWN] });
        expectAllowed(() => checkCanCount(actor));
    });

    it('should throw FORBIDDEN when actor has no view permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanCount(actor));
    });
});

// ---------------------------------------------------------------------------
// checkCanUpdateVisibility
// ---------------------------------------------------------------------------

describe('checkCanUpdateVisibility', () => {
    const sponsorId = 'owner-user-id';
    const entity = createMockSponsorship({
        id: getMockSponsorshipId('owned'),
        sponsorUserId: sponsorId as never
    });

    it('should allow actor with UPDATE_VISIBILITY_ANY permission regardless of ownership', () => {
        const actor = createActor({
            permissions: [PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_ANY]
        });
        expectAllowed(() => checkCanUpdateVisibility(actor, entity));
    });

    it('should allow actor with UPDATE_VISIBILITY_OWN permission when actor is the sponsor', () => {
        const actor = createActor({
            id: sponsorId,
            permissions: [PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_OWN]
        });
        expectAllowed(() => checkCanUpdateVisibility(actor, entity));
    });

    it('should throw FORBIDDEN when actor has UPDATE_VISIBILITY_OWN but is not the sponsor', () => {
        const actor = createActor({
            id: 'different-user-id',
            permissions: [PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_OWN]
        });
        expectForbidden(() => checkCanUpdateVisibility(actor, entity));
    });

    it('should throw FORBIDDEN when actor has no visibility-update permissions', () => {
        const actor = createActor({ permissions: [] });
        expectForbidden(() => checkCanUpdateVisibility(actor, entity));
    });
});

// ---------------------------------------------------------------------------
// Edge cases: sponsorUserId variations
// ---------------------------------------------------------------------------

describe('ownership check edge cases', () => {
    it('should treat null sponsorUserId as non-matching (not owned)', () => {
        const actor = createActor({
            id: 'some-user-id',
            permissions: [PermissionEnum.SPONSORSHIP_UPDATE_OWN]
        });
        const entityWithNullSponsor = createMockSponsorship({
            id: getMockSponsorshipId('null-sponsor'),
            sponsorUserId: null as never
        });
        expectForbidden(() => checkCanUpdate(actor, entityWithNullSponsor));
    });

    it('should correctly match when sponsorUserId equals actor id', () => {
        const actorId = 'exact-match-user-id';
        const actor: Actor = createActor({
            id: actorId,
            permissions: [PermissionEnum.SPONSORSHIP_VIEW_OWN]
        });
        const entity = createMockSponsorship({
            id: getMockSponsorshipId('exact-match'),
            sponsorUserId: actorId as never
        });
        expectAllowed(() => checkCanView(actor, entity));
    });
});
