/**
 * @fileoverview The five `_after*` hooks that keep the counters honest (T-059).
 *
 * What the aggregates ADD UP TO is settled against a real database in
 * `test/integration/services/host-trade-aggregates.integration.test.ts` — the
 * arithmetic is SQL, and asserting it through mocks would only restate the
 * mock. What is NOT settled there is whether the recount is actually REACHED
 * from the generic CRUD surface, which is wiring rather than arithmetic and
 * fails in a way the integration suite cannot see.
 *
 * The delete and restore paths are the fragile ones. Their listing is captured
 * on the way IN, by a `_before*` hook, because the row stops being readable
 * before `_after*` runs. That capture writes to `ctx.hookState`, and
 * `rememberParentListing` guards it with `if (ctx.hookState)` — so a base
 * runner that stopped initialising hook state would not throw, would not log,
 * and would simply leave every counter at its stale value. These tests go
 * through the PUBLIC methods for that reason: calling the protected hooks
 * directly would supply the hook state the bug is about.
 */
import type {
    HostTradeBenefitUsageModel,
    HostTradeModel,
    HostTradeReviewModel,
    UserModel
} from '@repo/db';

vi.mock('../../../src/services/hostTrade/host-trade-aggregates', () => ({
    recalculateHostTradeAggregates: vi.fn(async () => ({
        aggregates: {
            confirmedUsesCount: 0,
            distinctHostsCount: 0,
            reviewsCount: 0,
            averageRating: 0,
            benefitRespectedCount: 0
        }
    }))
}));

import {
    HostTradeUsageChannelEnum,
    HostTradeUsageDeclaredByEnum,
    PermissionEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recalculateHostTradeAggregates } from '../../../src/services/hostTrade/host-trade-aggregates';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-hooks-1');
const USAGE_ID = getMockId('feature', 'usage-hooks-1');
const HOST_ID = getMockId('user', 'hooks-host');

/** Admin: the generic CRUD surface is gated on HOST_TRADE_USAGE_MANAGE. */
const adminActor = () =>
    new ActorFactoryBuilder()
        .withId(getMockId('user', 'hooks-admin'))
        .withPermissions([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.HOST_TRADE_USAGE_MANAGE
        ])
        .build();

const usageRow = (overrides: Record<string, unknown> = {}) => ({
    id: USAGE_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: 'HOST',
    declaredById: HOST_ID,
    creationChannel: 'QR',
    status: 'PENDING',
    servicedAt: new Date('2026-08-01'),
    expiresAt: new Date('2026-09-01'),
    confirmedAt: null,
    confirmedById: null,
    rejectedAt: null,
    rejectedById: null,
    rejectionNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides
});

/** The payload the create schema accepts — server-managed fields are absent. */
const createInput = {
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: HostTradeUsageDeclaredByEnum.HOST,
    declaredById: HOST_ID,
    creationChannel: HostTradeUsageChannelEnum.QR,
    servicedAt: '2026-08-01'
};

/**
 * The row `findById` answers with.
 *
 * `deletedAt` decides which path is even reachable: the base refuses to delete
 * an already-deleted row and to restore a live one, both BEFORE the `_before*`
 * hook runs. A restore fixture must therefore arrive deleted, or the call
 * returns `{ count: 0 }` and never reaches the recount being measured.
 */
function buildService(row: Record<string, unknown> = usageRow()) {
    const model = createModelMock();
    const hostTradeModel = createModelMock(['findByIds']);
    const userModel = createModelMock();

    model.findById = vi.fn(async () => row);
    model.create = vi.fn(async (data: Record<string, unknown>) => usageRow(data));
    model.update = vi.fn(async (_where: unknown, data: Record<string, unknown>) => usageRow(data));
    model.softDelete = vi.fn(async () => 1);
    model.hardDelete = vi.fn(async () => 1);
    model.restore = vi.fn(async () => 1);

    const service = new HostTradeUsageService(
        { logger: mockLogger },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        userModel as unknown as UserModel,
        async () => true,
        createModelMock() as unknown as HostTradeReviewModel
    );

    return { service, model };
}

