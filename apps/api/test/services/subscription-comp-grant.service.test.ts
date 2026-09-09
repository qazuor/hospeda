/**
 * Unit tests for subscription-comp-grant.service.ts (HOS-1171).
 *
 * `@repo/db` is mocked wholesale by this package's `test/setup.ts`, so
 * assertions about rows that got WRITTEN would be vacuous. What is checkable
 * from call order and arguments alone is the thing with money attached:
 *
 *   **The MercadoPago preapproval is hard-cancelled BEFORE any comp exists, and
 *   a refusal stops the grant entirely.**
 *
 * `hardCancelPreapprovalBestEffort` never throws. Its `failed` outcome is
 * returned, not raised, so a caller that ignores it produces precisely the bug
 * this service exists to prevent: MercadoPago says no, nothing throws, and a
 * customer is declared free while their card keeps being charged. That is the
 * HOS-751 failure mode, which has happened in this repo already.
 *
 * These tests are what make ignoring the outcome fail. Mutating the
 * `providerRefused` predicate away turns the `PROVIDER_ERROR` cases below red —
 * including the `adapter-unavailable` pair, which is the half that branching on
 * the outcome's `kind` alone silently gets wrong.
 *
 * The second suite covers the other way this service can leave a preapproval
 * charging: `billing_subscriptions.status` holds two vocabularies, and deciding
 * what to supersede by matching the raw column against Hospeda's enum misses
 * `incomplete` and `unpaid` entirely.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hardCancelMock = vi.fn();
const createCompMock = vi.fn();
const notifyMock = vi.fn();
const reconcileMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();
const clearCacheMock = vi.fn();
const retrieveMock = vi.fn();

/** Every non-deleted subscription row the customer has, statuses RAW. */
let allRows: Array<Record<string, unknown>> = [];
/** `billing_subscription_events` rows an EARLIER attempt of this grant wrote. */
let priorEvents: Array<Record<string, unknown>> = [];
const callOrder: string[] = [];

vi.mock('../../src/services/billing/preapproval-hard-cancel.js', () => ({
    hardCancelPreapprovalBestEffort: (...args: unknown[]) => {
        callOrder.push('mp-hard-cancel');
        return hardCancelMock(...args);
    }
}));

vi.mock('../../src/services/subscription-comp-create.service.js', () => ({
    createCompSubscription: (...args: unknown[]) => {
        callOrder.push('create-comp');
        return createCompMock(...args);
    }
}));

vi.mock('../../src/services/comp-notifications.service.js', () => ({
    sendCompGrantedNotification: (...args: unknown[]) => {
        callOrder.push('notify');
        return notifyMock(...args);
    }
}));

vi.mock('../../src/services/subscription-linked-entities.service.js', () => ({
    reconcileSubscriptionLinkedEntities: (...args: unknown[]) => {
        callOrder.push('reconcile');
        return reconcileMock(...args);
    }
}));

/**
 * One fake client, used both as `getDb()` and as the `tx` handed to the
 * `withTransaction` callbacks. The service's atomicity boundaries are per-row
 * and per-comp rather than global (ADR-019: no transaction may be held across
 * the MercadoPago call), and this stub deliberately does NOT simulate rollback —
 * what these tests check is call ORDER and what was written, which is what the
 * `@repo/db` global mock leaves observable.
 */
