/**
 * Tests for ModerationAggregationService.getPendingCount (SPEC-166 T-026).
 *
 * Covers:
 *  - Happy path: authorized actor, returns byEntity breakdown + total.
 *  - Permission gate: FORBIDDEN when actor lacks ACCOMMODATION_MODERATION_CHANGE.
 *  - No actor id: FORBIDDEN when actor.id is falsy.
 *  - DB error propagation: INTERNAL_ERROR on unexpected model throw.
 *  - Zero counts: returns { total: 0, byEntity: all zeros }.
 *
 * Mock strategy:
 *  - @repo/db: mock the four model singletons (accommodationModel, destinationModel,
 *    eventModel, postModel) so each `.count()` call is controllable without a
 *    real DB connection. Uses vi.hoisted() to avoid TDZ errors in vi.mock factories.
 *
 * AAA pattern throughout.
 */

// ---- vi.hoisted + vi.mock — must precede all imports ----------------------

const { mockAccommodationModel, mockDestinationModel, mockEventModel, mockPostModel } = vi.hoisted(
    () => ({
        mockAccommodationModel: { count: vi.fn() },
        mockDestinationModel: { count: vi.fn() },
        mockEventModel: { count: vi.fn() },
        mockPostModel: { count: vi.fn() }
    })
);

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        accommodationModel: mockAccommodationModel,
        destinationModel: mockDestinationModel,
        eventModel: mockEventModel,
        postModel: mockPostModel
    };
});

// ---------------------------------------------------------------------------

import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerationAggregationService } from '../../../src/services/moderation/moderation.aggregation.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Actor that holds ACCOMMODATION_MODERATION_CHANGE — the permission gate for getPendingCount. */
function makeModerationActor() {
    return createActor({
        id: getMockId('user'),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE]
    });
}

/** Actor without the required permission. */
function makeUnprivilegedActor() {
    return createActor({
        id: getMockId('user'),
        role: RoleEnum.USER,
        permissions: []
    });
}

// Default counts returned when tests do not override them.
const DEFAULT_COUNTS = {
    accommodations: 3,
    destinations: 5,
    posts: 2,
    events: 1
};

/** Sets each mock model's count to the provided values. */
function seedCounts(counts: {
    accommodations: number;
    destinations: number;
    posts: number;
    events: number;
}): void {
    mockAccommodationModel.count.mockResolvedValue(counts.accommodations);
    mockDestinationModel.count.mockResolvedValue(counts.destinations);
    mockPostModel.count.mockResolvedValue(counts.posts);
    mockEventModel.count.mockResolvedValue(counts.events);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModerationAggregationService.getPendingCount', () => {
    let service: ModerationAggregationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ModerationAggregationService();
        seedCounts(DEFAULT_COUNTS);
    });

    // ---- Happy path --------------------------------------------------------

    describe('authorized actor — happy path', () => {
        it('returns the total and byEntity breakdown for PENDING items', async () => {
            // Arrange
            const actor = makeModerationActor();
            const expected = DEFAULT_COUNTS;

            // Act
            const result = await service.getPendingCount(actor);

            // Assert
            expectSuccess(result);
            expect(result.data?.total).toBe(
                expected.accommodations + expected.destinations + expected.posts + expected.events
            );
            expect(result.data?.byEntity).toEqual({
                accommodations: expected.accommodations,
                destinations: expected.destinations,
                posts: expected.posts,
                events: expected.events
            });
        });

        it('passes moderationState=PENDING and deletedAt=null to each model', async () => {
            // Arrange
            const actor = makeModerationActor();
            const PENDING = ModerationStatusEnum.PENDING;

            // Act
            await service.getPendingCount(actor);

            // Assert — each model receives the correct filter
            expect(mockAccommodationModel.count).toHaveBeenCalledWith(
                { moderationState: PENDING, deletedAt: null },
                expect.anything()
            );
            expect(mockDestinationModel.count).toHaveBeenCalledWith(
                { moderationState: PENDING, deletedAt: null },
                expect.anything()
            );
            expect(mockPostModel.count).toHaveBeenCalledWith(
                { moderationState: PENDING, deletedAt: null },
                expect.anything()
            );
            expect(mockEventModel.count).toHaveBeenCalledWith(
                { moderationState: PENDING, deletedAt: null },
                expect.anything()
            );
        });

        it('total equals the arithmetic sum of the four entity counts', async () => {
            // Arrange
            const actor = makeModerationActor();
            seedCounts({ accommodations: 10, destinations: 20, posts: 5, events: 7 });

            // Act
            const result = await service.getPendingCount(actor);

            // Assert
            expectSuccess(result);
            expect(result.data?.total).toBe(42);
        });

        it('returns total = 0 when all entities have zero PENDING items', async () => {
            // Arrange
            const actor = makeModerationActor();
            seedCounts({ accommodations: 0, destinations: 0, posts: 0, events: 0 });

            // Act
            const result = await service.getPendingCount(actor);

            // Assert
            expectSuccess(result);
            expect(result.data?.total).toBe(0);
            expect(result.data?.byEntity).toEqual({
                accommodations: 0,
                destinations: 0,
                posts: 0,
                events: 0
            });
        });

        it('propagates optional ctx.tx to each model count call', async () => {
            // Arrange
            const actor = makeModerationActor();
            const fakeTx = { __tx: true } as unknown as import(
                '../../../src/types'
            ).ServiceContext['tx'];
            const ctx = { tx: fakeTx, hookState: undefined };

            // Act
            await service.getPendingCount(actor, ctx);

            // Assert — each count call receives { tx: fakeTx }
            expect(mockAccommodationModel.count).toHaveBeenCalledWith(expect.any(Object), {
                tx: fakeTx
            });
        });
    });

    // ---- Permission gate ---------------------------------------------------

    describe('permission gate', () => {
        it('returns FORBIDDEN when actor lacks ACCOMMODATION_MODERATION_CHANGE', async () => {
            // Arrange
            const actor = makeUnprivilegedActor();

            // Act
            const result = await service.getPendingCount(actor);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
        });

        it('does NOT query the DB when actor is unauthorized', async () => {
            // Arrange
            const actor = makeUnprivilegedActor();

            // Act
            await service.getPendingCount(actor);

            // Assert — none of the four model count methods were called
            expect(mockAccommodationModel.count).not.toHaveBeenCalled();
            expect(mockDestinationModel.count).not.toHaveBeenCalled();
            expect(mockPostModel.count).not.toHaveBeenCalled();
            expect(mockEventModel.count).not.toHaveBeenCalled();
        });

        it('returns FORBIDDEN when actor.id is falsy (null-id actor)', async () => {
            // Arrange — actor with no id simulates a guest/unauthenticated request
            const actor = createActor({
                id: '' as unknown as string,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE]
            });

            // Act
            const result = await service.getPendingCount(actor);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ---- DB error handling -------------------------------------------------

    describe('DB error handling', () => {
        it('returns INTERNAL_ERROR when a model count throws an unexpected Error', async () => {
            // Arrange
            const actor = makeModerationActor();
            mockAccommodationModel.count.mockRejectedValue(new Error('DB connection lost'));

            // Act
            const result = await service.getPendingCount(actor);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('DB connection lost');
            expect(result.data).toBeUndefined();
        });

        it('returns INTERNAL_ERROR when a model count throws a non-Error value', async () => {
            // Arrange
            const actor = makeModerationActor();
            mockDestinationModel.count.mockRejectedValue('unexpected string error');

            // Act
            const result = await service.getPendingCount(actor);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toBe('unexpected string error');
        });
    });
});
