/**
 * HOS-1012 T-008 — `startLocalTrial` / `onTrialStarted` on the publish deps.
 *
 * These are the two callbacks that give publishing its clock back. What they do
 * matters less than what they must NOT do, so the assertions below are mostly
 * about absences:
 *
 *  - every read and the insert use the CALLER'S transaction client, never a
 *    pooled one — the trial has to roll back with the publish (G-2);
 *  - no external call happens (there is nothing to call: MercadoPago is never
 *    told a trial exists), so the deleted 8s timeout and the compensating
 *    `cancelTrial` stay deleted;
 *  - `null` is returned rather than a half-made trial whenever the trial cannot
 *    be created, because `publish()` turns `null` into a rejection and a
 *    listing must never go live without a clock;
 *  - the entitlement cache is cleared by `onTrialStarted` and NOT by the
 *    creator, because the creator runs before the commit (INV-1);
 *  - `onTrialStarted` also re-points the SHARED `entity_subscriptions` cache
 *    through the reconcile bridge (HOS-1336): a trial has no provider object,
 *    so no webhook will ever do it, and the 6-hourly reconcile cron may have
 *    cached a negative row over the owner's draft before they subscribed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const fixtures = vi.hoisted(() => ({
    customers: [] as Row[],
    plans: [] as Row[]
}));

const mocks = vi.hoisted(() => ({
    createTrialSubscription: vi.fn(),
    clearEntitlementCache: vi.fn(),
    reconcileSubscriptionLinkedEntities: vi.fn(),
    resolveTrialEligibility: vi.fn()
}));

/** Set when anything reaches for the POOLED client instead of the transaction. */
const pooled = vi.hoisted(() => ({ used: false }));

/**
 * Stands in for the publish transaction's Drizzle client, and really answers
 * queries from the fixtures — every read this module performs must go through
 * THIS client. A read issued through `getDb()` would see rows outside the
 * publish transaction's snapshot, which is what `pooled.used` detects.
 *
 * Which fixture table a query hits is discriminated by the shape of the table
 * object the mocked `@repo/db` exports (`externalId` only exists on customers),
 * because the identity of those objects is not reachable from out here.
 */
const TX = vi.hoisted(() => {
    return {
        select: () => {
            let rows: Record<string, unknown>[] = [];
            const builder = {
                from(table: Record<string, unknown>) {
                    rows = 'externalId' in table ? [...fixtures.customers] : [...fixtures.plans];
                    return builder;
                },
                where() {
                    return builder;
                },
                orderBy() {
                    return builder;
                },
                limit(count: number) {
                    return Promise.resolve(rows.slice(0, count));
                }
            };
            return builder;
        }
    };
});

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;

    const billingCustomers = { id: 'id', externalId: 'externalId' } as const;
    const billingPlans = { id: 'id', name: 'name' } as const;
    const billingSubscriptions = {} as const;

    return {
        ...base,
        and: (...c: unknown[]) => c,
        billingCustomers,
        billingPlans,
        billingSubscriptions,
        desc: (c: unknown) => c,
        eq: (c: unknown, v: unknown) => [c, v],
        isNull: (c: unknown) => c,
        getDb: () => {
            pooled.used = true;
            return TX;
        }
    };
});

vi.mock('../../src/services/subscription-trial-create.service', () => ({
    createTrialSubscription: mocks.createTrialSubscription
}));

vi.mock('../../src/services/billing/trial-eligibility.service', () => ({
    resolveTrialEligibility: mocks.resolveTrialEligibility
}));

vi.mock('../../src/services/subscription-linked-entities.service', () => ({
    reconcileSubscriptionLinkedEntities: mocks.reconcileSubscriptionLinkedEntities
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mocks.clearEntitlementCache
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_MERCADO_PAGO_SANDBOX: true }
}));

import { buildAccommodationPublishDeps } from '../../src/services/accommodation-publish-deps';

const OWNER_ID = 'owner-1012';
const CUSTOMER_ID = 'cus-1012';
const PLAN_ID = '11111111-2222-3333-4444-555555555555';
const TRIAL_END = new Date('2026-10-01T00:00:00.000Z');

/** A billing client that is merely non-null — never called on these paths. */
const getBillingStub = () => ({}) as never;

/** The transaction context `publish()` hands the callback. */
const txCtx = { tx: TX, hookState: {} } as never;

