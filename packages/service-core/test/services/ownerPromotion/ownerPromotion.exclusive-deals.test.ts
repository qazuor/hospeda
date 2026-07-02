/**
 * Tests for HOS-21 T-005: `OwnerPromotionService.findExclusiveDeals`.
 *
 * This is a NEW dedicated method — it does NOT modify `_executeSearch` /
 * `_executeCount`, which remain the path for the existing ungated public
 * `list.ts` route (PromotionBanner use case, out of scope for HOS-21).
 *
 * `audienceScope` is a plain function parameter (never part of the
 * Zod-validated search params) because it must be SERVER-computed by the
 * gated route handler from the actor's actual entitlements — a free tourist
 * must never be able to request VIP-tier deals via a query parameter.
 */
import type { AccommodationModel, OwnerPromotionModel } from '@repo/db';
import { PermissionEnum, TouristAudienceEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const guestActor = createActor({ permissions: [PermissionEnum.ACCESS_API_PUBLIC] });

describe('OwnerPromotionService.findExclusiveDeals (HOS-21 T-005)', () => {
    let service: OwnerPromotionService;
    let modelMock: ReturnType<typeof createModelMock>;
    let accommodationModelMock: { findById: ReturnType<typeof vi.fn> };
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createModelMock([]);
        accommodationModelMock = { findById: vi.fn() };
        loggerMock = createLoggerMock();
        modelMock.findAll.mockResolvedValue({ items: [], total: 0 });

        service = new OwnerPromotionService({
            logger: loggerMock,
            model: modelMock as unknown as OwnerPromotionModel,
            accommodationModel: accommodationModelMock as unknown as AccommodationModel
        });
    });

    it('scopes to plus-only rows when audienceScope is [PLUS]', async () => {
        const result = await service.findExclusiveDeals(guestActor, { page: 1, pageSize: 20 }, [
            TouristAudienceEnum.PLUS
        ]);

        expect(result.error).toBeUndefined();
        expect(modelMock.findAll).toHaveBeenCalled();
        const [filter] = modelMock.findAll.mock.calls[0] ?? [];
        expect(filter).toMatchObject({ planRestricted: false, deletedAt: null });
    });

    it('includes both plus and vip conditions when audienceScope is [PLUS, VIP]', async () => {
        await service.findExclusiveDeals(guestActor, { page: 1, pageSize: 20 }, [
            TouristAudienceEnum.PLUS,
            TouristAudienceEnum.VIP
        ]);

        expect(modelMock.findAll).toHaveBeenCalled();
        const [, , additionalConditions] = modelMock.findAll.mock.calls[0] ?? [];
        expect(Array.isArray(additionalConditions)).toBe(true);
        // window condition + audience-scope condition
        expect((additionalConditions as unknown[]).length).toBe(2);
    });

    it('always forces lifecycleState=ACTIVE regardless of caller-supplied filter', async () => {
        await service.findExclusiveDeals(guestActor, { page: 1, pageSize: 20 }, [
            TouristAudienceEnum.PLUS
        ]);

        const [filter] = modelMock.findAll.mock.calls[0] ?? [];
        expect((filter as Record<string, unknown>).lifecycleState).toBe('ACTIVE');
    });

    it('excludes plan-restricted and soft-deleted rows via the public filter', async () => {
        await service.findExclusiveDeals(guestActor, { page: 1, pageSize: 20 }, [
            TouristAudienceEnum.VIP
        ]);

        const [filter] = modelMock.findAll.mock.calls[0] ?? [];
        expect((filter as Record<string, unknown>).planRestricted).toBe(false);
        expect((filter as Record<string, unknown>).deletedAt).toBeNull();
    });

    it('rejects an empty audienceScope array', async () => {
        const result = await service.findExclusiveDeals(guestActor, { page: 1, pageSize: 20 }, []);

        expect(result.error).toBeDefined();
        expect(modelMock.findAll).not.toHaveBeenCalled();
    });

    it('forwards page/pageSize to findAll', async () => {
        await service.findExclusiveDeals(guestActor, { page: 2, pageSize: 5 }, [
            TouristAudienceEnum.PLUS
        ]);

        const [, pagination] = modelMock.findAll.mock.calls[0] ?? [];
        expect(pagination).toMatchObject({ page: 2, pageSize: 5 });
    });
});
