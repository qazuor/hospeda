/**
 * HOS-1084 — the backstop cron for the accommodation subscription-status cache.
 *
 * The write-through path keeps the cache correct in the normal case; this job is
 * what makes a desync self-healing rather than permanent. A stale row is not
 * visible as an error — a listing that has silently lost its premium fields
 * looks exactly like a listing that never had them — so the properties worth
 * pinning are the ones that would let drift survive a run:
 *
 * - a row that already agrees is NOT rewritten (so "corrected" is a real drift
 *   count and not the row count, which is the only cheap health signal there is);
 * - a row that disagrees on status, plan OR subscription is rewritten;
 * - an accommodation with no row at all gets one;
 * - a row whose accommodation is gone is pruned;
 * - `dryRun` writes NOTHING while still reporting what it would have done.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

// ── Drizzle chain double ─────────────────────────────────────────────────────
//
// The job issues exactly three reads, in this order: accommodations, billing
// subscriptions joined to customers, existing cache rows. A FIFO queue serves
// them; inserts and deletes are recorded.

const selectQueue: unknown[][] = [];
const inserted: Record<string, unknown>[] = [];
const deleteCalls: number[] = [];

function makeSelectChain() {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.innerJoin = () => chain;
    chain.where = () => Promise.resolve(selectQueue.shift() ?? []);
    return chain;
}

const mockDb = {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => ({
        values: (values: Record<string, unknown>[]) => ({
            onConflictDoUpdate: () => {
                inserted.push(...values);
                return Promise.resolve(undefined);
            }
        })
    })),
    delete: vi.fn(() => ({
        where: () => {
            deleteCalls.push(1);
            return Promise.resolve(undefined);
        }
    }))
};

vi.mock('@repo/db', () => ({
    getDb: () => mockDb,
    and: (...args: unknown[]) => ({ op: 'and', args }),
    eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
    inArray: (a: unknown, b: unknown) => ({ op: 'inArray', a, b }),
    isNull: (a: unknown) => ({ op: 'isNull', a }),
    sql: (strings: TemplateStringsArray) => ({ sql: strings.join('') }),
    ENTITY_SUBSCRIPTION_STATUS_NONE: 'none',
    accommodations: { id: 'a.id', ownerId: 'a.owner_id', deletedAt: 'a.deleted_at' },
    billingCustomers: { id: 'c.id', externalId: 'c.external_id', deletedAt: 'c.deleted_at' },
    billingSubscriptions: {
        id: 's.id',
        customerId: 's.customer_id',
        planId: 's.plan_id',
        status: 's.status',
        productDomain: 's.product_domain',
        createdAt: 's.created_at',
        deletedAt: 's.deleted_at'
    },
    entitySubscriptions: {
        entityType: 'es.entity_type',
        entityId: 'es.entity_id',
        subscriptionId: 'es.subscription_id',
        status: 'es.status',
        planId: 'es.plan_id',
        productDomain: 'es.product_domain'
    }
}));

import { entitySubscriptionCacheReconcileJob } from '../../src/cron/jobs/entity-subscription-cache-reconcile.job';

function buildCtx(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        } as unknown as CronJobContext['logger'],
        startedAt: new Date('2026-09-03T06:00:00Z'),
        dryRun: false,
        ...overrides
    } as CronJobContext;
}

function queueReads(input: {
    accommodations: unknown[];
    subscriptions: unknown[];
    existing: unknown[];
}): void {
    selectQueue.push(input.accommodations, input.subscriptions, input.existing);
}

const ACTIVE_SUB = {
    ownerId: 'owner-a',
    id: 'sub-1',
    status: 'active',
    planId: 'plan-a',
    productDomain: 'accommodation',
    createdAt: new Date('2026-01-01')
};

beforeEach(() => {
    selectQueue.length = 0;
    inserted.length = 0;
    deleteCalls.length = 0;
    vi.clearAllMocks();
});

describe('entity-subscription-cache-reconcile — definition', () => {
    it('runs every 6 hours, offset from featured-by-entitlement-reconcile', () => {
        expect(entitySubscriptionCacheReconcileJob.name).toBe(
            'entity-subscription-cache-reconcile'
        );
        expect(entitySubscriptionCacheReconcileJob.schedule).toBe('30 */6 * * *');
        expect(entitySubscriptionCacheReconcileJob.enabled).toBe(true);
    });
});

