/**
 * Tests for HOS-21 T-006: accommodation-visibility filter reused inside
 * `OwnerPromotionService.findExclusiveDeals` (HOS-21 T-005).
 *
 * `findExclusiveDeals` mocks `model.findAll`, so these tests assert on the
 * SQL *shape* of the condition passed to it (rendered via `PgDialect`,
 * matching the established convention in
 * `packages/db/test/models/accommodation.order-by.test.ts`) rather than on
 * actual row filtering — real end-to-end filtering is covered by the T-014
 * API integration tests against a live database.
 */
import type { AccommodationModel, OwnerPromotionModel } from '@repo/db';
import { PermissionEnum, TouristAudienceEnum } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import { buildAccommodationVisibilityCondition } from '../../../src/services/owner-promotion/ownerPromotion.visibility';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const dialect = new PgDialect();
function render(condition: SQL): string {
    return dialect.sqlToQuery(condition).sql;
}

const guestActor = createActor({ permissions: [PermissionEnum.ACCESS_API_PUBLIC] });

describe('buildAccommodationVisibilityCondition (HOS-21 T-006)', () => {
    it('allows a null accommodationId (owner-wide promo) unconditionally', () => {
        const rendered = render(buildAccommodationVisibilityCondition());
        expect(rendered).toMatch(/"owner_promotions"\."accommodation_id" is null/i);
    });

    it('excludes accommodations with visibility = RESTRICTED', () => {
        const rendered = render(buildAccommodationVisibilityCondition());
        expect(rendered).toMatch(/"accommodations"\."visibility"\s*<>/i);
    });

    it('excludes owner-suspended accommodations', () => {
        const rendered = render(buildAccommodationVisibilityCondition());
        expect(rendered).toMatch(/"accommodations"\."owner_suspended"\s*=/i);
    });

    it('excludes plan-restricted accommodations', () => {
        const rendered = render(buildAccommodationVisibilityCondition());
        expect(rendered).toMatch(/"accommodations"\."plan_restricted"\s*=/i);
    });

    it('restricts to ACTIVE lifecycleState', () => {
        const rendered = render(buildAccommodationVisibilityCondition());
        expect(rendered).toMatch(/"accommodations"\."lifecycle_state"\s*=/i);
    });

    it('joins on accommodations.id = ownerPromotions.accommodationId via EXISTS', () => {
        const rendered = render(buildAccommodationVisibilityCondition());
        expect(rendered).toMatch(/exists/i);
        expect(rendered).toMatch(
            /"accommodations"\."id" = "owner_promotions"\."accommodation_id"/i
        );
    });
});

describe('OwnerPromotionService.findExclusiveDeals wires the visibility filter (HOS-21 T-006)', () => {
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

    it('adds a third additionalCondition (visibility) for a plus-only request', async () => {
        await service.findExclusiveDeals(guestActor, { page: 1, pageSize: 20 }, [
            TouristAudienceEnum.PLUS
        ]);

        const [, , additionalConditions] = modelMock.findAll.mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBe(3);
    });

    it('adds the same visibility condition for a vip request (excluded for both tiers)', async () => {
        await service.findExclusiveDeals(guestActor, { page: 1, pageSize: 20 }, [
            TouristAudienceEnum.PLUS,
            TouristAudienceEnum.VIP
        ]);

        const [, , additionalConditions] = modelMock.findAll.mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBe(3);
        const visibilityCondition = (additionalConditions as SQL[])[2];
        expect(visibilityCondition).toBeDefined();
        expect(render(visibilityCondition as SQL)).toMatch(/exists/i);
    });
});
