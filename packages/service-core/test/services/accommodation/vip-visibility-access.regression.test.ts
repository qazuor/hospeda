/**
 * @fileoverview
 * Regression test — SPEC-286 T-001 (D-5):
 *   VIP_PROMOTIONS_ACCESS → VIP_VISIBILITY_ACCESS rename.
 *
 * These tests prove that a VIP actor carrying the entitlement string
 * 'vip_visibility_access' (the NEW key) still bypasses the three visibility
 * filter families in accommodation.service.ts / accommodation.permissions.ts:
 *
 *   1. RESTRICTED visibility (checkCanView via accommodation.permissions.ts)
 *   2. excludeOwnerSuspended / excludePlanRestricted in getByDestination
 *   3. excludeRestricted / excludeOwnerSuspended / excludePlanRestricted in _executeSearch
 *
 * Protocol (mandatory RED→GREEN):
 *   - Write this file BEFORE the rename.
 *   - Run: all tests in this file MUST fail (RED) because the code still
 *     checks 'vip_promotions_access'.
 *   - Apply the rename across all layers.
 *   - Run again: all tests MUST pass (GREEN).
 *
 * If any test in this file passes BEFORE the rename, it is not testing what
 * we think it is — investigate immediately.
 */

import type { AccommodationModel } from '@repo/db';
import { RoleEnum, VisibilityEnum } from '@repo/schemas';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { checkCanView } from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor, ServiceConfig } from '../../../src/types';
import {
    AccommodationFactoryBuilder,
    getMockDestinationId
} from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    createLoggerMock,
    createModelMock,
    makeMediaModelStub
} from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../src/services/conversation/conversation.service', () => ({
    ConversationService: vi.fn().mockImplementation(() => ({}))
}));

// ---------------------------------------------------------------------------
// VIP actor factory — NEW KEY ('vip_visibility_access')
// ---------------------------------------------------------------------------

/**
 * Builds a VIP actor carrying the renamed entitlement key.
 * This is the actor that ALL regression tests in this file verify.
 */
function makeVipActor(): Actor {
    return new ActorFactoryBuilder()
        .host()
        .with({
            entitlements: new Set(['vip_visibility_access'])
        })
        .build();
}

// ---------------------------------------------------------------------------
// Suite 1 — checkCanView (accommodation.permissions.ts line 185)
// ---------------------------------------------------------------------------