describe('HOS-1012 — buildAccommodationPublishDeps.startLocalTrial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pooled.used = false;
        fixtures.customers = [{ id: CUSTOMER_ID, externalId: OWNER_ID }];
        // HOS-1012 T-037: the publish path now resolves the vertical's TRIAL
        // plan. This suite's `where()` is a no-op, so the slug here is a label
        // rather than an assertion — `accommodation-publish-trial-plan.test.ts`
        // is the one that captures the predicate.
        fixtures.plans = [{ id: PLAN_ID, name: 'owner-trial' }];
        mocks.createTrialSubscription.mockResolvedValue({
            localSubscriptionId: 'sub-local-1',
            trialStart: new Date('2026-09-01T00:00:00.000Z'),
            trialEnd: TRIAL_END,
            entitlementCacheCleared: false
        });
    });

    it('creates the trial through the caller transaction and returns its identity', async () => {
        const deps = buildAccommodationPublishDeps(getBillingStub);

        const result = await deps.startLocalTrial({ ownerId: OWNER_ID, ctx: txCtx });

        expect(result).toEqual({
            subscriptionId: 'sub-local-1',
            customerId: CUSTOMER_ID,
            trialEnd: TRIAL_END
        });
        expect(mocks.createTrialSubscription).toHaveBeenCalledWith({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            productDomain: 'accommodation',
            // Derived from the sandbox flag, the same single source of truth
            // `middlewares/billing.ts` uses.
            livemode: false,
            tx: TX
        });
        // `trialDays` is deliberately absent: the creator's own default IS
        // OWNER_TRIAL_DAYS, and naming it here would be a second place the
        // accommodation trial length is decided.
        expect(mocks.createTrialSubscription.mock.calls[0]?.[0]).not.toHaveProperty('trialDays');
        // Nothing reached for the pooled client — a read outside the boundary
        // would be reading rows the publish transaction cannot see.
        expect(pooled.used).toBe(false);
    });

    it('does NOT clear the entitlement cache itself (that is post-commit work)', async () => {
        const deps = buildAccommodationPublishDeps(getBillingStub);

        await deps.startLocalTrial({ ownerId: OWNER_ID, ctx: txCtx });

        // Clearing here would publish entitlements for a row the publish
        // transaction can still roll back.
        expect(mocks.clearEntitlementCache).not.toHaveBeenCalled();
    });

    it('returns null and writes nothing when the owner has no billing customer row', async () => {
        fixtures.customers = [];
        const deps = buildAccommodationPublishDeps(getBillingStub);

        const result = await deps.startLocalTrial({ ownerId: OWNER_ID, ctx: txCtx });

        expect(result).toBeNull();
        expect(mocks.createTrialSubscription).not.toHaveBeenCalled();
    });

    it('returns null and writes nothing when the trial plan is missing', async () => {
        fixtures.plans = [];
        const deps = buildAccommodationPublishDeps(getBillingStub);

        const result = await deps.startLocalTrial({ ownerId: OWNER_ID, ctx: txCtx });

        expect(result).toBeNull();
        expect(mocks.createTrialSubscription).not.toHaveBeenCalled();
    });

    it('returns null when billing is disabled', async () => {
        const deps = buildAccommodationPublishDeps(() => null);

        const result = await deps.startLocalTrial({ ownerId: OWNER_ID, ctx: txCtx });

        expect(result).toBeNull();
        expect(mocks.createTrialSubscription).not.toHaveBeenCalled();
    });
});

describe('HOS-1012 — buildAccommodationPublishDeps.onTrialStarted', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clears the entitlement cache for the trial customer (INV-1)', async () => {
        const deps = buildAccommodationPublishDeps(getBillingStub);

        await deps.onTrialStarted({
            subscriptionId: 'sub-local-1',
            customerId: CUSTOMER_ID,
            trialEnd: TRIAL_END
        });

        // A local trial has no preapproval and therefore no webhook: nothing
        // else in the system will ever clear this.
        expect(mocks.clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('HOS-1336: re-points the shared entity_subscriptions cache for the trial', async () => {
        // The bug's timeline, pinned at the seam that broke it. The owner's
        // draft exists when the 6-hourly entity-subscription-cache-reconcile
        // cron ticks, so the cron upserts a negative row (`status='none'`,
        // `subscription_id=NULL`) over it — a correct answer AT THAT MOMENT,
        // since the owner holds no subscription yet. Then they publish, the
        // local trial is inserted, and NO webhook ever fires for it (a trial
        // has no provider object), so nothing but this hook rewrites the row:
        // without this call every owner-gated read keeps answering "no
        // entitlements" for up to 6 hours after the listing went live.
        const deps = buildAccommodationPublishDeps(getBillingStub);

        await deps.onTrialStarted({
            subscriptionId: 'sub-local-1',
            customerId: CUSTOMER_ID,
            trialEnd: TRIAL_END
        });

        expect(mocks.reconcileSubscriptionLinkedEntities).toHaveBeenCalledTimes(1);
        expect(mocks.reconcileSubscriptionLinkedEntities).toHaveBeenCalledWith({
            subscriptionId: 'sub-local-1',
            subscriptionStatus: 'trialing',
            source: 'publish-trial-started'
        });
    });

    it('HOS-1336: clears the in-memory entitlement cache BEFORE the shared-cache write-through', async () => {
        // Ordering is load-bearing: if the bridge call ever throws, the INV-1
        // clear must already have happened. The publish caller catches and the
        // caches self-heal on their own timers (5-minute TTL in memory, the
        // 6-hourly cron for entity_subscriptions) — but only if the clear was
        // not skipped by a failure above it.
        const deps = buildAccommodationPublishDeps(getBillingStub);

        await deps.onTrialStarted({
            subscriptionId: 'sub-local-1',
            customerId: CUSTOMER_ID,
            trialEnd: TRIAL_END
        });

        const clearOrder = mocks.clearEntitlementCache.mock.invocationCallOrder[0];
        const bridgeOrder = mocks.reconcileSubscriptionLinkedEntities.mock.invocationCallOrder[0];
        expect(clearOrder).toBeDefined();
        expect(bridgeOrder).toBeDefined();
        if (clearOrder === undefined || bridgeOrder === undefined) {
            throw new Error('both mocks must have been invoked');
        }
        expect(clearOrder).toBeLessThan(bridgeOrder);
    });
});