function makeFakeDb() {
    return {
        // Two different SELECTs run through here: the customer's subscriptions
        // and the audit events an earlier attempt wrote. They are told apart by
        // the projection — only the events query asks for `metadata` — because
        // the table objects are themselves stubs and comparing them by identity
        // would couple this to the shape of the `@repo/db` mock below.
        select: (projection?: Record<string, unknown>) => ({
            from: () => ({
                where: async () => (projection && 'metadata' in projection ? priorEvents : allRows)
            })
        }),
        update: () => ({
            set: (values: unknown) => ({
                where: async () => {
                    callOrder.push('local-write');
                    return updateMock(values);
                }
            })
        }),
        insert: () => ({
            values: async (values: unknown) => {
                callOrder.push('audit');
                return insertMock(values);
            }
        })
    };
}

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: () => ({
        getPaymentAdapter: () => ({
            subscriptions: { retrieve: (...args: unknown[]) => retrieveMock(...args) }
        })
    })
}));

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: (...args: unknown[]) => {
        callOrder.push('cache-clear');
        return clearCacheMock(...args);
    }
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@repo/db');
    return {
        ...actual,
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id',
            status: 'status',
            deletedAt: 'deleted_at',
            mpSubscriptionId: 'mp_subscription_id'
        },
        billingSubscriptionEvents: {
            subscriptionId: 'subscription_id',
            eventType: 'event_type',
            triggerSource: 'trigger_source',
            metadata: 'metadata'
        },
        and: vi.fn(() => 'and'),
        eq: vi.fn(() => 'eq'),
        inArray: vi.fn(() => 'inArray'),
        isNull: vi.fn(() => 'isNull'),
        withTransaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(makeFakeDb()),
        getDb: () => makeFakeDb()
    };
});

const { grantCompSubscription } = await import(
    '../../src/services/subscription-comp-grant.service.js'
);

const GRANT = {
    customerId: 'cus-1',
    planId: 'plan-1',
    interval: 'monthly' as const,
    livemode: true,
    actorId: 'admin-1'
};

/** A subscription MercadoPago is actively charging. */
function payingSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub-1',
        status: 'active',
        mpSubscriptionId: 'mp-preapproval-1',
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    allRows = [];
    priorEvents = [];
    retrieveMock.mockResolvedValue({ status: 'authorized' });
    hardCancelMock.mockResolvedValue({ kind: 'cancelled' });
    createCompMock.mockResolvedValue({ localSubscriptionId: 'comp-sub-1' });
    notifyMock.mockResolvedValue(undefined);
    reconcileMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue(undefined);
    insertMock.mockResolvedValue(undefined);
});

