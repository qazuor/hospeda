/**
 * HOS-1012 T-004 — subscription-trial-create.service unit tests.
 *
 * Proves the local trial creator:
 *  - inserts a `status='trialing'` row with NO mp_subscription_id, the requested
 *    product_domain, and a trial window computed from a single clock read.
 *  - enlists in a caller-owned transaction when one is passed, and defers the
 *    entitlement-cache clear to that caller (HOS-1012 G-2 depends on this).
 *  - clears the entitlement cache itself when it owns the transaction (INV-1).
 *  - rejects a plan from a different product domain, and a missing plan.
 *  - treats a NULL plan domain as accommodation (the column post-dates the rows).
 *
 * DB is fully mocked — no real infra. The assertions read the actual values
 * handed to `insert().values()` rather than merely checking the call happened,
 * because "an insert ran" is true for every possible row shape.
 *
 * @module test/services/subscription-trial-create.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const onConflictDoUpdateMock = vi.fn();
const insertValuesMock = vi.fn(() => ({ onConflictDoUpdate: onConflictDoUpdateMock }));

/** Records which table each insert() was called on, in call order. */
const insertTargets: unknown[] = [];

/** The client handed to the withTransaction callback. */
const txStub = {
    insert: vi.fn((table: unknown) => {
        insertTargets.push(table);
        return { values: insertValuesMock };
    })
};

/** Records (callback, existingTx) so a test can assert the tx was threaded. */
const withTransactionMock = vi.fn(
    async (cb: (client: typeof txStub) => Promise<unknown>, _existing?: unknown) => cb(txStub)
);

const selectLimitMock = vi.fn();
const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));

/**
 * The customer's existing `billing_subscriptions` rows, as the HOS-1322
 * duplicate guard reads them. Mutable so a test can seed a live subscription
 * (or one in another vertical) before calling the creator.
 */
let existingSubscriptionRows: Array<Record<string, unknown>> = [];

/**
 * TWO selects share this stub since HOS-1322, and they are told apart by the
 * columns they project rather than by call order — the guard runs before the
 * plan lookup on one path and after it on another, so ordering is not a
 * property a test may rely on.
 *
 *  - the plan-domain lookup projects `{ productDomain }` and ends in `.limit(1)`;
 *  - the duplicate guard's scan projects `status` too and ends at `.where()`.
 */
const selectMock = vi.fn((columns?: Record<string, unknown>) => {
    if (columns !== undefined && 'status' in columns) {
        return {
            from: vi.fn(() => ({
                where: vi.fn(() => Promise.resolve(existingSubscriptionRows))
            }))
        };
    }
    return { from: selectFromMock };
});

vi.mock('@repo/db', () => ({
    billingSubscriptions: {
        __table: 'billing_subscriptions',
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        productDomain: 'product_domain',
        deletedAt: 'deleted_at'
    },
    billingPlans: { id: 'id', productDomain: 'product_domain' },
    entitySubscriptions: {
        __table: 'entity_subscriptions',
        entityType: 'entity_type',
        entityId: 'entity_id'
    },
    and: vi.fn((...parts: unknown[]) => ({ op: 'and', parts })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    getDb: vi.fn(() => ({ select: selectMock })),
    withTransaction: (...args: unknown[]) =>
        (withTransactionMock as (...a: unknown[]) => unknown)(...args)
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    OWNER_TRIAL_DAYS: 30
}));

vi.mock('@repo/schemas', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/schemas')>()),
    // All SIX members. `tourist` arrived with HOS-1233 and `addon` with HOS-847;
    // a mock frozen at four makes the guard's `addon` exemption compare
    // `undefined === undefined` and skip every domain (HOS-1322).
    ProductDomainEnum: {
        ACCOMMODATION: 'accommodation',
        GASTRONOMY: 'gastronomy',
        EXPERIENCE: 'experience',
        PARTNER: 'partner',
        TOURIST: 'tourist',
        ADDON: 'addon'
    }
    // `SubscriptionStatusEnum` is deliberately NOT overridden any more
    // (HOS-1322). It used to be stubbed as `{ TRIALING: 'trialing' }`, and a
    // one-member enum silently defeats `normalizeStoredSubscriptionStatus`,
    // which maps the stored string through it: `isLiveSubscriptionStatus('active')`
    // answered FALSE under that stub, so the duplicate guard found no conflict
    // and every one of its cases would have passed while blocking nothing. The
    // real enum is spread in above.
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const clearEntitlementCacheMock = vi.fn();
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: (...args: unknown[]) => clearEntitlementCacheMock(...args)
}));

