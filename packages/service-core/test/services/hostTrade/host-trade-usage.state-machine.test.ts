/**
 * @fileoverview The usage state machine, stated exhaustively (T-057).
 *
 * `host-trade-usage.transitions.test.ts` covers who may answer a usage and what
 * each transition writes. This file covers the OTHER half: which source states
 * each transition accepts, and — the part a happy-path suite cannot see — which
 * ones it must refuse. Every arrow the enum's diagram does NOT draw is asserted
 * here, one case per source state, so widening a guard by accident fails a test
 * that names the exact pair that was let through.
 *
 * One case is deliberately unreachable through the real flow:
 * `undoRejection` on a non-REJECTED row that still carries `rejectedById`.
 * Undoing clears that stamp, so no live row looks like this. It is constructed
 * anyway because `undoRejection` has TWO guards in sequence — the rejector's
 * identity, then the status — and a row with a matching `rejectedById` is the
 * only way to reach the second one. Testing it through a realistic row (where
 * `rejectedById` is NULL) proves the identity guard and says nothing at all
 * about the status guard.
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

import { HostTradeUsageStatusEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recalculateHostTradeAggregates } from '../../../src/services/hostTrade/host-trade-aggregates';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-sm-1');
const USAGE_ID = getMockId('feature', 'usage-sm-1');
const OWNER_ID = getMockId('user', 'sm-owner');
const HOST_ID = getMockId('user', 'sm-host');

const { PENDING, CONFIRMED, REJECTED, EXPIRED } = HostTradeUsageStatusEnum;

/** Every state a row can be found in, so no matrix below can silently omit one. */
const ALL_STATUSES = [PENDING, CONFIRMED, REJECTED, EXPIRED] as const;

const actorOf = (id: string) => new ActorFactoryBuilder().withId(id).withPermissions([]).build();

const makeUsage = (overrides: Record<string, unknown> = {}) => ({
    id: USAGE_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: 'PROVIDER',
    declaredById: OWNER_ID,
    status: PENDING,
    confirmedAt: null,
    confirmedById: null,
    rejectedAt: null,
    rejectedById: null,
    rejectionNote: null,
    deletedAt: null,
    ...overrides
});

function buildService(usage: Record<string, unknown> = makeUsage()) {
    const model = createModelMock(['countRejectionsInWindow', 'findExpirableIds']);
    const hostTradeModel = createModelMock();
    const userModel = createModelMock();

    model.findById = vi.fn(async () => usage);
    model.update = vi.fn(
        async (_where: Record<string, unknown>, data: Record<string, unknown>) => ({
            ...usage,
            ...data
        })
    );
    model.countRejectionsInWindow = vi.fn(async () => 0);
    model.findExpirableIds = vi.fn(async () => [] as string[]);
    hostTradeModel.findById = vi.fn(async () => ({
        id: HT_ID,
        ownerUserId: OWNER_ID,
        revokedAt: null,
        deletedAt: null,
        declarationSuspendedAt: null,
        declarationSuspendedById: null,
        declarationSuspendReason: null
    }));
    hostTradeModel.update = vi.fn(async () => ({ id: HT_ID }));

    const service = new HostTradeUsageService(
        { logger: mockLogger },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        userModel as unknown as UserModel,
        async () => true,
        createModelMock() as unknown as HostTradeReviewModel
    );

    return { service, model, hostTradeModel };
}

/** A stub transaction, so `rejectUsage` joins it instead of opening its own. */
const txCtx = () => ({ tx: {} as never });