describe('grantCompSubscription — the preapproval is closed before the comp exists', () => {
    it('hard-cancels the live preapproval BEFORE creating the comp subscription', async () => {
        allRows = [payingSubscription()];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(hardCancelMock).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: 'sub-1',
                mpSubscriptionId: 'mp-preapproval-1',
                source: 'admin-comp-grant'
            })
        );
        // Ordering, not merely "both happened": a comp created first would exist
        // for however long the provider call takes, on a live preapproval.
        expect(callOrder.indexOf('mp-hard-cancel')).toBeLessThan(callOrder.indexOf('create-comp'));
    });

    it('nulls mp_subscription_id on the superseded row', async () => {
        allRows = [payingSubscription()];

        await grantCompSubscription(GRANT);

        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'cancelled', mpSubscriptionId: null })
        );
    });

    it('HOS-1280 REGRESSION: calls the bridge for EACH superseded row, not only for the new comp row', async () => {
        // Before HOS-1280 the bridge was called exactly once per grant — for
        // `localSubscriptionId` (the new comp row) — regardless of how many
        // rows the loop above superseded. A superseded row's OWN commerce
        // listing link never got reconciled, so a comm listing linked to a
        // superseded subscription stayed PUBLIC forever even though that
        // subscription is now CANCELLED and its preapproval closed.
        allRows = [
            payingSubscription({ id: 'sub-1', mpSubscriptionId: 'mp-preapproval-1' }),
            payingSubscription({ id: 'sub-2', mpSubscriptionId: 'mp-preapproval-2' })
        ];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(reconcileMock).toHaveBeenCalledTimes(3);
        expect(reconcileMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ subscriptionId: 'sub-1', subscriptionStatus: 'cancelled' })
        );
        expect(reconcileMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ subscriptionId: 'sub-2', subscriptionStatus: 'cancelled' })
        );
        expect(reconcileMock).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({ subscriptionId: 'comp-sub-1', subscriptionStatus: 'comp' })
        );

        // The two per-row reconciles happen INSIDE the supersede loop, before
        // the comp row is even created; the third happens after the comp row
        // is created and the cache is cleared (step 6, pre-existing behavior).
        const reconcileIndices = callOrder.reduce<number[]>((acc, v, i) => {
            if (v === 'reconcile') {
                acc.push(i);
            }
            return acc;
        }, []);
        expect(reconcileIndices).toHaveLength(3);
        const createComp = callOrder.indexOf('create-comp');
        const cacheClear = callOrder.indexOf('cache-clear');
        expect(reconcileIndices[0]).toBeLessThan(createComp);
        expect(reconcileIndices[1]).toBeLessThan(createComp);
        expect(reconcileIndices[2]).toBeGreaterThan(cacheClear);
    });

    it('REGRESSION: no comp is granted while any preapproval survives', async () => {
        // The invariant in one assertion. Two rows, the second one refused by
        // MercadoPago: if the service ignored the `failed` outcome — which
        // `hardCancelPreapprovalBestEffort` returns rather than throwing — the
        // customer would end up comped with `mp-preapproval-2` still authorized
        // and still charging.
        allRows = [
            payingSubscription({ id: 'sub-1', mpSubscriptionId: 'mp-preapproval-1' }),
            payingSubscription({ id: 'sub-2', mpSubscriptionId: 'mp-preapproval-2' })
        ];
        hardCancelMock
            .mockResolvedValueOnce({ kind: 'cancelled' })
            .mockResolvedValueOnce({ kind: 'failed', error: 'MP 400 preapproval not cancellable' });

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('PROVIDER_ERROR');
        // `create-comp` absent from the call order is the assertion that "no comp
        // subscription coexists with a live preapproval" is true by construction
        // rather than by luck.
        expect(callOrder).not.toContain('create-comp');
        expect(createCompMock).not.toHaveBeenCalled();
        expect(callOrder).not.toContain('notify');
        // sub-1's retirement DID land, and that is intended, not a leak. Each row
        // is closed at MercadoPago and retired locally before the next is touched,
        // so every write that exists has its preapproval already closed. Batching
        // the writes until the end would leave a crash in between with
        // preapprovals cancelled at the provider and rows still `active` here —
        // the unresumable arrangement.
        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'cancelled', mpSubscriptionId: null })
        );
    });

    it('a refusal on the ONLY subscription aborts, and writes nothing', async () => {
        allRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'failed', error: 'MP 500' });

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('PROVIDER_ERROR');
        expect(createCompMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
        expect(insertMock).not.toHaveBeenCalled();
    });

    it("proceeds on skipped:'no-preapproval', which is a clean no-op", async () => {
        // Treating it like `failed` would make a comp ungrantable for the most
        // ordinary customer there is: one who never subscribed.
        allRows = [payingSubscription({ mpSubscriptionId: null })];
        hardCancelMock.mockResolvedValue({ kind: 'skipped', reason: 'no-preapproval' });

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(createCompMock).toHaveBeenCalledOnce();
    });

    it("ABORTS on skipped:'adapter-unavailable' — it is not a no-op", async () => {
        // The two `skipped` reasons are not the same event, and branching on the
        // `kind` alone silently equates them. `no-preapproval` means there is
        // nothing to cancel; `adapter-unavailable` means we never reached
        // MercadoPago, so the preapproval named on the row may be very much alive.
        allRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'skipped', reason: 'adapter-unavailable' });

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('PROVIDER_ERROR');
        expect(createCompMock).not.toHaveBeenCalled();
    });

    it('does NOT null mp_subscription_id when the adapter was unavailable', async () => {
        // The sharper half of the same bug. Proceeding would run the supersede
        // write, and that write nulls `mp_subscription_id` — the only pointer
        // anyone has to find the orphaned preapproval afterwards. A live
        // preapproval with no local reference to it is the worst reachable state.
        allRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'skipped', reason: 'adapter-unavailable' });

        await grantCompSubscription(GRANT);

        expect(updateMock).not.toHaveBeenCalled();
        expect(callOrder).not.toContain('local-write');
    });
});