// Import after mocks.
import { createTrialSubscription } from '../../src/services/subscription-trial-create.service';

/** A fixed clock so trial-window assertions are exact, not approximate. */
const FIXED_NOW = new Date('2026-09-01T10:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A stand-in for a real Drizzle transaction handle.
 *
 * A transaction is a full client, not an opaque token: the plan lookup runs
 * through it on purpose, so the validation reads the same snapshot the insert
 * will write into. A bare `{}` marker would pass a test the production object
 * cannot, which is the wrong direction for a stub to be wrong in.
 */
function makeCallerTx() {
    return {
        marker: 'caller-tx',
        select: selectMock,
        insert: vi.fn((table: unknown) => {
            insertTargets.push(table);
            return { values: insertValuesMock };
        })
    } as never;
}

/** The row handed to `insert().values()` on the most recent call. */
function insertedRow(): Record<string, unknown> {
    const calls = insertValuesMock.mock.calls as unknown[][];
    return calls[0]?.[0] as Record<string, unknown>;
}

function baseInput() {
    return {
        customerId: 'cust_1',
        planId: 'plan_uuid_1',
        productDomain: 'accommodation' as never,
        livemode: true,
        now: FIXED_NOW
    };
}

describe('createTrialSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        insertTargets.length = 0;
        // Default: an accommodation plan exists.
        selectLimitMock.mockResolvedValue([{ productDomain: 'accommodation' }]);
        // Default: the customer holds no subscription at all (HOS-1322).
        existingSubscriptionRows = [];
    });

    // -----------------------------------------------------------------------
    // HOS-1322 — the duplicate guard, inside the primitive
    // -----------------------------------------------------------------------
    describe('the duplicate guard (HOS-1322)', () => {
        it('refuses a second trial when the customer already holds a live subscription in the SAME domain', async () => {
            existingSubscriptionRows = [
                { id: 'sub_live', status: 'active', productDomain: 'accommodation' }
            ];

            await expect(createTrialSubscription(baseInput())).rejects.toThrow(
                /already have a live 'accommodation' subscription/
            );
            // The refusal has to happen BEFORE the write, or the guard is a log line.
            expect(insertValuesMock).not.toHaveBeenCalled();
        });

        it('still creates the trial when the live subscription is in ANOTHER domain (the dual owner)', async () => {
            // A host who already pays for accommodation and now enters gastronomy.
            // This is the pair that proves the guard filters by DOMAIN: without
            // it, the case above passes just as well with a customer-wide check
            // that blocks this legitimate purchase.
            existingSubscriptionRows = [
                { id: 'sub_accommodation', status: 'active', productDomain: 'accommodation' }
            ];
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await createTrialSubscription({
                ...baseInput(),
                productDomain: 'gastronomy' as never
            });

            expect(insertedRow().productDomain).toBe('gastronomy');
        });

        it('reads a NULL product_domain as accommodation, so a legacy row blocks an accommodation trial', async () => {
            // The asymmetry `subscriptionMatchesDomain` documents: the column
            // post-dates most rows, so accommodation fails OPEN. Inverting it
            // would let every pre-column customer open a second subscription.
            existingSubscriptionRows = [
                { id: 'sub_legacy', status: 'active', productDomain: null }
            ];

            await expect(createTrialSubscription(baseInput())).rejects.toThrow(
                /already have a live 'accommodation' subscription/
            );
        });

        it('does NOT let a legacy NULL-domain row block a gastronomy trial', async () => {
            existingSubscriptionRows = [
                { id: 'sub_legacy', status: 'active', productDomain: null }
            ];
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await createTrialSubscription({
                ...baseInput(),
                productDomain: 'gastronomy' as never
            });

            expect(insertValuesMock).toHaveBeenCalledTimes(1);
        });

        it('ignores a subscription whose status is terminal', async () => {
            existingSubscriptionRows = [
                { id: 'sub_gone', status: 'cancelled', productDomain: 'accommodation' },
                { id: 'sub_gone_2', status: 'expired', productDomain: 'accommodation' }
            ];

            await createTrialSubscription(baseInput());

            expect(insertValuesMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('the inserted row', () => {
        it('carries status trialing and NO mp_subscription_id', async () => {
            await createTrialSubscription(baseInput());

            const row = insertedRow();
            expect(row.status).toBe('trialing');
            // The absence is the point: a NULL provider id is what distinguishes
            // a subscription Hospeda owns from one a provider controls.
            expect(row).not.toHaveProperty('mpSubscriptionId');
            expect(row).not.toHaveProperty('mp_subscription_id');
        });

        it('stamps the requested product domain, not a hardcoded one', async () => {
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await createTrialSubscription({
                ...baseInput(),
                productDomain: 'gastronomy' as never
            });

            expect(insertedRow().productDomain).toBe('gastronomy');
        });

        it('computes trialEnd as trialStart plus the trial length', async () => {
            await createTrialSubscription({ ...baseInput(), trialDays: 30 });

            const row = insertedRow();
            expect(row.trialStart).toEqual(FIXED_NOW);
            expect(row.trialEnd).toEqual(new Date(FIXED_NOW.getTime() + 30 * MS_PER_DAY));
        });

        it('anchors trialEnd to trialStart and never to a second clock read', async () => {
            await createTrialSubscription({ ...baseInput(), trialDays: 7 });

            const row = insertedRow();
            const start = row.trialStart as Date;
            const end = row.trialEnd as Date;
            // Exact, not approximate: any re-read of the clock between the two
            // would make this difference drift off the day boundary.
            expect(end.getTime() - start.getTime()).toBe(7 * MS_PER_DAY);
        });

        it('defaults the trial length to OWNER_TRIAL_DAYS when none is given', async () => {
            await createTrialSubscription(baseInput());

            const row = insertedRow();
            const start = row.trialStart as Date;
            const end = row.trialEnd as Date;
            expect(end.getTime() - start.getTime()).toBe(30 * MS_PER_DAY);
        });

        it('makes the trial window the current billing period', async () => {
            await createTrialSubscription({ ...baseInput(), trialDays: 30 });

            const row = insertedRow();
            // currentPeriodEnd is NOT NULL in the qzpay schema. Pointing it at
            // trialEnd keeps every `now < currentPeriodEnd` consumer agreeing
            // with the trial window instead of disagreeing with it.
            expect(row.currentPeriodStart).toEqual(row.trialStart);
            expect(row.currentPeriodEnd).toEqual(row.trialEnd);
        });
    });

    describe('transaction enlistment (what G-2 depends on)', () => {
        it('threads a caller-owned transaction through to withTransaction', async () => {
            const callerTx = makeCallerTx();

            await createTrialSubscription({ ...baseInput(), tx: callerTx });

            // The second argument is what makes withTransaction reuse the
            // caller's transaction instead of opening a nested one.
            expect(withTransactionMock.mock.calls[0]?.[1]).toBe(callerTx);
        });

        it('does NOT clear the entitlement cache inside a caller-owned transaction', async () => {
            const result = await createTrialSubscription({
                ...baseInput(),
                tx: makeCallerTx()
            });

            // Clearing before the caller commits would publish entitlements for
            // a row that can still be rolled back.
            expect(clearEntitlementCacheMock).not.toHaveBeenCalled();
            expect(result.entitlementCacheCleared).toBe(false);
        });

        it('clears the entitlement cache itself when it owns the transaction', async () => {
            const result = await createTrialSubscription(baseInput());

            // INV-1: a local trial has no preapproval and therefore no webhook,
            // so nothing else will ever clear this customer's cache.
            expect(clearEntitlementCacheMock).toHaveBeenCalledWith('cust_1');
            expect(result.entitlementCacheCleared).toBe(true);
        });
    });

    describe('plan validation', () => {
        it('rejects a plan that does not exist', async () => {
            selectLimitMock.mockResolvedValue([]);

            await expect(createTrialSubscription(baseInput())).rejects.toThrow(/not found/);
            expect(insertValuesMock).not.toHaveBeenCalled();
        });

        it('rejects a plan from a different product domain', async () => {
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await expect(
                createTrialSubscription({
                    ...baseInput(),
                    productDomain: 'accommodation' as never
                })
            ).rejects.toThrow(/gastronomy/);
            expect(insertValuesMock).not.toHaveBeenCalled();
        });

        it('treats a NULL plan domain as accommodation', async () => {
            // The column post-dates most rows, so accommodation fails open —
            // the same asymmetry subscriptionMatchesDomain() applies.
            selectLimitMock.mockResolvedValue([{ productDomain: null }]);

            await expect(
                createTrialSubscription({
                    ...baseInput(),
                    productDomain: 'accommodation' as never
                })
            ).resolves.toMatchObject({ entitlementCacheCleared: true });
        });

        it('does NOT let a NULL plan domain back a non-accommodation trial', async () => {
            // Fails closed in the other direction: a legacy plan cannot silently
            // become a gastronomy plan just because its column is empty.
            selectLimitMock.mockResolvedValue([{ productDomain: null }]);

            await expect(
                createTrialSubscription({
                    ...baseInput(),
                    productDomain: 'gastronomy' as never
                })
            ).rejects.toThrow(/accommodation/);
        });
    });

    describe('trial length validation', () => {
        it.each([0, -1, 1.5, Number.NaN])('rejects trialDays = %s', async (trialDays) => {
            await expect(createTrialSubscription({ ...baseInput(), trialDays })).rejects.toThrow(
                /positive integer/
            );
            expect(insertValuesMock).not.toHaveBeenCalled();
        });
    });

    describe('entity attachment inside the transaction (HOS-1338)', () => {
        it('upserts entity_subscriptions inside the SAME transaction as the subscription insert', async () => {
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await createTrialSubscription({
                ...baseInput(),
                productDomain: 'gastronomy' as never,
                attachEntity: { entityType: 'gastronomy', entityId: 'listing-42' }
            });

            // Two inserts inside the same transaction: billingSubscriptions first,
            // entitySubscriptions second. If the second fails, the first rolls back.
            expect(insertTargets).toHaveLength(2);
            expect(insertTargets[0]).toHaveProperty('__table', 'billing_subscriptions');
            expect(insertTargets[1]).toHaveProperty('__table', 'entity_subscriptions');

            // The second call's values carry the entity coordinates.
            const calls = insertValuesMock.mock.calls as unknown[][];
            const entityRow = calls[1]?.[0] as Record<string, unknown>;
            expect(entityRow.subscriptionId).toBeDefined();
            expect(entityRow.entityType).toBe('gastronomy');
            expect(entityRow.entityId).toBe('listing-42');
            expect(entityRow.status).toBe('trialing');
            expect(entityRow.productDomain).toBe('gastronomy');
        });

        it('does NOT upsert entity_subscriptions when attachEntity is absent', async () => {
            await createTrialSubscription(baseInput());

            expect(insertTargets).toHaveLength(1);
            expect(insertTargets[0]).toHaveProperty('__table', 'billing_subscriptions');
        });

        it('upserts entity_subscriptions for the EXPERIENCE vertical too', async () => {
            selectLimitMock.mockResolvedValue([{ productDomain: 'experience' }]);

            await createTrialSubscription({
                ...baseInput(),
                productDomain: 'experience' as never,
                attachEntity: { entityType: 'experience', entityId: 'exp-1' }
            });

            expect(insertTargets).toHaveLength(2);
            const calls2 = insertValuesMock.mock.calls as unknown[][];
            const entityRow = calls2[1]?.[0] as Record<string, unknown>;
            expect(entityRow.entityType).toBe('experience');
            expect(entityRow.entityId).toBe('exp-1');
        });
    });
});
