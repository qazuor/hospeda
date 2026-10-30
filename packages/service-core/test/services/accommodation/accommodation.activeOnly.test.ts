/**
 * Regression tests for the `publishedOnly` publication-status filter (V6.9b,
 * HOS-1641; it replaced the old `activeOnly` lifecycle filter and its three
 * sibling visibility flags).
 *
 * Key invariant (the regression guard):
 *   - When the search is owner-scoped (ownerId === actor.id), `publishedOnly`
 *     MUST be `false` so that non-PUBLISHED accommodations (DRAFT, ARCHIVED,
 *     MODERATED, ...) are visible to the owner in their "my accommodations" list.
 *   - For all other callers — anonymous, a different user, and since V6.9b
 *     also a VIP entitlement holder or staff with ACCOMMODATION_VIEW_ALL
 *     (another account's listing exists only while PUBLISHED, AC:V5:5) —
 *     `publishedOnly` MUST be `true`.
 *
 * These tests target `_executeSearch` via the public `search()` method on
 * AccommodationService (which is the pipeline path that calls _executeSearch).
 * The model's `searchWithRelations` is replaced with a vi.fn() spy so we can
 * assert the exact params forwarded to it.
 */

import {
    type AccommodationSearchInput,
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor, ServiceConfig } from '../../../src/types';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { getMockId } from '../../factories/utilsFactory';
import { makeMediaModelStub } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Mock the DestinationService to prevent constructor side-effects.
// ---------------------------------------------------------------------------
vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

