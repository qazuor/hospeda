/**
 * HOS-2590 regression: the public search of owner promotions honours the
 * reader's tourist-audience scope.
 *
 * Before the fix, `_executeSearch` / `_executeCount` never looked at
 * `touristAudience`, so a VIP-only promotion reached every public reader. The
 * scope rides in `ctx.hookState` (built by `buildOwnerPromotionAudienceContext`)
 * and defaults to PLUS only when absent or malformed (fail closed).
 */
import type { AccommodationModel, OwnerPromotionModel } from '@repo/db';
import { PermissionEnum, TouristAudienceEnum } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildOwnerPromotionAudienceContext,
    resolveOwnerPromotionAudienceScope
} from '../../../src/services/owner-promotion/ownerPromotion.audience-scope';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import type { ServiceContext } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const dialect = new PgDialect();
const guestActor = createActor({ permissions: [PermissionEnum.ACCESS_API_PUBLIC] });
const ACCOMMODATION_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const VIP_SCOPE = [TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP] as const;

type ExecuteHooks = {
    _executeSearch: (
        params: Record<string, unknown>,
        actor: unknown,
        ctx: ServiceContext
    ) => Promise<unknown>;
    _executeCount: (
        params: Record<string, unknown>,
        actor: unknown,
        ctx: ServiceContext
    ) => Promise<unknown>;
};

/** Renders every additional condition handed to `findAll`/`count` as SQL text. */
function renderConditions(conditions: unknown): { sql: string; params: unknown[] } {
    const list = (conditions as SQL[] | undefined) ?? [];
    const rendered = list.map((condition) => dialect.sqlToQuery(condition));
    return {
        sql: rendered.map((query) => query.sql).join(' AND '),
        params: rendered.flatMap((query) => query.params)
    };
}

describe('resolveOwnerPromotionAudienceScope (HOS-2590)', () => {
    it('defaults to PLUS only when the context carries no scope', () => {
        expect(resolveOwnerPromotionAudienceScope({ ctx: undefined })).toEqual([
            TouristAudienceEnum.PLUS
        ]);
        expect(resolveOwnerPromotionAudienceScope({ ctx: { hookState: {} } })).toEqual([
            TouristAudienceEnum.PLUS
        ]);
    });

    it('falls back to PLUS only for a malformed scope (fail closed)', () => {
        const ctx = { hookState: { touristAudienceScope: ['gold'] } };
        expect(resolveOwnerPromotionAudienceScope({ ctx })).toEqual([TouristAudienceEnum.PLUS]);
    });

    it('returns the scope built by buildOwnerPromotionAudienceContext', () => {
        const ctx = buildOwnerPromotionAudienceContext({ audienceScope: VIP_SCOPE });
        expect(resolveOwnerPromotionAudienceScope({ ctx })).toEqual([...VIP_SCOPE]);
    });
});

describe('OwnerPromotionService public search audience scope (HOS-2590)', () => {
    let service: OwnerPromotionService;
    let model: {
        findAll: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
        findActiveForAccommodation: ReturnType<typeof vi.fn>;
        countActiveForAccommodation: ReturnType<typeof vi.fn>;
    };
    let hooks: ExecuteHooks;

    beforeEach(() => {
        model = {
            findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            count: vi.fn().mockResolvedValue(0),
            findActiveForAccommodation: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            countActiveForAccommodation: vi.fn().mockResolvedValue(0)
        };
        const accommodationModel = {
            findById: vi.fn().mockResolvedValue({ id: ACCOMMODATION_ID, ownerId: OWNER_ID })
        };
        service = new OwnerPromotionService({
            logger: createLoggerMock(),
            model: model as unknown as OwnerPromotionModel,
            accommodationModel: accommodationModel as unknown as AccommodationModel
        });
        hooks = service as unknown as ExecuteHooks;
    });

    it('scopes the accommodation read to PLUS for a reader without a scope', async () => {
        // Act
        await hooks._executeSearch({ accommodationId: ACCOMMODATION_ID }, guestActor, {});
        await hooks._executeCount({ accommodationId: ACCOMMODATION_ID }, guestActor, {});

        // Assert
        expect(model.findActiveForAccommodation).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                ownerId: OWNER_ID,
                touristAudiences: [TouristAudienceEnum.PLUS]
            },
            expect.anything()
        );
        expect(model.countActiveForAccommodation).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            ownerId: OWNER_ID,
            touristAudiences: [TouristAudienceEnum.PLUS]
        });
    });

    it('lets a VIP scope read VIP promotions of the accommodation', async () => {
        // Arrange
        const ctx = buildOwnerPromotionAudienceContext({ audienceScope: VIP_SCOPE });

        // Act
        await hooks._executeSearch({ accommodationId: ACCOMMODATION_ID }, guestActor, ctx);

        // Assert
        const [params] = model.findActiveForAccommodation.mock.calls[0] ?? [];
        expect(params).toMatchObject({ touristAudiences: [...VIP_SCOPE] });
    });

    it('adds the audience condition to the generic search and count paths', async () => {
        // Act
        await hooks._executeSearch({}, guestActor, {});
        await hooks._executeCount({}, guestActor, {});

        // Assert
        const [, , searchConditions] = model.findAll.mock.calls[0] ?? [];
        const search = renderConditions(searchConditions);
        expect(search.sql).toMatch(/"owner_promotions"\."tourist_audience" in \(\$\d+\)/i);
        expect(search.params).toContain(TouristAudienceEnum.PLUS);
        expect(search.params).not.toContain(TouristAudienceEnum.VIP);

        const [, countOptions] = model.count.mock.calls[0] ?? [];
        const count = renderConditions(
            (countOptions as { additionalConditions?: SQL[] }).additionalConditions
        );
        expect(count.params).toContain(TouristAudienceEnum.PLUS);
        expect(count.params).not.toContain(TouristAudienceEnum.VIP);
    });

    it('carries the scope through the public search() pipeline', async () => {
        // Act
        const result = await service.search(
            guestActor,
            { accommodationId: ACCOMMODATION_ID, page: 1, pageSize: 20 },
            buildOwnerPromotionAudienceContext({ audienceScope: VIP_SCOPE })
        );

        // Assert
        expect(result.error).toBeUndefined();
        const [params] = model.findActiveForAccommodation.mock.calls[0] ?? [];
        expect(params).toMatchObject({ touristAudiences: [...VIP_SCOPE] });
    });
});
