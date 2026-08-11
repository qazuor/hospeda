/**
 * @fileoverview Confirm / reject / undo transitions for benefit usages (T-021).
 *
 * The rule under test is that `declaredBy` decides WHO may answer: the
 * counterpart of whoever opened the row, and nobody else. Every wrong actor —
 * including the declarant answering their own declaration (AC-6) — gets 404
 * rather than 403, following the anti-oracle criterion of
 * `alliance/protected/claim.ts`.
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

import { HOST_TRADE_REJECTION_WINDOW_DAYS, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recalculateHostTradeAggregates } from '../../../src/services/hostTrade/host-trade-aggregates';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-tx-1');
const USAGE_ID = getMockId('feature', 'usage-tx-1');
const OWNER_ID = getMockId('user', 'tx-owner');
const HOST_ID = getMockId('user', 'tx-host');
const STRANGER_ID = getMockId('user', 'tx-stranger');

const actorOf = (id: string) => new ActorFactoryBuilder().withId(id).withPermissions([]).build();

const makeUsage = (overrides: Record<string, unknown> = {}) => ({
    id: USAGE_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: 'PROVIDER',
    declaredById: OWNER_ID,
    status: 'PENDING',
    confirmedAt: null,
    confirmedById: null,
    rejectedAt: null,
    rejectedById: null,
    rejectionNote: null,
    deletedAt: null,
    ...overrides
});

function buildService(
    usage: Record<string, unknown> = makeUsage(),
    options: {
        rejectionsInWindow?: number;
        provider?: Record<string, unknown> | null;
    } = {}
) {
    const model = createModelMock();
    // `findByIds` is outside the default mock surface: the host-facing lists use
    // it to name each row's provider in a single query.
    const hostTradeModel = createModelMock(['findByIds']);
    const userModel = createModelMock();

    model.findById = vi.fn(async () => usage);
    // `BaseModel.update` takes a WHERE clause first, not an id — the mock
    // mirrors that shape so it cannot accept a call the real model would reject.
    model.update = vi.fn(
        async (_where: Record<string, unknown>, data: Record<string, unknown>) => ({
            ...usage,
            ...data
        })
    );
    model.countRejectionsInWindow = vi.fn(async () => options.rejectionsInWindow ?? 0);
    hostTradeModel.findById = vi.fn(async () =>
        options.provider === undefined
            ? {
                  id: HT_ID,
                  ownerUserId: OWNER_ID,
                  revokedAt: null,
                  deletedAt: null,
                  declarationSuspendedAt: null,
                  declarationSuspendedById: null,
                  declarationSuspendReason: null
              }
            : options.provider
    );
    hostTradeModel.findByIds = vi.fn(async (ids: readonly string[]) =>
        ids.map((id) => ({
            id,
            slug: 'plomero-centro',
            name: 'Plomero Centro',
            category: 'PLOMERIA'
        }))
    );
    hostTradeModel.update = vi.fn(
        async (_where: Record<string, unknown>, data: Record<string, unknown>) => ({
            id: HT_ID,
            ...data
        })
    );

    const service = new HostTradeUsageService(
        { logger: mockLogger },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        userModel as unknown as UserModel,
        async () => true
    );

    return { service, model, hostTradeModel };
}

/** A stub transaction, so the service joins it instead of opening its own. */
const txCtx = () => ({ tx: {} as never });