// ---------------------------------------------------------------------------
// Mock the ConversationService to prevent constructor side-effects.
// ---------------------------------------------------------------------------
vi.mock('../../../src/services/conversation/conversation.service', () => ({
    ConversationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

// ---------------------------------------------------------------------------
// Actor IDs — must be valid UUIDs so Zod validation passes.
// ---------------------------------------------------------------------------
const OWNER_UUID = getMockId('user', 'test-owner');
const OTHER_UUID = getMockId('user', 'test-other');

// ---------------------------------------------------------------------------
// Minimal model mock that supports only the surface used by _executeSearch.
// ---------------------------------------------------------------------------
function makeModelMock() {
    const mockAccommodation = createMockAccommodation({
        publicationStatus: PublicationStatusEnum.PUBLISHED
    });

    const searchWithRelations = vi.fn().mockResolvedValue({
        items: [mockAccommodation],
        total: 1
    });

    return {
        searchWithRelations,
        // Other methods the service constructor references.
        findById: vi.fn(),
        findOne: vi.fn(),
        findAll: vi.fn(),
        findAllWithRelations: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
        restore: vi.fn(),
        hardDelete: vi.fn(),
        countByFilters: vi.fn().mockResolvedValue({ count: 0 })
    };
}

// ---------------------------------------------------------------------------
// Actor factories
// ---------------------------------------------------------------------------

function makeAnonymousActor(): Actor {
    return { id: OTHER_UUID, type: 'user', roles: [RoleEnum.USER], permissions: [] } as Actor;
}

function makeOwnerActor(): Actor {
    return { id: OWNER_UUID, type: 'user', roles: [RoleEnum.USER], permissions: [] } as Actor;
}

function makeVipActor(): Actor {
    return {
        id: OTHER_UUID,
        type: 'user',
        roles: [RoleEnum.USER],
        permissions: [],
        entitlements: new Set(['vip_visibility_access'])
    } as Actor;
}

function makeStaffActor(): Actor {
    return {
        id: OTHER_UUID,
        type: 'user',
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
    } as Actor;
}

/**
 * Minimal valid search params that satisfy AccommodationSearchInput Zod schema.
 * The service's `search()` method validates through BaseSearchSchema which
 * requires page + pageSize (both have defaults, but the TS type is non-optional).
 */
const BASE_PARAMS = { page: 1, pageSize: 10 } as AccommodationSearchInput;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AccommodationService._executeSearch — publishedOnly regression', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof makeModelMock>;
    const ctx = {} as ServiceConfig;

    beforeEach(() => {
        model = makeModelMock();
        service = new AccommodationService(
            ctx,
            model as any,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
        vi.clearAllMocks();
    });

    // =========================================================================
    // Public / anonymous scope — publishedOnly must be true
    // =========================================================================

    describe('anonymous actor (non-owner, no VIP)', () => {
        it('passes publishedOnly=true so DRAFT accommodations are hidden from public reads', async () => {
            // Arrange
            const actor = makeAnonymousActor();

            // Act — search() goes through _executeSearch → model.searchWithRelations
            await service.search(actor, BASE_PARAMS);

            // Assert
            expect(model.searchWithRelations).toHaveBeenCalledOnce();
            const calledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(calledParams.publishedOnly).toBe(true);
        });

        it('passes publishedOnly=true when ownerId param belongs to a different user', async () => {
            // Arrange — actor (OTHER_UUID) is not the owner named in the filter (OWNER_UUID)
            const actor = makeAnonymousActor();
            const params = { ...BASE_PARAMS, ownerId: OWNER_UUID } as AccommodationSearchInput;

            // Act
            await service.search(actor, params);

            // Assert — ownerId !== actor.id → isOwnScope=false → publishedOnly=true
            expect(model.searchWithRelations).toHaveBeenCalledOnce();
            const calledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(calledParams.publishedOnly).toBe(true);
        });
    });

    // =========================================================================
    // Owner scope — the KEY REGRESSION — publishedOnly must be false
    //
    // An owner must see their own DRAFT/INACTIVE/ARCHIVED accommodations in
    // their "my listings" view.  If publishedOnly were applied here they would
    // silently disappear from the owner's dashboard.
    // =========================================================================

    describe('owner-scoped search (ownerId === actor.id)', () => {
        it('passes publishedOnly=false so the owner sees their own DRAFTs', async () => {
            // Arrange — actor IS the owner; ownerId filter scopes to the same ID
            const actor = makeOwnerActor(); // id = OWNER_UUID
            const params = { ...BASE_PARAMS, ownerId: OWNER_UUID } as AccommodationSearchInput;

            // Act
            await service.search(actor, params);

            // Assert — this is the critical regression test.
            // If a future commit accidentally unconditionalises publishedOnly=true, this fails.
            expect(model.searchWithRelations).toHaveBeenCalledOnce();
            const calledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(calledParams.publishedOnly).toBe(false);
        });
    });

    // =========================================================================
    // VIP / staff scope — publishedOnly must be TRUE since V6.9b (no bypass)
    // =========================================================================

    describe('VIP actor (vip_visibility_access entitlement)', () => {
        it('passes publishedOnly=true: the VIP entitlement no longer exposes unpublished listings', async () => {
            // Arrange
            const actor = makeVipActor();

            // Act
            await service.search(actor, BASE_PARAMS);

            // Assert
            expect(model.searchWithRelations).toHaveBeenCalledOnce();
            const calledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(calledParams.publishedOnly).toBe(true);
        });
    });

    describe('staff actor (ACCOMMODATION_VIEW_ALL permission)', () => {
        it('passes publishedOnly=true: staff see unpublished listings through the admin list, not here', async () => {
            // Arrange
            const actor = makeStaffActor();

            // Act
            await service.search(actor, BASE_PARAMS);

            // Assert
            expect(model.searchWithRelations).toHaveBeenCalledOnce();
            const calledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(calledParams.publishedOnly).toBe(true);
        });
    });

    // =========================================================================
    // Discriminating power — the owner test would FAIL if publishedOnly were forced
    // unconditionally to true.  We verify this by running both the owner scope
    // and a public scope in the same test and asserting they produce different
    // values.
    // =========================================================================

    describe('discriminating power — owner and public scopes produce different publishedOnly', () => {
        it('sends publishedOnly=false for owner and publishedOnly=true for anonymous in the same suite', async () => {
            // --- Owner path ---
            const ownerActor = makeOwnerActor();
            const ownerParams = { ...BASE_PARAMS, ownerId: OWNER_UUID } as AccommodationSearchInput;

            await service.search(ownerActor, ownerParams);

            const ownerCalledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            // Owner must NOT have lifecycle filter applied.
            expect(ownerCalledParams.publishedOnly).toBe(false);

            // --- Reset and test public path ---
            model.searchWithRelations.mockClear();

            const publicActor = makeAnonymousActor();
            await service.search(publicActor, BASE_PARAMS);

            const publicCalledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            // Public must HAVE lifecycle filter applied.
            expect(publicCalledParams.publishedOnly).toBe(true);

            // The two values differ — proving the test has real discriminating power.
            // If publishedOnly were unconditionally applied, both would be true and
            // the owner assertion above would FAIL.
            expect(ownerCalledParams.publishedOnly).not.toBe(publicCalledParams.publishedOnly);
        });
    });
});

// =============================================================================
// _executeCount — publishedOnly consistency
//
// count() is the other half of a search+count pair.  If count omits publishedOnly
// the paginated total disagrees with the item list for public callers (DRAFT
// items are counted but never returned).  These tests lock in that _executeCount
// forwards publishedOnly with the same expression as _executeSearch.
// =============================================================================

describe('AccommodationService._executeCount — publishedOnly consistency', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof makeModelMock>;
    const ctx = {} as ServiceConfig;

    beforeEach(() => {
        model = makeModelMock();
        // _executeCount calls model.countByFilters — spy on it explicitly.
        model.countByFilters = vi.fn().mockResolvedValue({ count: 0 });
        service = new AccommodationService(
            ctx,
            model as any,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
        vi.clearAllMocks();
    });

    it('passes publishedOnly=true to countByFilters for a public (non-owner, non-VIP) actor', async () => {
        // Arrange
        const actor = makeAnonymousActor();

        // Act — service.count() → _executeCount → model.countByFilters
        await service.count(actor, BASE_PARAMS);

        // Assert
        expect(model.countByFilters).toHaveBeenCalledOnce();
        const calledParams = model.countByFilters.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(calledParams.publishedOnly).toBe(true);
    });

    it('passes publishedOnly=false to countByFilters for an owner-scoped actor', async () => {
        // Arrange — actor IS the owner of the requested scope
        const actor = makeOwnerActor();
        const params = { ...BASE_PARAMS, ownerId: OWNER_UUID } as AccommodationSearchInput;

        // Act
        await service.count(actor, params);

        // Assert — owner sees their own non-ACTIVE items; count must reflect that.
        expect(model.countByFilters).toHaveBeenCalledOnce();
        const calledParams = model.countByFilters.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(calledParams.publishedOnly).toBe(false);
    });

    it('passes publishedOnly=true to countByFilters for a VIP actor', async () => {
        // Arrange
        const actor = makeVipActor();

        // Act
        await service.count(actor, BASE_PARAMS);

        // Assert
        expect(model.countByFilters).toHaveBeenCalledOnce();
        const calledParams = model.countByFilters.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(calledParams.publishedOnly).toBe(true);
    });

    it('count and search agree on publishedOnly for a public actor (consistency invariant)', async () => {
        // Arrange
        const actor = makeAnonymousActor();

        // Act — run both search and count for the same public actor
        await service.search(actor, BASE_PARAMS);
        const searchParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;

        await service.count(actor, BASE_PARAMS);
        const countParams = model.countByFilters.mock.calls[0]?.[0] as Record<string, unknown>;

        // Assert — both must agree on publishedOnly so count matches list length.
        expect(searchParams.publishedOnly).toBe(countParams.publishedOnly);
        expect(searchParams.publishedOnly).toBe(true);
    });

    it('count and search agree on publishedOnly for an owner actor (consistency invariant)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const params = { ...BASE_PARAMS, ownerId: OWNER_UUID } as AccommodationSearchInput;

        // Act
        await service.search(actor, params);
        const searchParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;

        await service.count(actor, params);
        const countParams = model.countByFilters.mock.calls[0]?.[0] as Record<string, unknown>;

        // Assert — owner: both must pass publishedOnly=false
        expect(searchParams.publishedOnly).toBe(countParams.publishedOnly);
        expect(searchParams.publishedOnly).toBe(false);
    });
});

// =============================================================================
// searchWithRelations (service method) — publishedOnly consistency
//
// searchWithRelations is a public service method that bypasses _executeSearch
// and calls model.searchWithRelations directly.  It must apply the same
// publishedOnly logic as _executeSearch so the two paths are consistent.
// =============================================================================

describe('AccommodationService.searchWithRelations — publishedOnly consistency', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof makeModelMock>;
    const ctx = {} as ServiceConfig;

    beforeEach(() => {
        model = makeModelMock();
        model.searchWithRelations = vi.fn().mockResolvedValue({ items: [], total: 0 });
        service = new AccommodationService(
            ctx,
            model as any,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
        vi.clearAllMocks();
    });

    it('passes publishedOnly=true to model.searchWithRelations for a public actor', async () => {
        // Arrange
        const actor = makeAnonymousActor();

        // Act — service.searchWithRelations() is the public service method
        await service.searchWithRelations(actor, BASE_PARAMS);

        // Assert
        expect(model.searchWithRelations).toHaveBeenCalledOnce();
        const calledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(calledParams.publishedOnly).toBe(true);
    });

    it('passes publishedOnly=false to model.searchWithRelations for an owner-scoped actor', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const params = { ...BASE_PARAMS, ownerId: OWNER_UUID } as AccommodationSearchInput;

        // Act
        await service.searchWithRelations(actor, params);

        // Assert
        expect(model.searchWithRelations).toHaveBeenCalledOnce();
        const calledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(calledParams.publishedOnly).toBe(false);
    });

    it('passes publishedOnly=true to model.searchWithRelations for a VIP actor', async () => {
        // Arrange
        const actor = makeVipActor();

        // Act
        await service.searchWithRelations(actor, BASE_PARAMS);

        // Assert
        expect(model.searchWithRelations).toHaveBeenCalledOnce();
        const calledParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(calledParams.publishedOnly).toBe(true);
    });

    it('searchWithRelations and _executeSearch agree on publishedOnly for a public actor', async () => {
        // Arrange
        const actor = makeAnonymousActor();

        // Act — call both paths for the same actor/params
        await service.search(actor, BASE_PARAMS); // goes through _executeSearch
        const searchExecuteParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;

        model.searchWithRelations.mockClear();

        await service.searchWithRelations(actor, BASE_PARAMS); // direct service method
        const searchWithRelationsParams = model.searchWithRelations.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;

        // Assert — both paths must produce the same publishedOnly for the same actor.
        expect(searchExecuteParams.publishedOnly).toBe(searchWithRelationsParams.publishedOnly);
        expect(searchExecuteParams.publishedOnly).toBe(true);
    });
});
