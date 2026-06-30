/**
 * Tests for SPEC-285 T-003: visibility correctness in OwnerPromotionService.
 *
 * (a) G-3 active-window: _executeSearch / _executeCount must pass the validFrom/validUntil
 *     date-window condition to the model layer so expired and future-dated promos are
 *     excluded from public reads.
 *
 * (b) D-4 owner-wide promos: when `accommodationId` is supplied, the service resolves the
 *     accommodation's ownerId and delegates to `findActiveForAccommodation`, which returns
 *     both targeted (accommodationId == X) and owner-wide (accommodationId IS NULL) promos
 *     for that owner — while excluding other owners' null promos.
 */

import type { AccommodationModel, OwnerPromotionModel } from '@repo/db';
import type { OwnerPromotionSearchInput } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockOwnerPromotion,
    getMockOwnerPromotionId
} from '../../factories/ownerPromotionFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A guest actor that holds only ACCESS_API_PUBLIC — the public-search path. */
const guestActor = createActor({ permissions: [PermissionEnum.ACCESS_API_PUBLIC] });

/** Default pagination — required by OwnerPromotionSearchSchema (has .default() values). */
const defaultPagination: Pick<OwnerPromotionSearchInput, 'page' | 'pageSize'> = {
    page: 1,
    pageSize: 20
};

const accommodationId = getMockId('accommodation', 'accom-1');
const ownerId = getMockId('user', 'owner-1');
const foreignOwnerId = getMockId('user', 'owner-2');

/** Mock accommodation row with a resolved ownerId. */
const mockAccommodation = { id: accommodationId, ownerId };

/** A targeted promo — explicitly linked to accommodationId. */
const targetedPromo = createMockOwnerPromotion({
    id: getMockOwnerPromotionId('targeted'),
    accommodationId,
    ownerId
});

/** An owner-wide promo — accommodationId IS NULL, same owner. */
const ownerWidePromo = createMockOwnerPromotion({
    id: getMockOwnerPromotionId('owner-wide'),
    accommodationId: undefined,
    ownerId
});