/** The patch handed to `model.update`. */
function patch(model: ReturnType<typeof createModelMock>): Record<string, unknown> {
    const call = (model.update as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    return call?.[1] as Record<string, unknown>;
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// The arrows the diagram DOES draw
// ---------------------------------------------------------------------------

describe('accepted transitions', () => {
    it('moves PENDING to CONFIRMED', async () => {
        const { service, model } = buildService(makeUsage({ status: PENDING }));

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeUndefined();
        expect(patch(model).status).toBe(CONFIRMED);
    });

    it('moves PENDING to REJECTED', async () => {
        const { service, model } = buildService(makeUsage({ status: PENDING }));

        const result = await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        expect(result.error).toBeUndefined();
        expect(patch(model).status).toBe(REJECTED);
    });

    it('moves REJECTED back to PENDING when the rejector undoes it', async () => {
        const { service, model } = buildService(
            makeUsage({ status: REJECTED, rejectedById: HOST_ID, rejectedAt: new Date() })
        );

        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeUndefined();
        expect(patch(model).status).toBe(PENDING);
    });

    it('moves PENDING to EXPIRED when the window runs out', async () => {
        const { service, model } = buildService();
        model.findExpirableIds = vi.fn(async () => [USAGE_ID]);

        const result = await service.expireOverdueUsages({ now: new Date() });

        expect(result.expired).toBe(1);
        expect(patch(model).status).toBe(EXPIRED);
    });
});

// ---------------------------------------------------------------------------
// Every arrow the diagram does NOT draw
// ---------------------------------------------------------------------------

describe('refused transitions', () => {
    /** Confirming is legal from PENDING and nowhere else. */
    const notConfirmable = ALL_STATUSES.filter((s) => s !== PENDING);

    it.each(notConfirmable)('refuses to confirm a %s usage', async (status) => {
        const { service, model } = buildService(makeUsage({ status }));

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    /**
     * CONFIRMED is the one state that moved a public counter, so a second
     * confirmation is not merely redundant: it would re-stamp `confirmedById`
     * with whoever ran it last and recompute the aggregates off an unchanged
     * row. Called out separately from the loop above because it is the case
     * with a consequence, not just an illegal edge.
     */
    it('refuses a double confirmation without touching the aggregates', async () => {
        const { service, model } = buildService(
            makeUsage({ status: CONFIRMED, confirmedById: HOST_ID, confirmedAt: new Date() })
        );

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
        expect(recalculateHostTradeAggregates).not.toHaveBeenCalled();
    });

    /** Rejecting is legal from PENDING and nowhere else. */
    const notRejectable = ALL_STATUSES.filter((s) => s !== PENDING);

    // Inside a caller's transaction a refusal THROWS rather than returning an
    // envelope — the base service's `if (ctx?.tx) throw error` contract.
    it.each(notRejectable)('refuses to reject a %s usage', async (status) => {
        const { service, model } = buildService(makeUsage({ status }));

        await expect(
            service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx())
        ).rejects.toMatchObject({ code: ServiceErrorCode.VALIDATION_ERROR });
        expect(model.update).not.toHaveBeenCalled();
    });

    /**
     * Undoing is legal from REJECTED and nowhere else. `rejectedById` is set to
     * the actor on purpose in every case: it is what carries the call past the
     * identity guard so the STATUS guard is the thing being measured. See the
     * file header.
     */
    const notUndoable = ALL_STATUSES.filter((s) => s !== REJECTED);

    it.each(notUndoable)('refuses to undo a %s usage', async (status) => {
        const { service, model } = buildService(
            makeUsage({ status, rejectedById: HOST_ID, rejectedAt: new Date() })
        );

        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    /**
     * The identity guard, asserted on its own so the pair above cannot both be
     * satisfied by a single check: a REJECTED row (legal status) answered by
     * somebody who is not the rejector still gets NOT_FOUND, not
     * VALIDATION_ERROR.
     */
    it('separates the identity refusal from the status refusal', async () => {
        const { service, model } = buildService(
            makeUsage({ status: REJECTED, rejectedById: HOST_ID, rejectedAt: new Date() })
        );

        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Counterpart resolution on the reject path
// ---------------------------------------------------------------------------

describe('counterpart resolution when rejecting', () => {
    it('lets the HOST reject what the PROVIDER declared', async () => {
        const { service, model } = buildService(
            makeUsage({ declaredBy: 'PROVIDER', declaredById: OWNER_ID })
        );

        const result = await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        expect(result.error).toBeUndefined();
        expect(patch(model).rejectedById).toBe(HOST_ID);
    });

    it('lets the PROVIDER OWNER reject what the HOST declared', async () => {
        const { service, model } = buildService(
            makeUsage({ declaredBy: 'HOST', declaredById: HOST_ID })
        );

        const result = await service.rejectUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID), txCtx());

        expect(result.error).toBeUndefined();
        expect(patch(model).rejectedById).toBe(OWNER_ID);
    });
});

// ---------------------------------------------------------------------------
// PENDING → EXPIRED: the transition the clock makes
// ---------------------------------------------------------------------------

describe('expireOverdueUsages', () => {
    it('expires every row the model hands it and reports the count', async () => {
        const { service, model } = buildService();
        const ids = [USAGE_ID, getMockId('feature', 'usage-sm-2')];
        model.findExpirableIds = vi.fn(async () => ids);

        const result = await service.expireOverdueUsages({ now: new Date() });

        expect(result.expired).toBe(2);
        const calls = (model.update as unknown as { mock: { calls: unknown[][] } }).mock.calls;
        expect(calls.map((c) => (c[0] as { id: string }).id)).toEqual(ids);
        for (const call of calls) {
            expect(call[1]).toMatchObject({ status: EXPIRED });
        }
    });

    it('writes nothing when no row is overdue', async () => {
        const { service, model } = buildService();

        const result = await service.expireOverdueUsages({ now: new Date() });

        expect(result.expired).toBe(0);
        expect(model.update).not.toHaveBeenCalled();
    });

    /**
     * Only CONFIRMED usages feed the public numbers, so a row leaving PENDING
     * for EXPIRED cannot move a counter. Recomputing would be one query per
     * listing to write back what was already there — the absence of the call is
     * the behaviour, so it is asserted rather than assumed.
     */
    it('does not recalculate the aggregates, which expiry cannot change', async () => {
        const { service, model } = buildService();
        model.findExpirableIds = vi.fn(async () => [USAGE_ID]);

        await service.expireOverdueUsages({ now: new Date() });

        expect(recalculateHostTradeAggregates).not.toHaveBeenCalled();
    });

    it('measures against the moment it was given', async () => {
        const { service, model } = buildService();
        const now = new Date('2026-03-01T12:00:00Z');

        await service.expireOverdueUsages({ now });

        expect(model.findExpirableIds).toHaveBeenCalledWith(now);
    });

    it('falls back to the current moment when none is given', async () => {
        const { service, model } = buildService();
        const before = Date.now();

        await service.expireOverdueUsages();

        const [passed] = (model.findExpirableIds as unknown as { mock: { calls: unknown[][] } })
            .mock.calls[0] as [Date];
        expect(passed).toBeInstanceOf(Date);
        // Derived from the clock, never a literal: a hard-coded "future" date
        // would quietly stop being one.
        expect(passed.getTime()).toBeGreaterThanOrEqual(before);
        expect(passed.getTime()).toBeLessThanOrEqual(Date.now());
    });
});