/** The patch handed to `model.update`. */
function patch(model: ReturnType<typeof createModelMock>): Record<string, unknown> {
    const call = (model.update as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    return call?.[1] as Record<string, unknown>;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('counterpart resolution', () => {
    it('lets the HOST confirm what the PROVIDER declared', async () => {
        const { service, model } = buildService(makeUsage({ declaredBy: 'PROVIDER' }));

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeUndefined();
        expect(patch(model).status).toBe('CONFIRMED');
    });

    it('lets the PROVIDER OWNER confirm what the HOST declared', async () => {
        const { service, model } = buildService(
            makeUsage({ declaredBy: 'HOST', declaredById: HOST_ID })
        );

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        expect(result.error).toBeUndefined();
        expect(patch(model).status).toBe('CONFIRMED');
    });

    /** AC-6 — the declarant may not confirm their own declaration. */
    it('answers 404 when the declarant confirms their own declaration', async () => {
        const { service, model } = buildService(makeUsage({ declaredBy: 'PROVIDER' }));

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers 404 for an unrelated third party', async () => {
        const { service, model } = buildService();

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(STRANGER_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers 404 for a usage that does not exist', async () => {
        const { service, model } = buildService();
        model.findById = vi.fn(async () => null);

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('confirmUsage', () => {
    it('seals confirmedAt and confirmedById', async () => {
        const { service, model } = buildService();

        await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        const data = patch(model);
        expect(data.confirmedById).toBe(HOST_ID);
        expect(data.confirmedAt).toBeInstanceOf(Date);
    });

    it('refuses a usage that is no longer PENDING', async () => {
        const { service, model } = buildService(makeUsage({ status: 'CONFIRMED' }));

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeDefined();
        expect(model.update).not.toHaveBeenCalled();
    });
});

/**
 * Rejecting runs inside a transaction since T-022: the rejection and the
 * suspension it may trigger are ONE unit of work. These calls therefore carry a
 * ctx, and refusals THROW instead of returning an envelope — the base service's
 * `if (ctx?.tx) throw error` contract.
 */
describe('rejectUsage', () => {
    it('seals rejectedAt, rejectedById and the note', async () => {
        const { service, model } = buildService();

        await service.rejectUsage(
            { usageId: USAGE_ID, note: 'Nunca vino a casa' },
            actorOf(HOST_ID),
            txCtx()
        );

        const data = patch(model);
        expect(data.status).toBe('REJECTED');
        expect(data.rejectedById).toBe(HOST_ID);
        expect(data.rejectedAt).toBeInstanceOf(Date);
        expect(data.rejectionNote).toBe('Nunca vino a casa');
    });

    it('accepts a rejection with no note — refusing must stay cheap', async () => {
        const { service, model } = buildService();

        const result = await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        expect(result.error).toBeUndefined();
        expect(patch(model).rejectionNote).toBeNull();
    });

    it('answers 404 for the declarant rejecting their own declaration', async () => {
        const { service, model } = buildService();

        await expect(
            service.rejectUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID), txCtx())
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('undoRejection', () => {
    const rejected = () =>
        makeUsage({
            status: 'REJECTED',
            rejectedAt: new Date('2026-08-01T00:00:00Z'),
            rejectedById: HOST_ID,
            rejectionNote: 'Me equivoqué'
        });

    it('returns the usage to PENDING and clears the rejection stamps', async () => {
        const { service, model } = buildService(rejected());

        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeUndefined();
        const data = patch(model);
        expect(data.status).toBe('PENDING');
        expect(data.rejectedAt).toBeNull();
        expect(data.rejectedById).toBeNull();
        expect(data.rejectionNote).toBeNull();
    });

    it('answers 404 when somebody other than the rejector undoes it', async () => {
        const { service, model } = buildService(rejected());

        // The counterpart rule alone would let the provider owner undo a
        // rejection aimed at him. Reversal is the rejector's call, not the
        // rejected party's.
        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('refuses to undo a usage that is not REJECTED', async () => {
        const { service, model } = buildService();

        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeDefined();
        expect(model.update).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Denormalised aggregates (T-023)
// ---------------------------------------------------------------------------

describe('aggregate recalculation', () => {
    it('recalculates the listing counters after a confirmation', async () => {
        const { service } = buildService();

        await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(recalculateHostTradeAggregates).toHaveBeenCalledWith(
            expect.objectContaining({ hostTradeId: HT_ID })
        );
    });

    /**
     * Rejection does not touch a counter, and this pins WHY rather than merely
     * recording today's behaviour: only CONFIRMED rows are counted, `reject`
     * runs from PENDING and `undo` from REJECTED, so neither enters or leaves
     * CONFIRMED. If a future transition breaks that — a confirmed usage being
     * reversible, say — this test is the one that has to change first.
     */
    it('does not recalculate after a rejection, which cannot change a counter', async () => {
        const { service } = buildService();

        await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        expect(recalculateHostTradeAggregates).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Automatic declaration suspension by rejection threshold (T-022, AC-11/AC-12)
// ---------------------------------------------------------------------------

const ADMIN_ID = getMockId('user', 'tx-admin');

const adminActor = () =>
    new ActorFactoryBuilder()
        .withId(ADMIN_ID)
        .withPermissions([PermissionEnum.HOST_TRADE_USAGE_MANAGE])
        .build();

/** The patch handed to `hostTradeModel.update`. */
function providerPatch(model: ReturnType<typeof createModelMock>): Record<string, unknown> {
    const call = (model.update as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    return call?.[1] as Record<string, unknown>;
}

describe('rejection threshold — the automatic suspension', () => {
    /**
     * Two is not a pattern. The threshold is above 1 deliberately (see
     * HOST_TRADE_REJECTION_SUSPEND_THRESHOLD): one rejection can be a
     * misunderstanding or a mis-tap on an email a host barely read.
     */
    it('does not suspend below the threshold', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), { rejectionsInWindow: 2 });

        await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });

    it('suspends declaration when the rejection reaches the threshold', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), { rejectionsInWindow: 3 });

        await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        const [where, data] = (hostTradeModel.update as unknown as { mock: { calls: unknown[][] } })
            .mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
        expect(where).toEqual({ id: HT_ID });
        expect(data.declarationSuspendedAt).toBeInstanceOf(Date);
        expect(data.declarationSuspendReason).toEqual(expect.any(String));
    });

    /**
     * NULL is not "unknown", it is the load-bearing marker for "the threshold
     * did this, no human decided it" — the column comment says so, and the admin
     * screen tells the two cases apart by exactly this.
     */
    it('leaves declarationSuspendedById NULL, which is what marks it automatic', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), { rejectionsInWindow: 3 });

        await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        expect(providerPatch(hostTradeModel).declarationSuspendedById).toBeNull();
    });

    it('counts over the configured window, not an ad-hoc one', async () => {
        const { service, model } = buildService(makeUsage(), { rejectionsInWindow: 3 });

        await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        expect(model.countRejectionsInWindow).toHaveBeenCalledWith(
            HT_ID,
            HOST_TRADE_REJECTION_WINDOW_DAYS,
            expect.anything()
        );
    });

    /**
     * A provider already suspended is left alone. Re-stamping would move the
     * date an admin is looking at and, worse, overwrite the reason a human
     * wrote with the generated one.
     */
    it('does not re-stamp a provider who is already suspended', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), {
            rejectionsInWindow: 5,
            provider: {
                id: HT_ID,
                ownerUserId: OWNER_ID,
                revokedAt: null,
                deletedAt: null,
                declarationSuspendedAt: new Date('2026-07-01T00:00:00Z'),
                declarationSuspendedById: ADMIN_ID,
                declarationSuspendReason: 'Suspendido a mano tras una denuncia'
            }
        });

        await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID), txCtx());

        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });

    /**
     * AC-10 — undoing drops the rejection out of the count, but it does NOT lift
     * a suspension that already landed. Lifting is an explicit admin act: the
     * host who reverted his own rejection knows nothing about the other two that
     * put the provider over the line.
     */
    it('does not lift the suspension when a rejection is undone', async () => {
        const { service, hostTradeModel } = buildService(
            makeUsage({
                status: 'REJECTED',
                rejectedAt: new Date('2026-08-01T00:00:00Z'),
                rejectedById: HOST_ID
            }),
            {
                rejectionsInWindow: 2,
                provider: {
                    id: HT_ID,
                    ownerUserId: OWNER_ID,
                    revokedAt: null,
                    deletedAt: null,
                    declarationSuspendedAt: new Date('2026-08-01T00:00:00Z'),
                    declarationSuspendedById: null,
                    declarationSuspendReason: 'Automática'
                }
            }
        );

        await service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });
});

describe('liftDeclarationSuspension — the admin act (AC-12)', () => {
    const suspended = () => ({
        id: HT_ID,
        ownerUserId: OWNER_ID,
        revokedAt: null,
        deletedAt: null,
        declarationSuspendedAt: new Date('2026-08-01T00:00:00Z'),
        declarationSuspendedById: null,
        declarationSuspendReason: 'Automática: 3 rechazos'
    });

    it('refuses an actor without HOST_TRADE_USAGE_MANAGE', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), { provider: suspended() });

        const result = await service.liftDeclarationSuspension(
            { hostTradeId: HT_ID },
            actorOf(OWNER_ID)
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });

    it('clears the whole trio so the provider can declare again', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), { provider: suspended() });

        const result = await service.liftDeclarationSuspension(
            { hostTradeId: HT_ID },
            adminActor()
        );

        expect(result.error).toBeUndefined();
        const data = providerPatch(hostTradeModel);
        expect(data.declarationSuspendedAt).toBeNull();
        expect(data.declarationSuspendedById).toBeNull();
        expect(data.declarationSuspendReason).toBeNull();
    });

    /** AC-12 — "queda registrado quién la levantó". */
    it('records the admin who lifted it', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), { provider: suspended() });

        await service.liftDeclarationSuspension({ hostTradeId: HT_ID }, adminActor());

        expect(providerPatch(hostTradeModel).updatedById).toBe(ADMIN_ID);
    });

    it('answers NOT_FOUND for a listing that does not exist', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), { provider: null });

        const result = await service.liftDeclarationSuspension(
            { hostTradeId: HT_ID },
            adminActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });

    /**
     * The cross of the permission case and the missing-listing one, which is
     * the only thing that pins their ORDER. Each alone passes whichever way
     * round the gate and the lookup run — the 403 case names a listing that
     * exists, the 404 case is asked by an admin. Looking up first would let
     * anybody with a session tell an absent listing id from a present one by
     * the error code, without holding the permission to do anything with it.
     */
    it('answers FORBIDDEN, not NOT_FOUND, when an unauthorised actor names a listing that does not exist', async () => {
        const { service, hostTradeModel } = buildService(makeUsage(), { provider: null });

        const result = await service.liftDeclarationSuspension(
            { hostTradeId: HT_ID },
            actorOf(OWNER_ID)
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(hostTradeModel.findById).not.toHaveBeenCalled();
    });

    /**
     * Lifting a suspension that is not there is the outcome the admin wanted, so
     * it succeeds without writing. An error here would make a double-click on
     * the admin screen look like a failure.
     */
    it('is a no-op when the provider is not suspended', async () => {
        const { service, hostTradeModel } = buildService(makeUsage());

        const result = await service.liftDeclarationSuspension(
            { hostTradeId: HT_ID },
            adminActor()
        );

        expect(result.error).toBeUndefined();
        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The host's pending inbox (T-030)
// ---------------------------------------------------------------------------

describe('listPendingForHost', () => {
    function buildInbox(rows: Record<string, unknown>[] = [], total = rows.length) {
        const model = createModelMock();
        model.findPendingForUser = vi.fn(async () => rows);
        model.countPendingForUser = vi.fn(async () => total);

        // The inbox names the provider of every row it returns, so its listing
        // model needs the batch read even in a test that only asserts paging.
        const hostTradeModel = createModelMock(['findByIds']);
        hostTradeModel.findByIds = vi.fn(async (ids: readonly string[]) =>
            ids.map((id) => ({
                id,
                slug: 'plomero-centro',
                name: 'Plomero Centro',
                category: 'PLOMERIA'
            }))
        );

        // The inbox resolves `hasReview` per row; nothing in this file exercises
        // the flag, so an empty result keeps every assertion here about the
        // inbox itself.
        const reviewModel = createModelMock();
        reviewModel.findAll = vi.fn(async () => ({ items: [], total: 0 }));

        const service = new HostTradeUsageService(
            { logger: mockLogger },
            model as unknown as HostTradeBenefitUsageModel,
            hostTradeModel as unknown as HostTradeModel,
            createModelMock() as unknown as UserModel,
            async () => true,
            reviewModel as unknown as HostTradeReviewModel
        );
        return { service, model };
    }

    it('returns the rows and the total for the acting host', async () => {
        const { service, model } = buildInbox([makeUsage()], 7);

        const result = await service.listPendingForHost(
            { page: 1, pageSize: 10 },
            actorOf(HOST_ID)
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(7);
        expect(model.findPendingForUser).toHaveBeenCalledWith(
            HOST_ID,
            { page: 1, pageSize: 10 },
            undefined
        );
    });

    /**
     * The inbox is the actor's, never a parameter. A `hostUserId` the caller
     * could pass would turn a page about your own pending confirmations into a
     * reader for anyone else's.
     */
    it('scopes to the actor, never to a caller-supplied id', async () => {
        const { service, model } = buildInbox();

        await service.listPendingForHost(
            { page: 1, pageSize: 10, hostUserId: OWNER_ID } as never,
            actorOf(HOST_ID)
        );

        expect(model.findPendingForUser).toHaveBeenCalledWith(
            HOST_ID,
            expect.anything(),
            undefined
        );
    });

    it('refuses an actor with no session', async () => {
        const { service, model } = buildInbox();
        const anonymous = new ActorFactoryBuilder().withId('').withPermissions([]).build();

        const result = await service.listPendingForHost({ page: 1, pageSize: 10 }, anonymous);

        expect(result.error).toBeDefined();
        expect(model.findPendingForUser).not.toHaveBeenCalled();
    });

    it('counts the badge from the same definition as the list', async () => {
        const { service, model } = buildInbox([], 4);

        const result = await service.countPendingForHost(actorOf(HOST_ID));

        expect(result.data?.count).toBe(4);
        expect(model.countPendingForUser).toHaveBeenCalledWith(HOST_ID, undefined);
    });
});

// ---------------------------------------------------------------------------
// The provider's own usages and selector (T-031)
// ---------------------------------------------------------------------------

describe('listForProvider', () => {
    function buildProviderList(rows: Record<string, unknown>[] = [], total = rows.length) {
        const model = createModelMock();
        model.findAll = vi.fn(async () => ({ items: rows, total }));
        model.count = vi.fn(async () => total);

        const service = new HostTradeUsageService(
            { logger: mockLogger },
            model as unknown as HostTradeBenefitUsageModel,
            createModelMock() as unknown as HostTradeModel,
            createModelMock() as unknown as UserModel,
            async () => true
        );
        return { service, model };
    }

    it('scopes every row to the listing it was told about', async () => {
        const { service, model } = buildProviderList([makeUsage()]);

        const result = await service.listForProvider(
            { hostTradeId: HT_ID, page: 1, pageSize: 10 },
            actorOf(OWNER_ID)
        );

        expect(result.error).toBeUndefined();
        const where = (model.findAll as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[0] as Record<string, unknown>;
        expect(where.hostTradeId).toBe(HT_ID);
        expect(where.deletedAt).toBeNull();
    });

    it('filters by status when one is given', async () => {
        const { service, model } = buildProviderList();

        await service.listForProvider(
            { hostTradeId: HT_ID, status: 'PENDING' as never, page: 1, pageSize: 10 },
            actorOf(OWNER_ID)
        );

        const where = (model.findAll as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[0] as Record<string, unknown>;
        expect(where.status).toBe('PENDING');
    });

    /** No status means every state — the provider's history, not just his queue. */
    it('does not filter by status when none is given', async () => {
        const { service, model } = buildProviderList();

        await service.listForProvider(
            { hostTradeId: HT_ID, page: 1, pageSize: 10 },
            actorOf(OWNER_ID)
        );

        const where = (model.findAll as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[0] as Record<string, unknown>;
        expect(where).not.toHaveProperty('status');
    });
});

describe('listLinkedHosts', () => {
    function buildSelector(rows: Record<string, unknown>[] = []) {
        const model = createModelMock();
        model.findLinkedHostsWithNames = vi.fn(async () => rows);

        const service = new HostTradeUsageService(
            { logger: mockLogger },
            model as unknown as HostTradeBenefitUsageModel,
            createModelMock() as unknown as HostTradeModel,
            createModelMock() as unknown as UserModel,
            async () => true
        );
        return { service, model };
    }

    it('prefers the display name the host chose', async () => {
        const { service } = buildSelector([
            { id: HOST_ID, displayName: 'Casa del Río', firstName: 'Ana', lastName: 'Pérez' }
        ]);

        const result = await service.listLinkedHosts({ hostTradeId: HT_ID }, actorOf(OWNER_ID));

        expect(result.data?.hosts).toEqual([{ id: HOST_ID, displayName: 'Casa del Río' }]);
    });

    it('falls back to the full name when there is no display name', async () => {
        const { service } = buildSelector([
            { id: HOST_ID, displayName: null, firstName: 'Ana', lastName: 'Pérez' }
        ]);

        const result = await service.listLinkedHosts({ hostTradeId: HT_ID }, actorOf(OWNER_ID));

        expect(result.data?.hosts[0]?.displayName).toBe('Ana Pérez');
    });

    /**
     * A selector entry with an empty label is unclickable. Falling back to the
     * id is ugly and deliberate: the provider can still pick the right row by
     * elimination, which beats a blank line he cannot act on at all.
     */
    it('never returns an empty label', async () => {
        const { service } = buildSelector([
            { id: HOST_ID, displayName: null, firstName: null, lastName: null }
        ]);

        const result = await service.listLinkedHosts({ hostTradeId: HT_ID }, actorOf(OWNER_ID));

        expect(result.data?.hosts[0]?.displayName).toBe(HOST_ID);
    });

    /**
     * THE PRIVACY BOUNDARY. The selector may say who, never how to reach them:
     * "already served" is not consent to hand over a stored address, and an
     * email in this payload turns a dropdown into a contact-list export.
     */
    it('never leaks an email, even when the row carries one', async () => {
        const { service } = buildSelector([
            {
                id: HOST_ID,
                displayName: 'Casa del Río',
                firstName: null,
                lastName: null,
                email: 'ana@example.com'
            }
        ]);

        const result = await service.listLinkedHosts({ hostTradeId: HT_ID }, actorOf(OWNER_ID));

        expect(JSON.stringify(result.data?.hosts)).not.toContain('ana@example.com');
        expect(result.data?.hosts[0]).not.toHaveProperty('email');
    });
});