describe('SPEC-286 T-001 regression: VIP_VISIBILITY_ACCESS — checkCanView', () => {
    /**
     * A VIP actor with 'vip_visibility_access' must be allowed to read a
     * RESTRICTED accommodation without throwing.
     */
    it('allows VIP actor (vip_visibility_access) to read a RESTRICTED accommodation', () => {
        // Arrange
        const vipActor = makeVipActor();
        const restrictedAccommodation = new AccommodationFactoryBuilder()
            .with({
                visibility: VisibilityEnum.RESTRICTED
            })
            .build();

        // Act & Assert — must NOT throw (VIP bypass of RESTRICTED check)
        expect(() => checkCanView(vipActor, restrictedAccommodation)).not.toThrow();
    });

    /**
     * A regular user (no VIP entitlement) MUST be denied RESTRICTED access.
     * This is the control arm — confirms the bypass is entitlement-gated.
     */
    it('denies a non-VIP actor access to a RESTRICTED accommodation', () => {
        // Arrange
        const regularActor = new ActorFactoryBuilder().host().build();
        const restrictedAccommodation = new AccommodationFactoryBuilder()
            .with({
                visibility: VisibilityEnum.RESTRICTED,
                ownerId: getMockId('user', 'different-owner')
            })
            .build();

        // Act & Assert — must throw FORBIDDEN
        expect(() => checkCanView(regularActor, restrictedAccommodation)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// Suite 2 — getByDestination (accommodation.service.ts lines 2565/2630)
// ---------------------------------------------------------------------------

describe('SPEC-286 T-001 regression: VIP_VISIBILITY_ACCESS — getByDestination', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    const destinationId = getMockDestinationId();

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = {
            ...createModelMock(['searchWithRelations', 'findAll']),
            table: 'accommodation',
            entityName: 'accommodation',
            countByFilters: vi.fn(),
            search: vi.fn(),
            create: vi.fn(),
            searchWithRelations: vi.fn(),
            findAll: vi.fn()
        } as unknown as Mocked<AccommodationModel>;

        service = new AccommodationService(
            { logger: createLoggerMock() },
            modelMock,
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
    });

    /**
     * VIP actor with 'vip_visibility_access' must receive
     * excludeOwnerSuspended=false and excludePlanRestricted=false from the service
     * (i.e., the bypass is active).
     */
    it('VIP actor (vip_visibility_access) bypasses ownerSuspended + planRestricted in getByDestination', async () => {
        // Arrange
        const vipActor = makeVipActor();
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockResolvedValue({ items: [], total: 0 });

        // Act
        await service.getByDestination(vipActor, { page: 1, pageSize: 10, destinationId });

        // Assert — both filters must be false (VIP sees everything)
        expect(modelMock.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({
                excludeOwnerSuspended: false,
                excludePlanRestricted: false
            }),
            undefined
        );
    });

    /**
     * Non-VIP actor (no 'vip_visibility_access') MUST have both filters active.
     * Control arm for the test above.
     */
    it('non-VIP actor has ownerSuspended + planRestricted filters active in getByDestination', async () => {
        // Arrange
        const regularActor = new ActorFactoryBuilder().host().build();
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockResolvedValue({ items: [], total: 0 });

        // Act
        await service.getByDestination(regularActor, { page: 1, pageSize: 10, destinationId });

        // Assert — filters must be active (non-VIP sees only public items)
        expect(modelMock.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({
                excludeOwnerSuspended: true,
                excludePlanRestricted: true
            }),
            undefined
        );
    });
});

// ---------------------------------------------------------------------------
// Suite 3 — _executeSearch (accommodation.service.ts line 2110)
// ---------------------------------------------------------------------------

describe('SPEC-286 T-001 regression: VIP_VISIBILITY_ACCESS — _executeSearch / search()', () => {
    let service: AccommodationService;
    let searchWithRelations: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();

        searchWithRelations = vi.fn().mockResolvedValue({
            items: [],
            total: 0
        });

        const modelMock = {
            searchWithRelations,
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
            countByFilters: vi.fn().mockResolvedValue({ count: 0 }),
            table: 'accommodation',
            entityName: 'accommodation'
        };

        service = new AccommodationService(
            {} as ServiceConfig,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            modelMock as any,
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
    });

    /**
     * VIP actor with 'vip_visibility_access' must make _executeSearch pass
     * activeOnly=false to the model (same as it does for staff actors).
     */
    it('VIP actor (vip_visibility_access) receives activeOnly=false from _executeSearch', async () => {
        // Arrange
        const vipActor = makeVipActor();
        const params = { page: 1, pageSize: 10 };

        // Act
        await service.search(vipActor, params);

        // Assert
        expect(searchWithRelations).toHaveBeenCalledOnce();
        const calledWith = searchWithRelations.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(calledWith.activeOnly).toBe(false);
        expect(calledWith.excludeRestricted).toBe(false);
        expect(calledWith.excludeOwnerSuspended).toBe(false);
    });

    /**
     * Non-VIP actor MUST receive activeOnly=true (control arm).
     */
    it('non-VIP actor receives activeOnly=true from _executeSearch (control arm)', async () => {
        // Arrange
        const regularActor: Actor = {
            id: getMockId('user', 'regular'),
            type: 'user',
            role: RoleEnum.USER,
            permissions: []
        } as Actor;
        const params = { page: 1, pageSize: 10 };

        // Act
        await service.search(regularActor, params);

        // Assert
        expect(searchWithRelations).toHaveBeenCalledOnce();
        const calledWith = searchWithRelations.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(calledWith.activeOnly).toBe(true);
    });
});