/**
 * A subscription an earlier attempt already retired: `cancelled`, its
 * `mp_subscription_id` nulled. Not supersedable any more, which is the whole
 * point — the loop that sets `hadActiveBilling` will not run for it.
 */
function retiredSubscription(overrides: Record<string, unknown> = {}) {
    return { id: 'sub-1', status: 'cancelled', mpSubscriptionId: null, ...overrides };
}

/** The audit row that retirement wrote. */
function supersessionEvent(overrides: Record<string, unknown> = {}) {
    return {
        subscriptionId: 'sub-1',
        metadata: {
            actorId: 'admin-1',
            reason: 'superseded-by-comp-grant',
            mpSubscriptionId: 'mp-preapproval-1',
            preapprovalCancelled: true
        },
        ...overrides
    };
}

describe('grantCompSubscription — resuming after a partial failure', () => {
    // The sequence: a customer with a live subscription, an operator who names
    // the wrong plan. Attempt 1 hard-cancels the preapproval AND retires the
    // row, then `createCompSubscription` throws INVALID_PLAN. The operator
    // corrects the plan and retries — and now nothing is supersedable, so a
    // `hadActiveBilling` derived only from this run reports `false` for a
    // customer whose preapproval THIS grant cancelled minutes ago. That is the
    // "you never gave us a card" email again, arriving from the opposite side
    // of the `??` that was supposed to prevent it.

    it('reports hadActiveBilling from the earlier attempt, not from this empty loop', async () => {
        allRows = [retiredSubscription()];
        priorEvents = [supersessionEvent()];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        // The loop genuinely did not run — that is the premise, not a bug.
        expect(hardCancelMock).not.toHaveBeenCalled();
        expect(result.success === true && result.data.hadActiveBilling).toBe(true);
        expect(notifyMock).toHaveBeenCalledWith({
            subscriptionId: 'comp-sub-1',
            hadActiveBilling: true
        });
    });

    it('reports what the earlier attempt superseded, so the audit row is not empty', async () => {
        allRows = [retiredSubscription()];
        priorEvents = [supersessionEvent()];

        const result = await grantCompSubscription(GRANT);

        expect(result.success === true && result.data.supersededSubscriptionIds).toEqual(['sub-1']);
        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    supersededSubscriptionIds: ['sub-1'],
                    hadActiveBilling: true
                })
            })
        );
    });

    it('still says false when the earlier attempt cancelled no preapproval', async () => {
        // A row retired without a preapproval behind it. The seed must carry the
        // real answer across attempts, not merely default to `true` because a
        // supersession happened at all.
        allRows = [retiredSubscription()];
        priorEvents = [
            supersessionEvent({
                metadata: {
                    reason: 'superseded-by-comp-grant',
                    mpSubscriptionId: null,
                    preapprovalCancelled: false
                }
            })
        ];

        const result = await grantCompSubscription(GRANT);

        expect(result.success === true && result.data.hadActiveBilling).toBe(false);
    });

    it('ignores audit rows from other flows that cancelled the same subscription', async () => {
        // `ADMIN_SUBSCRIPTION_CANCELLED` is written by more than this service.
        // Only rows carrying THIS grant's reason may seed the flag; anything
        // else would let an ordinary admin cancellation claim a comp cancelled
        // the customer's card.
        allRows = [retiredSubscription()];
        priorEvents = [
            supersessionEvent({ metadata: { reason: 'admin-cancel', preapprovalCancelled: true } })
        ];

        const result = await grantCompSubscription(GRANT);

        expect(result.success === true && result.data.hadActiveBilling).toBe(false);
        expect(result.success === true && result.data.supersededSubscriptionIds).toEqual([]);
    });

    it('records preapprovalCancelled on the audit row it writes, for the NEXT attempt', async () => {
        // The write side of the same contract. Without this field the read above
        // has nothing to recover.
        allRows = [payingSubscription()];

        await grantCompSubscription(GRANT);

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    reason: 'superseded-by-comp-grant',
                    preapprovalCancelled: true
                })
            })
        );
    });
});

