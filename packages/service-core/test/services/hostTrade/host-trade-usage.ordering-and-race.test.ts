/**
 * @fileoverview Two guarantees the usage lists and transitions owe (HOS-2332 review):
 *
 * - **Ordered reads.** `BaseModel.findAll` does not order unless asked, so an
 *   unordered page boundary is arbitrary and a row can show on two pages or
 *   none. Both lists ask for newest first with an `id` tie-break.
 * - **One writer per transition.** The status read is a fast refusal, not the
 *   guarantee. The UPDATE itself is keyed on the state the transition leaves,
 *   so of two commits racing on one PENDING usage only one matches a row; the
 *   other gets the not-pending refusal and writes nothing.
 */
import type {
    HostTradeBenefitUsageModel,
    HostTradeModel,
    HostTradeReviewModel,
    UserModel
} from '@repo/db';

vi.mock('../../../src/services/hostTrade/host-trade-aggregates', () => ({
    recalculateHostTradeAggregates: vi.fn(async () => ({ aggregates: {} }))
}));

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recalculateHostTradeAggregates } from '../../../src/services/hostTrade/host-trade-aggregates';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const HT_ID = getMockId('attraction', 'ht-race-1');
const USAGE_ID = getMockId('feature', 'usage-race-1');
const OWNER_ID = getMockId('user', 'race-owner');
const HOST_ID = getMockId('user', 'race-host');

const actorOf = (id: string) => new ActorFactoryBuilder().withId(id).withPermissions([]).build();

const ORDER = { sortBy: 'createdAt', sortOrder: 'desc', thenSortBy: 'id' };

/**
 * A usage table of one row whose UPDATE behaves like SQL: it matches only when
 * every WHERE column equals the row, and then the row changes.
 */
function buildService(initial: Record<string, unknown>) {
    let row: Record<string, unknown> = { ...initial };
    const model = createModelMock();
    model.findById = vi.fn(async () => ({ ...initial }));
    model.findAll = vi.fn(async () => ({ items: [], total: 0 }));
    model.countRejectionsInWindow = vi.fn(async () => 0);
    model.update = vi.fn(async (where: Record<string, unknown>, data: Record<string, unknown>) => {
        if (!Object.entries(where).every(([key, value]) => row[key] === value)) {
            return null;
        }
        row = { ...row, ...data };
        return { ...row };
    });
    const hostTradeModel = createModelMock(['findByIds']);
    hostTradeModel.findById = vi.fn(async () => ({
        id: HT_ID,
        ownerUserId: OWNER_ID,
        revokedAt: null,
        deletedAt: null,
        declarationSuspendedAt: null
    }));
    hostTradeModel.findByIds = vi.fn(async () => []);
    hostTradeModel.hydrateCategories = vi.fn(async () => new Map());
    const service = new HostTradeUsageService(
        { logger: createLoggerMock() },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        createModelMock() as unknown as UserModel,
        async () => true,
        createModelMock() as unknown as HostTradeReviewModel
    );
    return { service, model, current: () => row };
}

const PENDING = {
    id: USAGE_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: 'PROVIDER',
    declaredById: OWNER_ID,
    status: 'PENDING',
    rejectedById: null,
    deletedAt: null
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ordered reads', () => {
    it('listForHost asks the model for newest first with an id tie-break', async () => {
        const { service, model } = buildService(PENDING);

        await service.listForHost({ page: 2, pageSize: 5 }, actorOf(HOST_ID));

        const options = (model.findAll as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[1];
        expect(options).toEqual({ page: 2, pageSize: 5, ...ORDER });
    });

    it('listForProvider asks the model for the same order', async () => {
        const { service, model } = buildService(PENDING);

        await service.listForProvider(
            { hostTradeId: HT_ID, page: 1, pageSize: 10 },
            actorOf(OWNER_ID)
        );

        const options = (model.findAll as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[1];
        expect(options).toEqual({ page: 1, pageSize: 10, ...ORDER });
    });
});

describe('one writer per transition', () => {
    it('keys the UPDATE on the state the transition leaves', async () => {
        const { service, model } = buildService(PENDING);

        await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        const where = (model.update as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[0];
        expect(where).toEqual({ id: USAGE_ID, status: 'PENDING' });
    });

    it('a confirm and a reject racing on one usage: exactly one writes', async () => {
        // Both read PENDING (findById always answers the initial row), as two
        // parallel commits would.
        const { service, current } = buildService(PENDING);

        const [confirmed, rejected] = await Promise.all([
            service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID)),
            service
                .rejectUsage({ usageId: USAGE_ID, note: 'No vino.' }, actorOf(HOST_ID), {
                    tx: {} as never
                })
                .catch((error: { code?: string }) => ({ error }))
        ]);

        expect(confirmed.data?.usage.status).toBe('CONFIRMED');
        expect(rejected.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(current().status).toBe('CONFIRMED');
        expect(current().rejectionNote).toBeUndefined();
    });

    it('the losing confirm writes nothing and moves no counter', async () => {
        const { service } = buildService(PENDING);
        await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), { tx: {} as never });

        const late = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(late.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(late.error?.message).toContain('expected PENDING');
        expect(recalculateHostTradeAggregates).not.toHaveBeenCalled();
    });

    it('undo is keyed on REJECTED and on who rejected it', async () => {
        const { service, model } = buildService({
            ...PENDING,
            status: 'REJECTED',
            rejectedById: HOST_ID
        });

        await service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID));

        const where = (model.update as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[0];
        expect(where).toEqual({ id: USAGE_ID, status: 'REJECTED', rejectedById: HOST_ID });
    });

    it('a second undo of the same rejection writes nothing', async () => {
        const { service } = buildService({ ...PENDING, status: 'REJECTED', rejectedById: HOST_ID });

        const [first, second] = await Promise.all([
            service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID)),
            service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID))
        ]);

        expect([first.error, second.error].filter(Boolean)).toHaveLength(1);
    });
});