/** Foreign owner's null promo — should NOT appear for our accommodation. */
const foreignOwnerPromo = createMockOwnerPromotion({
    id: getMockOwnerPromotionId('foreign'),
    accommodationId: undefined,
    ownerId: foreignOwnerId
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('OwnerPromotionService visibility (SPEC-285 T-003)', () => {
    let service: OwnerPromotionService;
    let modelMock: ReturnType<typeof createModelMock>;
    let accommodationModelMock: { findById: ReturnType<typeof vi.fn> };
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        // FIX 8: clear first, then set up mocks — default values set before
        // clearAllMocks() are wiped. By clearing first the defaults survive into tests.
        vi.clearAllMocks();

        modelMock = createModelMock(['findActiveForAccommodation', 'countActiveForAccommodation']);
        accommodationModelMock = { findById: vi.fn() };
        loggerMock = createLoggerMock();

        // Default: model methods return empty / zero.
        modelMock.findAll.mockResolvedValue({ items: [], total: 0 });
        modelMock.count.mockResolvedValue(0);
        (modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>).mockResolvedValue({
            items: [],
            total: 0
        });
        (modelMock.countActiveForAccommodation as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        service = new OwnerPromotionService({
            logger: loggerMock,
            model: modelMock as unknown as OwnerPromotionModel,
            accommodationModel: accommodationModelMock as unknown as AccommodationModel
        });
    });

    // ── T-003(a) G-3 active-window ───────────────────────────────────────────

    describe('G-3 active-window filter', () => {
        it('passes additionalConditions to findAll for the date-window gate', async () => {
            modelMock.findAll.mockResolvedValue({ items: [targetedPromo], total: 1 });

            const result = await service.search(guestActor, { ...defaultPagination });

            expect(result.error).toBeUndefined();
            // The service must call findAll with an additionalConditions array containing
            // the window SQL. We verify the 3rd argument (additionalConditions) is present.
            expect(modelMock.findAll).toHaveBeenCalled();
            const [, , additionalConditions] = modelMock.findAll.mock.calls[0] ?? [];
            expect(Array.isArray(additionalConditions)).toBe(true);
            expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
        });

        it('passes additionalConditions to count for the date-window gate', async () => {
            // count() is called separately only via the standalone count() service method.
            // We test it by calling count() directly.
            modelMock.count.mockResolvedValue(3);

            // The base class count() path is exercised by calling search (which uses
            // _executeSearch). We verify count is called with additionalConditions too
            // by testing the non-accommodationId path of _executeCount indirectly.
            // Direct route: service.count() → _executeCount → model.count(where, { additionalConditions })
            const result = await service.count(guestActor, { ...defaultPagination });
            expect(result.error).toBeUndefined();
            expect(modelMock.count).toHaveBeenCalled();
            const countArgs = modelMock.count.mock.calls[0];
            // Second argument is options: { additionalConditions }
            const options = countArgs?.[1] as { additionalConditions?: unknown[] } | undefined;
            expect(options?.additionalConditions).toBeDefined();
            expect(Array.isArray(options?.additionalConditions)).toBe(true);
            expect((options?.additionalConditions as unknown[]).length).toBeGreaterThan(0);
        });
    });

    // ── T-003(b) D-4 owner-wide OR path ─────────────────────────────────────

    describe('D-4 owner-wide promotions', () => {
        it('calls findActiveForAccommodation when accommodationId is provided', async () => {
            accommodationModelMock.findById.mockResolvedValue(mockAccommodation);
            (modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>).mockResolvedValue({
                items: [targetedPromo, ownerWidePromo],
                total: 2
            });

            const result = await service.search(guestActor, {
                ...defaultPagination,
                accommodationId
            });

            expect(result.error).toBeUndefined();
            expect(accommodationModelMock.findById).toHaveBeenCalledWith(accommodationId);
            expect(
                modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>
            ).toHaveBeenCalledWith(
                { accommodationId, ownerId },
                expect.objectContaining({ page: expect.any(Number), pageSize: expect.any(Number) })
            );
            // findAll must NOT be called — we went through the D-4 path
            expect(modelMock.findAll).not.toHaveBeenCalled();
        });

        it('returns both targeted and owner-wide promos for the same owner', async () => {
            accommodationModelMock.findById.mockResolvedValue(mockAccommodation);
            (modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>).mockResolvedValue({
                items: [targetedPromo, ownerWidePromo],
                total: 2
            });

            const result = await service.search(guestActor, {
                ...defaultPagination,
                accommodationId
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.total).toBe(2);
            const ids = (result.data?.items ?? []).map((p) => p.id);
            expect(ids).toContain(targetedPromo.id);
            expect(ids).toContain(ownerWidePromo.id);
            // foreign owner promo must never appear
            expect(ids).not.toContain(foreignOwnerPromo.id);
        });

        it('returns empty list when accommodation is not found', async () => {
            accommodationModelMock.findById.mockResolvedValue(null);

            const result = await service.search(guestActor, {
                ...defaultPagination,
                accommodationId
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.total).toBe(0);
            // findAll and findActiveForAccommodation must NOT be called
            expect(modelMock.findAll).not.toHaveBeenCalled();
            expect(
                modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>
            ).not.toHaveBeenCalled();
        });

        it('does NOT call findActiveForAccommodation for a generic search (no accommodationId)', async () => {
            modelMock.findAll.mockResolvedValue({ items: [targetedPromo], total: 1 });

            const result = await service.search(guestActor, { ...defaultPagination });

            expect(result.error).toBeUndefined();
            expect(modelMock.findAll).toHaveBeenCalled();
            expect(
                modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>
            ).not.toHaveBeenCalled();
            expect(accommodationModelMock.findById).not.toHaveBeenCalled();
        });

        // ── FIX 7: D-4 count path ─────────────────────────────────────────────

        it('uses countActiveForAccommodation for count when accommodationId is provided', async () => {
            accommodationModelMock.findById.mockResolvedValue(mockAccommodation);
            (modelMock.countActiveForAccommodation as ReturnType<typeof vi.fn>).mockResolvedValue(
                5
            );

            const result = await service.count(guestActor, {
                ...defaultPagination,
                accommodationId
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(5);
            expect(accommodationModelMock.findById).toHaveBeenCalledWith(accommodationId);
            expect(
                modelMock.countActiveForAccommodation as ReturnType<typeof vi.fn>
            ).toHaveBeenCalledWith({ accommodationId, ownerId });
            // Row-fetching methods must NOT be called — count path uses dedicated query.
            expect(
                modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>
            ).not.toHaveBeenCalled();
        });

        it('count returns 0 when accommodation not found (D-4 path)', async () => {
            accommodationModelMock.findById.mockResolvedValue(null);

            const result = await service.count(guestActor, {
                ...defaultPagination,
                accommodationId
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(0);
            expect(
                modelMock.countActiveForAccommodation as ReturnType<typeof vi.fn>
            ).not.toHaveBeenCalled();
        });
    });

    // ── FIX 1: pagination forwarding ──────────────────────────────────────────

    describe('pagination forwarding (FIX 1 — ctx.pagination, not params)', () => {
        it('forwards page=2/pageSize=5 from ctx.pagination to findAll', async () => {
            modelMock.findAll.mockResolvedValue({ items: [], total: 0 });

            await service.search(guestActor, { page: 2, pageSize: 5 });

            expect(modelMock.findAll).toHaveBeenCalled();
            // Second argument to findAll is { page, pageSize }.
            const [, paginationArg] = modelMock.findAll.mock.calls[0] ?? [];
            expect(paginationArg).toMatchObject({ page: 2, pageSize: 5 });
        });

        it('forwards page=3/pageSize=10 to findActiveForAccommodation', async () => {
            accommodationModelMock.findById.mockResolvedValue(mockAccommodation);
            (modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>).mockResolvedValue({
                items: [],
                total: 0
            });

            await service.search(guestActor, { page: 3, pageSize: 10, accommodationId });

            expect(
                modelMock.findActiveForAccommodation as ReturnType<typeof vi.fn>
            ).toHaveBeenCalledWith(
                { accommodationId, ownerId },
                expect.objectContaining({ page: 3, pageSize: 10 })
            );
        });
    });
});