describe('grantCompSubscription — a refusal is not proof the preapproval is open', () => {
    // The in-flight row: a previous attempt cancelled the preapproval at
    // MercadoPago and died before writing that locally. The retry asks MP to
    // cancel an already-cancelled preapproval; MP treats `cancelled` as terminal
    // and rejects the transition, the helper swallows it into `failed`, and a
    // `failed` aborts. Without re-verification the grant dead-ends for exactly
    // the customer whose preapproval is already closed.

    it('proceeds when MercadoPago confirms the preapproval is already terminal', async () => {
        allRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'failed', error: 'preapproval is terminal' });
        retrieveMock.mockResolvedValue({ status: 'cancelled' });

        const result = await grantCompSubscription(GRANT);

        expect(retrieveMock).toHaveBeenCalledWith('mp-preapproval-1');
        expect(result.success).toBe(true);
        expect(createCompMock).toHaveBeenCalledOnce();
        // It WAS a live preapproval this grant closed, one attempt earlier.
        expect(result.success === true && result.data.hadActiveBilling).toBe(true);
    });

    it('accepts every status on the shared ALLOW-list', async () => {
        // Imported from `reactivation-supersession-complete.ts` rather than
        // re-declared, so the two provider-verify paths cannot drift.
        for (const status of ['canceled', 'cancelled', 'finished', 'expired']) {
            vi.clearAllMocks();
            allRows = [payingSubscription()];
            createCompMock.mockResolvedValue({ localSubscriptionId: 'comp-sub-1' });
            hardCancelMock.mockResolvedValue({ kind: 'failed', error: 'terminal' });
            retrieveMock.mockResolvedValue({ status });

            const result = await grantCompSubscription(GRANT);

            expect(result.success, `status ${status} should be accepted`).toBe(true);
        }
    });

    it('still aborts when MercadoPago reports the preapproval as merely paused', async () => {
        // `paused` is deliberately absent from the ALLOW-list: a paused
        // preapproval can still resume charging.
        allRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'failed', error: 'refused' });
        retrieveMock.mockResolvedValue({ status: 'paused' });

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('PROVIDER_ERROR');
        expect(createCompMock).not.toHaveBeenCalled();
    });

    it('still aborts when the provider read itself fails', async () => {
        allRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'failed', error: 'refused' });
        retrieveMock.mockRejectedValue(new Error('MP 503'));

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(createCompMock).not.toHaveBeenCalled();
    });

    it("does NOT re-verify on skipped:'adapter-unavailable'", async () => {
        // There is no adapter to ask, and inventing an affirmative answer there
        // is the fail-open the whole branch exists to prevent.
        allRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'skipped', reason: 'adapter-unavailable' });

        const result = await grantCompSubscription(GRANT);

        expect(retrieveMock).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
    });
});

