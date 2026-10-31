/**
 * HOS-1917 regression: every `_executeSearch` must honour the pagination that
 * `BaseCrudRead.search` republishes on `ctx.pagination` (SPEC-088). Reading
 * `page`/`pageSize` from `params` returns `undefined` there, so `?page=2` came
 * back as page 1.
 */
import {
    ContentModerationTermModel,
    ExchangeRateModel,
    experienceModel,
    type PartnerModel,
    venueModel
} from '@repo/db';
import { PermissionEnum, PriceCurrencyEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentModerationTermService } from '../../src/services/contentModeration/term.service';
import { ExchangeRateService } from '../../src/services/exchange-rate/exchange-rate.service';
import { ExperienceService } from '../../src/services/experience/experience.service';
import { PartnerService } from '../../src/services/partner/partner.service';
import { SocialAudienceService } from '../../src/services/social/social-audience.service';
import { SocialCampaignService } from '../../src/services/social/social-campaign.service';
import { SocialContentBatchService } from '../../src/services/social/social-content-batch.service';
import { SocialHashtagService } from '../../src/services/social/social-hashtag.service';
import { SocialHashtagSetService } from '../../src/services/social/social-hashtag-set.service';
import { SocialPlatformFormatService } from '../../src/services/social/social-platform-format.service';
import { SocialPostFooterService } from '../../src/services/social/social-post-footer.service';
import { SocialSettingService } from '../../src/services/social/social-setting.service';
import { VenueService } from '../../src/services/venue/venue.service';
import type { Actor, ServiceConfig, ServiceContext } from '../../src/types';
import { createActor } from '../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../utils/modelMockFactory';

const dbCalls = vi.hoisted(() => ({ limit: [] as number[], offset: [] as number[] }));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    // Chainable stand-in for the select().from().where().limit().offset().orderBy() chain.
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'from', 'where', 'orderBy']) chain[name] = () => chain;
    chain.limit = (n: number) => {
        dbCalls.limit.push(n);
        return chain;
    };
    chain.offset = (n: number) => {
        dbCalls.offset.push(n);
        return chain;
    };
    // Awaiting the chain resolves to one count row; the items query ignores it.
    Object.defineProperty(chain, 'then', {
        value: (resolve: (rows: unknown[]) => void) => resolve([{ value: 0 }])
    });
    return { ...original, getDb: () => chain };
});

/** Shape of the protected hook, so tests can call it without `any`. */
type SearchHook = {
    _executeSearch(params: object, actor: Actor, ctx: ServiceContext): Promise<unknown>;
};

const actor = createActor({
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: Object.values(PermissionEnum)
});
const config = { logger: createLoggerMock() } as unknown as ServiceConfig;
const ctx = (extra: Partial<NonNullable<ServiceContext['pagination']>> = {}): ServiceContext =>
    ({ hookState: {}, pagination: { page: 3, pageSize: 7, ...extra } }) as ServiceContext;
const empty = { items: [], total: 0 };

describe('_executeSearch honours ctx.pagination (HOS-1917)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        dbCalls.limit.length = 0;
        dbCalls.offset.length = 0;
    });

    it('ExchangeRateService.search forwards page and pageSize to the model', async () => {
        const model = new ExchangeRateModel();
        const spy = vi.spyOn(model, 'findAllWithDateRange').mockResolvedValue(empty);
        const service = new ExchangeRateService(config, model);

        await service.search(actor, {
            fromCurrency: PriceCurrencyEnum.USD,
            page: 3,
            pageSize: 7
        });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]?.[1]).toEqual({ page: 3, pageSize: 7 });
        // pagination must not leak into the filter object
        expect(spy.mock.calls[0]?.[0]).toEqual({ fromCurrency: PriceCurrencyEnum.USD });
    });

    it('PartnerService.search forwards page, pageSize and sort to findByFilters', async () => {
        const model = {
            findByFilters: vi.fn().mockResolvedValue([]),
            countActivePartners: vi.fn().mockResolvedValue(0)
        } as unknown as PartnerModel;
        const service = new PartnerService({ ...config, model });

        await service.search(actor, { page: 3, pageSize: 7, q: 'sol' });

        const filters = vi.mocked(model.findByFilters).mock.calls[0]?.[0];
        expect(filters).toMatchObject({ page: 3, pageSize: 7, q: 'sol', lifecycleState: 'ACTIVE' });
    });

    it.each([
        ['venue', venueModel, () => new VenueService(config)],
        ['experience', experienceModel, () => new ExperienceService(config)]
    ] as const)('%s service forwards page and pageSize', async (_name, model, build) => {
        const spy = vi.spyOn(model, 'findAllWithRelations').mockResolvedValue(empty);

        await (build() as unknown as SearchHook)._executeSearch({}, actor, ctx());

        expect(spy.mock.calls[0]?.[2]).toMatchObject({ page: 3, pageSize: 7 });
    });

    it('ContentModerationTermService applies limit and offset from ctx.pagination', async () => {
        const service = new ContentModerationTermService(config, new ContentModerationTermModel());

        await (service as unknown as SearchHook)._executeSearch({}, actor, ctx());

        expect(dbCalls.limit).toEqual([7]);
        expect(dbCalls.offset).toEqual([14]);
    });

    it.each([
        ['SocialCampaignService', SocialCampaignService],
        ['SocialHashtagSetService', SocialHashtagSetService],
        ['SocialPostFooterService', SocialPostFooterService],
        ['SocialSettingService', SocialSettingService],
        ['SocialContentBatchService', SocialContentBatchService],
        ['SocialAudienceService', SocialAudienceService],
        ['SocialHashtagService', SocialHashtagService],
        ['SocialPlatformFormatService', SocialPlatformFormatService]
    ] as const)('%s forwards page and pageSize to model.findAll', async (_name, Service) => {
        const model = createModelMock();
        model.findAll.mockResolvedValue(empty);
        const service = new (
            Service as unknown as new (
                c: ServiceConfig,
                m: unknown
            ) => SearchHook
        )(config, model);

        await service._executeSearch({}, actor, ctx());

        expect(model.findAll.mock.calls[0]?.[1]).toMatchObject({ page: 3, pageSize: 7 });
    });
});