/** Every hostTradeId the recount was asked about, in call order. */
function recountedIds(): string[] {
    const calls = (recalculateHostTradeAggregates as unknown as { mock: { calls: unknown[][] } })
        .mock.calls;
    return calls.map((c) => (c[0] as { hostTradeId: string }).hostTradeId);
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('the five aggregate hooks', () => {
    it('recounts after an admin creates a usage', async () => {
        const { service } = buildService();

        const result = await service.create(adminActor(), createInput);

        expect(result.error).toBeUndefined();
        expect(recountedIds()).toEqual([HT_ID]);
    });

    it('recounts after an admin edits a usage', async () => {
        const { service } = buildService();

        const result = await service.update(adminActor(), USAGE_ID, { note: 'corregido' });

        expect(result.error).toBeUndefined();
        expect(recountedIds()).toEqual([HT_ID]);
    });

    it('recounts after a soft delete', async () => {
        const { service } = buildService();

        const result = await service.softDelete(adminActor(), USAGE_ID);

        expect(result.error).toBeUndefined();
        expect(recountedIds()).toEqual([HT_ID]);
    });

    it('recounts after a hard delete', async () => {
        const { service } = buildService();

        const result = await service.hardDelete(adminActor(), USAGE_ID);

        expect(result.error).toBeUndefined();
        expect(recountedIds()).toEqual([HT_ID]);
    });

    it('recounts after a restore', async () => {
        const { service } = buildService(usageRow({ deletedAt: new Date('2026-08-05') }));

        const result = await service.restore(adminActor(), USAGE_ID);

        expect(result.error).toBeUndefined();
        expect(recountedIds()).toEqual([HT_ID]);
    });
});

describe('the listing captured on the way in', () => {
    /**
     * The capture is what makes the three destructive paths work: after the row
     * is gone, `entity.hostTradeId` is not available to read. Asserting the id
     * rather than merely that a recount happened is the difference between
     * "something was recounted" and "the right listing was".
     */
    const OTHER_LISTING = getMockId('attraction', 'ht-hooks-2');
    type Service = ReturnType<typeof buildService>['service'];

    it.each([
        ['softDelete', false, (s: Service) => s.softDelete(adminActor(), USAGE_ID)],
        ['hardDelete', false, (s: Service) => s.hardDelete(adminActor(), USAGE_ID)],
        ['restore', true, (s: Service) => s.restore(adminActor(), USAGE_ID)]
    ] as const)('%s recounts the listing the row belonged to', async (_name, deleted, call) => {
        const { service } = buildService(
            usageRow({
                hostTradeId: OTHER_LISTING,
                deletedAt: deleted ? new Date('2026-08-05') : null
            })
        );

        await call(service);

        expect(recountedIds()).toEqual([OTHER_LISTING]);
    });

    /**
     * A row that cannot be read on the way in leaves nothing to recount, and
     * that must stay a no-op rather than a crash: the delete still has to
     * happen. Recounting a listing chosen at random would be worse than
     * recounting none.
     */
    it('recounts nothing when the row cannot be read on the way in', async () => {
        const { service, model } = buildService();
        model.findById = vi.fn(async () => null);

        await service.softDelete(adminActor(), USAGE_ID);

        expect(recalculateHostTradeAggregates).not.toHaveBeenCalled();
    });

    /**
     * The base refuses the no-op before any hook runs, so nothing is recounted.
     * Worth stating because the alternative — recounting anyway — would be
     * harmless in effect and would hide that the early return exists at all.
     */
    it('recounts nothing when the delete is a no-op on an already-deleted row', async () => {
        const { service } = buildService(usageRow({ deletedAt: new Date('2026-08-05') }));

        const result = await service.softDelete(adminActor(), USAGE_ID);

        expect(result.data?.count).toBe(0);
        expect(recalculateHostTradeAggregates).not.toHaveBeenCalled();
    });
});