describe('grantCompSubscription — the status column holds two vocabularies', () => {
    // `billing_subscriptions.status` carries Hospeda's enum AND qzpay's, and
    // `incomplete`/`unpaid` are not members of the Hospeda enum at all. Matching
    // the raw column against enum values — which is what an `inArray(...)` in SQL
    // does — skips exactly those rows, and a skipped row is a preapproval left
    // charging a customer we just declared free.
    it.each([
        ['incomplete', 'qzpay writes this at creation of every recurring subscription'],
        ['unpaid', 'qzpay writes this when a recurring charge fails'],
        ['past_due', 'Hospeda vocabulary, shares a normalized value with `unpaid`'],
        ['pending_provider', 'Hospeda-only value, outside qzpay entirely'],
        ['courtesy', 'a PAUSED preapproval a cron is expected to resume at full price'],
        ['paused', 'a pause is not a cancel: the preapproval is intact']
    ])('supersedes a subscription stored as %s (%s)', async (status) => {
        allRows = [payingSubscription({ status })];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(hardCancelMock).toHaveBeenCalledWith(
            expect.objectContaining({ mpSubscriptionId: 'mp-preapproval-1' })
        );
        expect(result.success === true && result.data.supersededSubscriptionIds).toEqual(['sub-1']);
    });

    it.each([
        ['cancelled', 'Hospeda spelling, terminal'],
        ['canceled', 'qzpay spelling with one L, same terminal state'],
        ['expired', 'terminal'],
        ['abandoned', 'terminal'],
        ['incomplete_expired', 'qzpay vocabulary, normalizes to abandoned']
    ])('leaves a subscription stored as %s alone (%s)', async (status) => {
        allRows = [payingSubscription({ status })];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(hardCancelMock).not.toHaveBeenCalled();
        expect(result.success === true && result.data.supersededSubscriptionIds).toEqual([]);
    });

    it('supersedes a status nobody recognises, rather than skipping it', async () => {
        // Fail-closed on the unknown. Of the two ways to be wrong, cancelling a
        // preapproval we did not fully understand is recoverable; leaving one
        // charging is the bug this service exists to prevent. This also covers the
        // status somebody adds to the enum next year without reading this file.
        allRows = [payingSubscription({ status: 'some_future_status' })];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(hardCancelMock).toHaveBeenCalledOnce();
    });
});

describe('grantCompSubscription — one comp per customer', () => {
    it('refuses a second grant instead of creating a duplicate', async () => {
        // Two comp rows leave `loadEntitlements`'s `.find()` picking whichever the
        // driver returns first, so a duplicate does not merely waste a row — it
        // decides the customer's plan by accident.
        allRows = [{ id: 'comp-existing', status: 'comp', mpSubscriptionId: null }];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('ALREADY_COMPED');
        expect(result.success === false && result.error.message).toContain('comp-existing');
        expect(createCompMock).not.toHaveBeenCalled();
        expect(hardCancelMock).not.toHaveBeenCalled();
    });

    it('refuses before touching MercadoPago, so a double click cancels nothing twice', async () => {
        allRows = [
            { id: 'comp-existing', status: 'comp', mpSubscriptionId: null },
            payingSubscription({ id: 'sub-1' })
        ];

        await grantCompSubscription(GRANT);

        expect(hardCancelMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
    });
});

describe('grantCompSubscription — domain isolation (HOS-1277)', () => {
    it('REGRESSION: does not hard-cancel a dual-owner’s OTHER vertical subscription', async () => {
        // The dual-owner case this bug hit in production: comping the customer's
        // accommodation plan used to hard-cancel EVERY supersedable row on the
        // customer, including a live gastronomy subscription that has nothing to
        // do with this grant — `createCompSubscription` only ever comps
        // accommodation plans, so a gastronomy row should never even be examined.
        allRows = [
            payingSubscription({
                id: 'sub-accommodation',
                mpSubscriptionId: 'mp-accommodation',
                productDomain: 'accommodation'
            }),
            payingSubscription({
                id: 'sub-gastronomy',
                mpSubscriptionId: 'mp-gastronomy',
                productDomain: 'gastronomy'
            })
        ];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        // Only the accommodation row was ever handed to the hard-cancel step.
        expect(hardCancelMock).toHaveBeenCalledTimes(1);
        expect(hardCancelMock).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: 'sub-accommodation' })
        );
        expect(hardCancelMock).not.toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: 'sub-gastronomy' })
        );
        // The gastronomy row is untouched: not superseded, not written.
        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(result.success && result.data.supersededSubscriptionIds).toEqual([
            'sub-accommodation'
        ]);
    });

    it('a legacy row with no productDomain still counts as accommodation (fail-open)', async () => {
        // `productDomain` post-dates most rows — omitting it must not exempt a
        // real accommodation subscription from being superseded, or a comp grant
        // would leave the customer's old preapproval charging forever.
        allRows = [payingSubscription({ productDomain: undefined })];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(hardCancelMock).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: 'sub-1' })
        );
    });

    it('a PARTNER subscription is excluded exactly like a gastronomy one', async () => {
        allRows = [
            payingSubscription({
                id: 'sub-partner',
                mpSubscriptionId: 'mp-partner',
                productDomain: 'partner'
            })
        ];

        const result = await grantCompSubscription(GRANT);

        // No accommodation row at all: nothing to supersede, comp still grants.
        expect(result.success).toBe(true);
        expect(hardCancelMock).not.toHaveBeenCalled();
        expect(result.success && result.data.supersededSubscriptionIds).toEqual([]);
    });
});

