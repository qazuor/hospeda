/**
 * HOS-2270 (G-5, AC-9, AC-11): the accommodation readers are closed to venue
 * promotions. One test per reader that used to read "no accommodation = owner-wide".
 */
import { OwnerPromotionEntityTypeEnum, PermissionEnum, TouristAudienceEnum } from '@repo/schemas';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';

const dialect = new PgDialect();
const ctx = { pagination: { page: 1, pageSize: 20 } } as unknown as ServiceContext;
const guest: Actor = createActor({ permissions: [PermissionEnum.ACCESS_API_PUBLIC] });

type Internals = {
    _executeSearch: (p: Record<string, unknown>, a: Actor, c: ServiceContext) => Promise<unknown>;
    _executeCount: (p: Record<string, unknown>, a: Actor, c: ServiceContext) => Promise<unknown>;
};

describe('OwnerPromotionService accommodation doors (HOS-2270)', () => {
    let model: {
        findAll: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
        findActiveForAccommodation: ReturnType<typeof vi.fn>;
        countActiveForAccommodation: ReturnType<typeof vi.fn>;
    };
    let service: OwnerPromotionService;

    beforeEach(() => {
        model = {
            findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            count: vi.fn().mockResolvedValue(0),
            findActiveForAccommodation: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            countActiveForAccommodation: vi.fn().mockResolvedValue(0)
        };
        service = new OwnerPromotionService({ model: model as never });
    });

    it('AC-9: the public search only asks for accommodation promotions', async () => {
        await (service as unknown as Internals)._executeSearch({}, guest, ctx);

        expect(model.findAll).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION }),
            expect.anything(),
            expect.anything()
        );
    });

    it('the count, which feeds the accommodation quota, only counts accommodation promotions', async () => {
        await (service as unknown as Internals)._executeCount({}, guest, ctx);

        expect(model.count).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION }),
            expect.anything()
        );
    });

    it('the exclusive-deals list is an accommodation list, and its accommodation filter is a dual read', async () => {
        const accommodationId = getMockId('accommodation', 'deal-accommodation');

        await service.findExclusiveDeals(guest, { page: 1, pageSize: 20, accommodationId }, [
            TouristAudienceEnum.PLUS
        ]);

        const [filter, , conditions] = model.findAll.mock.calls[0] ?? [];
        expect(filter).toMatchObject({ entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION });
        expect(filter).not.toHaveProperty('accommodationId');
        const rendered = (conditions as Parameters<PgDialect['sqlToQuery']>[0][]).map(
            (condition) => dialect.sqlToQuery(condition).sql
        );
        expect(rendered.join(' ')).toMatch(
            /"owner_promotions"\."entity_id" = \$\d+ OR "owner_promotions"\."accommodation_id" = \$\d+/
        );
    });
});