describe('entity-subscription-cache-reconcile — drift correction', () => {
    it('writes NOTHING when every row already agrees', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-a' }],
            subscriptions: [ACTIVE_SUB],
            existing: [
                { entityId: 'acc-1', subscriptionId: 'sub-1', status: 'active', planId: 'plan-a' }
            ]
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(inserted).toHaveLength(0);
        // "corrected" must be a drift count, not a row count — it is the only
        // cheap signal anyone has that the cache is healthy.
        expect(result.details).toMatchObject({ corrected: 0, orphansPruned: 0 });
    });

    it('rewrites a row whose STATUS drifted', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-a' }],
            subscriptions: [ACTIVE_SUB],
            existing: [
                {
                    entityId: 'acc-1',
                    subscriptionId: 'sub-1',
                    status: 'cancelled',
                    planId: 'plan-a'
                }
            ]
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({ entityId: 'acc-1', status: 'active' });
        expect(result.details).toMatchObject({ corrected: 1 });
    });

    it('rewrites a row whose PLAN drifted, even with the right status', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-a' }],
            subscriptions: [ACTIVE_SUB],
            existing: [
                {
                    entityId: 'acc-1',
                    subscriptionId: 'sub-1',
                    status: 'active',
                    planId: 'plan-STALE'
                }
            ]
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        // A stale plan is the quiet half of the drift: the host still counts as
        // paying, but for the wrong set of features.
        expect(inserted[0]).toMatchObject({ planId: 'plan-a' });
    });

    it('fills a MISSING row', async () => {
        queueReads({
            accommodations: [{ id: 'acc-new', ownerId: 'owner-a' }],
            subscriptions: [ACTIVE_SUB],
            existing: []
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(inserted[0]).toMatchObject({
            entityId: 'acc-new',
            subscriptionId: 'sub-1',
            status: 'active',
            entityType: 'accommodation',
            productDomain: 'accommodation'
        });
    });

    it('writes the NEGATIVE row for an owner whose only subscription is commerce', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-dual' }],
            subscriptions: [
                {
                    ownerId: 'owner-dual',
                    id: 'sub-gastro',
                    status: 'active',
                    planId: 'plan-gastro',
                    productDomain: 'gastronomy',
                    createdAt: new Date('2026-05-01')
                }
            ],
            existing: []
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(inserted[0]).toMatchObject({
            entityId: 'acc-1',
            subscriptionId: null,
            status: 'none',
            planId: null
        });
    });

    // HOS-847 — a recurring add-on's own MercadoPago preapproval gets its own
    // billing_subscriptions row (product_domain = 'addon'), separate from the
    // owner's real accommodation subscription. Without domain isolation this
    // row would be the only "subscription" this owner has, and
    // isAccommodationSubscription's accommodation fail-open would count it as
    // the accommodation subscription — flipping the accommodation cache to
    // 'active' for an owner whose real plan may be lapsed or nonexistent.
    it('writes the NEGATIVE row for an owner whose only subscription is a recurring add-on', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-addon-only' }],
            subscriptions: [
                {
                    ownerId: 'owner-addon-only',
                    id: 'sub-addon',
                    status: 'active',
                    planId: 'plan-addon-extra-accommodations-5',
                    productDomain: 'addon',
                    createdAt: new Date('2026-05-01')
                }
            ],
            existing: []
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(inserted[0]).toMatchObject({
            entityId: 'acc-1',
            subscriptionId: null,
            status: 'none',
            planId: null
        });
    });

    it('prunes a row whose accommodation no longer exists', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-a' }],
            subscriptions: [ACTIVE_SUB],
            existing: [
                { entityId: 'acc-1', subscriptionId: 'sub-1', status: 'active', planId: 'plan-a' },
                {
                    entityId: 'acc-gone',
                    subscriptionId: 'sub-1',
                    status: 'active',
                    planId: 'plan-a'
                }
            ]
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(deleteCalls).toHaveLength(1);
        expect(result.details).toMatchObject({ corrected: 0, orphansPruned: 1 });
    });

    it('dryRun reports the work without doing any of it', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-a' }],
            subscriptions: [ACTIVE_SUB],
            existing: [
                {
                    entityId: 'acc-gone',
                    subscriptionId: 'sub-1',
                    status: 'active',
                    planId: 'plan-a'
                }
            ]
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(
            buildCtx({ dryRun: true })
        );

        expect(inserted).toHaveLength(0);
        expect(deleteCalls).toHaveLength(0);
        expect(result.details).toMatchObject({ corrected: 1, orphansPruned: 1, dryRun: true });
    });

    it('reports failure instead of throwing when a read blows up', async () => {
        mockDb.select.mockImplementationOnce(() => {
            throw new Error('connection reset');
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
    });
});