describe('grantCompSubscription — what the customer is told', () => {
    it('reports hadActiveBilling only when a preapproval was really cancelled', async () => {
        allRows = [payingSubscription()];

        const result = await grantCompSubscription(GRANT);

        expect(result.success === true && result.data.hadActiveBilling).toBe(true);
        expect(notifyMock).toHaveBeenCalledWith({
            subscriptionId: 'comp-sub-1',
            hadActiveBilling: true
        });
    });

    it('reports hadActiveBilling false for a customer who was never subscribed', async () => {
        allRows = [];

        const result = await grantCompSubscription(GRANT);

        expect(result.success === true && result.data.hadActiveBilling).toBe(false);
        expect(notifyMock).toHaveBeenCalledWith({
            subscriptionId: 'comp-sub-1',
            hadActiveBilling: false
        });
    });

    it('a failed email does NOT undo the grant', async () => {
        // The opposite criterion from the hard-cancel above, on purpose: a mail
        // failure must not reverse something MercadoPago and the database have
        // both already accepted.
        allRows = [];
        notifyMock.mockRejectedValue(new Error('brevo down'));

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(result.success === true && result.data.subscriptionId).toBe('comp-sub-1');
    });
});

describe('grantCompSubscription — the entitlement cache is cleared here, and last', () => {
    it('clears the cache for the customer after the comp is created', async () => {
        // INV-1: a comp fires no webhook, so nothing else will ever invalidate.
        // `createCompSubscription` clears too, but it is now handed THIS
        // transaction, so its clear runs before the outer commit — early enough
        // to repopulate from the pre-commit picture and pin the stale answer for
        // the full TTL. This call is the one that happens after.
        allRows = [payingSubscription()];

        await grantCompSubscription(GRANT);

        expect(clearCacheMock).toHaveBeenCalledWith('cus-1');
        expect(callOrder.indexOf('create-comp')).toBeLessThan(callOrder.indexOf('cache-clear'));
    });

    it('clears the cache after the supersede writes too, not only the insert', async () => {
        // The superseded rows change status from entitlement-granting to
        // `cancelled`, and `createCompSubscription` knows nothing about them.
        allRows = [payingSubscription()];

        await grantCompSubscription(GRANT);

        expect(callOrder.lastIndexOf('local-write')).toBeLessThan(callOrder.indexOf('cache-clear'));
    });

    it('does not clear the cache when the grant was refused', async () => {
        allRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'failed', error: 'MP 500' });

        await grantCompSubscription(GRANT);

        expect(clearCacheMock).not.toHaveBeenCalled();
    });
});

describe('grantCompSubscription — plan refusals keep their meaning', () => {
    it('maps a non-accommodation plan to INVALID_PLAN', async () => {
        createCompMock.mockRejectedValue(
            new Error(
                "createCompSubscription: plan 'plan-1' is domain 'gastronomy' — only accommodation plans can be comped"
            )
        );

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('INVALID_PLAN');
    });

    it('maps an unknown plan to NOT_FOUND', async () => {
        createCompMock.mockRejectedValue(new Error("Plan 'plan-1' not found"));

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('NOT_FOUND');
    });
});
