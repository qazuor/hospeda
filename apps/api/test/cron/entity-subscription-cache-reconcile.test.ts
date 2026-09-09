/**
 * HOS-1084 / HOS-1292 — the backstop cron for the subscription-status cache.
 *
 * The write-through path keeps the cache correct in the normal case; this job is
 * what makes a desync self-healing rather than permanent. A stale row is not
 * visible as an error — a listing that has silently lost its premium fields
 * looks exactly like a listing that never had them — so the properties worth
 * pinning are the ones that would let drift survive a run.
 *
 * ACCOMMODATION (HOS-1084), where the whole row is derivable:
 *
 * - a row that already agrees is NOT rewritten (so "corrected" is a real drift
 *   count and not the row count, which is the only cheap health signal there is);
 * - a row that disagrees on status, plan OR subscription is rewritten;
 * - an accommodation with no row at all gets one;
 * - a row whose accommodation is gone is pruned;
 * - `dryRun` writes NOTHING while still reporting what it would have done.
 *
 * COMMERCE (HOS-1292), where only the mirrored status is derivable:
 *
 * - a gastronomy or experience row whose cached status disagrees with live
 *   billing is repaired through the ONE commerce reconciler, so the listing's
 *   visibility follows the corrected status;
 * - a row that agrees is left alone;
 * - a row is never CREATED and never PRUNED here — the link is an owner's
 *   choice billing does not hold, and a missing row is never a wrong answer;
 * - the scope is "every entity_type that is not accommodation", not an
 *   enumeration of today's verticals;
 * - and the dual-owner case: a customer holding an accommodation plan AND a
 *   commerce plan gets each vertical resolved from its OWN subscription.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

// ── Drizzle chain double ─────────────────────────────────────────────────────
//
// The job issues up to five reads, in this order: accommodations, billing
// subscriptions joined to customers, existing accommodation cache rows,
// non-accommodation cache rows, and the live billing status of the
// subscriptions those rows point at (skipped when there are none). A FIFO queue
// serves them; inserts, deletes, and every `where` predicate are recorded.

const selectQueue: unknown[][] = [];
const inserted: Record<string, unknown>[] = [];
const deleteCalls: number[] = [];
const whereArgs: unknown[] = [];
const commerceReconcileCalls: Array<{
    subscriptionId: string;
    subscriptionStatus: string;
    source: string;
}> = [];

function makeSelectChain() {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.innerJoin = () => chain;
    chain.where = (condition: unknown) => {
        whereArgs.push(condition);
        return Promise.resolve(selectQueue.shift() ?? []);
    };
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
    ne: (a: unknown, b: unknown) => ({ op: 'ne', a, b }),
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

// The commerce repair delegates to the ONE commerce reconciler rather than
// writing the row itself, so what this suite pins is the delegation: which
// subscription is handed over, and with which status.
vi.mock('../../src/services/commerce-reconcile.service', () => ({
    reconcileCommerceListingForSubscription: (input: {
        subscriptionId: string;
        subscriptionStatus: string;
        source: string;
    }) => {
        commerceReconcileCalls.push(input);
        return Promise.resolve(undefined);
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
    /** Non-accommodation cache rows (read 4). Defaults to none. */
    commerceRows?: unknown[];
    /** Live billing rows for the subscriptions those rows point at (read 5). */
    liveCommerceSubscriptions?: unknown[];
}): void {
    selectQueue.push(input.accommodations, input.subscriptions, input.existing);
    if (input.commerceRows !== undefined) {
        selectQueue.push(input.commerceRows);
    }
    if (input.liveCommerceSubscriptions !== undefined) {
        selectQueue.push(input.liveCommerceSubscriptions);
    }
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
    whereArgs.length = 0;
    commerceReconcileCalls.length = 0;
    vi.clearAllMocks();
});

/**
 * An empty accommodation half (reads 1-3), so a commerce case exercises only
 * reads 4-5 and any write it observes can only have come from the commerce half.
 */
const NO_ACCOMMODATIONS = { accommodations: [], subscriptions: [], existing: [] };

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

    /**
     * HOS-1233 T-041 / AC-15c — §4b filed this read as FIXED: "a tourist row
     * could outrank a real owner plan in the cache".
     *
     * The pair matters here more than anywhere else, because the fix is the
     * data migration and not a line of code: a fixture built with the corrected
     * domain would pass before T-038 too, which §9 names as the way this suite
     * could go green while the bug survived. So the first case reproduces the
     * MISFILED shape and asserts the wrong answer it produced.
     */
    it('MISFILED: a tourist row stored as accommodation is cached as the owner plan', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-tourist-only' }],
            subscriptions: [
                {
                    ownerId: 'owner-tourist-only',
                    id: 'sub-tourist-vip',
                    status: 'active',
                    planId: 'plan-tourist-vip',
                    // The shape measured in prod and staging before T-038: a
                    // tourist plan claiming the column default (spec F-4b).
                    productDomain: 'accommodation',
                    createdAt: new Date('2026-05-01')
                }
            ],
            existing: []
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        // The accommodation is cached as covered by a subscription that is not
        // a host plan at all.
        expect(inserted[0]).toMatchObject({
            entityId: 'acc-1',
            subscriptionId: 'sub-tourist-vip',
            status: 'active'
        });
    });

    it('CORRECTED: the same row filed as tourist writes the NEGATIVE row', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-tourist-only' }],
            subscriptions: [
                {
                    ownerId: 'owner-tourist-only',
                    id: 'sub-tourist-vip',
                    status: 'active',
                    planId: 'plan-tourist-vip',
                    productDomain: 'tourist',
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

    it('and a real owner plan still outranks a tourist row on the same owner', async () => {
        // The sibling that keeps the assertion above from being satisfied by a
        // cron that simply caches nothing: the owner holds BOTH, and the
        // accommodation one has to win regardless of which is newer.
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-both' }],
            subscriptions: [
                {
                    ownerId: 'owner-both',
                    id: 'sub-tourist-vip',
                    status: 'active',
                    planId: 'plan-tourist-vip',
                    productDomain: 'tourist',
                    // NEWER than the host plan, so "the newest wins" alone
                    // would pick the wrong one.
                    createdAt: new Date('2026-06-01')
                },
                {
                    ownerId: 'owner-both',
                    id: 'sub-owner-pro',
                    status: 'active',
                    planId: 'plan-owner-pro',
                    productDomain: 'accommodation',
                    createdAt: new Date('2026-05-01')
                }
            ],
            existing: []
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(inserted[0]).toMatchObject({
            entityId: 'acc-1',
            subscriptionId: 'sub-owner-pro',
            status: 'active'
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

/**
 * HOS-1292 — the commerce half.
 *
 * Before this, `entity_subscriptions` was unified (HOS-1084) but the cron that
 * repairs it was not: it filtered to `entity_type = 'accommodation'` everywhere.
 * A gastronomy or experience row that desynced had nobody to correct it, and
 * that row decides the listing's PUBLIC visibility — so the same dropped webhook
 * was temporary for a host and permanent for a restaurant.
 */
describe('entity-subscription-cache-reconcile — commerce drift correction (HOS-1292)', () => {
    it('repairs a GASTRONOMY row whose cached status drifted from live billing', async () => {
        queueReads({
            ...NO_ACCOMMODATIONS,
            commerceRows: [
                {
                    entityId: 'gastro-1',
                    entityType: 'gastronomy',
                    subscriptionId: 'sub-gastro',
                    // The webhook that cancelled the subscription never landed.
                    status: 'active'
                }
            ],
            liveCommerceSubscriptions: [{ id: 'sub-gastro', status: 'cancelled' }]
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(commerceReconcileCalls).toEqual([
            {
                subscriptionId: 'sub-gastro',
                subscriptionStatus: 'cancelled',
                source: 'cron:entity-subscription-cache-reconcile'
            }
        ]);
        expect(result.details).toMatchObject({ commerceRows: 1, commerceCorrected: 1 });
    });

    it('repairs an EXPERIENCE row too — the sibling vertical the first fix would forget', async () => {
        queueReads({
            ...NO_ACCOMMODATIONS,
            commerceRows: [
                {
                    entityId: 'exp-1',
                    entityType: 'experience',
                    subscriptionId: 'sub-exp',
                    status: 'past_due'
                }
            ],
            liveCommerceSubscriptions: [{ id: 'sub-exp', status: 'active' }]
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(commerceReconcileCalls).toEqual([
            {
                subscriptionId: 'sub-exp',
                subscriptionStatus: 'active',
                source: 'cron:entity-subscription-cache-reconcile'
            }
        ]);
    });

    it("inspects EVERY non-accommodation entity_type, not an enumeration of today's two", async () => {
        // The scope is `entity_type != 'accommodation'` on purpose: a fourth
        // vertical must be covered the day its first row is written, not the day
        // somebody remembers to add it here. Both halves of that claim are
        // pinned — the predicate handed to the driver, and a row of an
        // entity_type this file has never heard of being repaired.
        queueReads({
            ...NO_ACCOMMODATIONS,
            commerceRows: [
                {
                    entityId: 'future-1',
                    entityType: 'a-vertical-that-does-not-exist-yet',
                    subscriptionId: 'sub-future',
                    status: 'active'
                }
            ],
            liveCommerceSubscriptions: [{ id: 'sub-future', status: 'cancelled' }]
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        // Read 4 is the non-accommodation scan (reads 1-3 are the accommodation
        // half's). Pins the operator AND both operands: an `eq` here, or a
        // different literal, would silently reduce the backstop's reach.
        expect(whereArgs[3]).toEqual({ op: 'ne', a: 'es.entity_type', b: 'accommodation' });
        expect(commerceReconcileCalls).toHaveLength(1);
    });

    it('leaves a commerce row that already agrees alone', async () => {
        queueReads({
            ...NO_ACCOMMODATIONS,
            commerceRows: [
                {
                    entityId: 'gastro-1',
                    entityType: 'gastronomy',
                    subscriptionId: 'sub-gastro',
                    status: 'active'
                }
            ],
            liveCommerceSubscriptions: [{ id: 'sub-gastro', status: 'active' }]
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(commerceReconcileCalls).toHaveLength(0);
        expect(result.details).toMatchObject({ commerceRows: 1, commerceCorrected: 0 });
    });

    it('never CREATES a commerce row: a listing with no row stays a cache miss', async () => {
        // The link — which listing an owner spent a slot on — is not derivable
        // from billing, and a missing row is never a wrong answer (the public
        // read falls back to the live resolution). So a run that sees no
        // commerce rows must write nothing at all, however much live billing
        // there is.
        queueReads({
            ...NO_ACCOMMODATIONS,
            commerceRows: [],
            liveCommerceSubscriptions: []
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(commerceReconcileCalls).toHaveLength(0);
        expect(inserted).toHaveLength(0);
        expect(deleteCalls).toHaveLength(0);
        expect(result.details).toMatchObject({ commerceRows: 0, commerceCorrected: 0 });
    });

    it('never PRUNES a commerce row whose subscription no longer resolves — it counts it', async () => {
        // "The subscription is gone" has no status to mirror. Deleting the row
        // would destroy the one fact billing cannot recreate, so the run leaves
        // it and makes the count visible instead of silent.
        queueReads({
            ...NO_ACCOMMODATIONS,
            commerceRows: [
                {
                    entityId: 'gastro-1',
                    entityType: 'gastronomy',
                    subscriptionId: 'sub-vanished',
                    status: 'active'
                },
                {
                    entityId: 'gastro-2',
                    entityType: 'gastronomy',
                    subscriptionId: null,
                    status: 'active'
                }
            ],
            liveCommerceSubscriptions: []
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(commerceReconcileCalls).toHaveLength(0);
        expect(deleteCalls).toHaveLength(0);
        expect(result.details).toMatchObject({
            commerceCorrected: 0,
            commerceUnlinked: 1,
            commerceSubscriptionMissing: 1
        });
    });

    it('dryRun reports the commerce drift without reconciling any of it', async () => {
        queueReads({
            ...NO_ACCOMMODATIONS,
            commerceRows: [
                {
                    entityId: 'gastro-1',
                    entityType: 'gastronomy',
                    subscriptionId: 'sub-gastro',
                    status: 'active'
                }
            ],
            liveCommerceSubscriptions: [{ id: 'sub-gastro', status: 'cancelled' }]
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(
            buildCtx({ dryRun: true })
        );

        expect(commerceReconcileCalls).toHaveLength(0);
        expect(result.details).toMatchObject({
            commerceCorrected: 1,
            commerceSubscriptionsReconciled: 0,
            dryRun: true
        });
    });

    /**
     * The dual-owner case, which is the whole reason this repo seeds
     * `host-provider@local.test`: one customer, two verticals, two live
     * subscriptions. Each half has to answer from its OWN source.
     *
     * The accommodation half resolves per OWNER and must filter by domain — the
     * gastronomy subscription here is newer and equally entitlement-granting, so
     * "newest wins" alone would pick the wrong one. The commerce half resolves
     * per ROW's `subscription_id` and must not borrow the owner's healthy
     * accommodation status for a commerce listing.
     */
    it('resolves each vertical from its OWN subscription for a dual-vertical owner', async () => {
        queueReads({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-dual' }],
            subscriptions: [
                {
                    ownerId: 'owner-dual',
                    id: 'sub-gastro',
                    status: 'active',
                    planId: 'plan-gastro',
                    productDomain: 'gastronomy',
                    // NEWER than the host plan.
                    createdAt: new Date('2026-06-01')
                },
                {
                    ownerId: 'owner-dual',
                    id: 'sub-acc',
                    status: 'active',
                    planId: 'plan-owner-pro',
                    productDomain: 'accommodation',
                    createdAt: new Date('2026-05-01')
                }
            ],
            existing: [],
            commerceRows: [
                {
                    entityId: 'gastro-1',
                    entityType: 'gastronomy',
                    subscriptionId: 'sub-gastro',
                    // Stale: the attach path wrote it and the activation webhook
                    // never followed.
                    status: 'cancelled'
                }
            ],
            liveCommerceSubscriptions: [{ id: 'sub-gastro', status: 'active' }]
        });

        await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        // The accommodation row takes the accommodation plan, not the newer
        // gastronomy one.
        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({
            entityId: 'acc-1',
            subscriptionId: 'sub-acc',
            planId: 'plan-owner-pro',
            entityType: 'accommodation'
        });

        // The gastronomy row is repaired from ITS subscription — the owner's
        // healthy accommodation status is not what unblocks the restaurant.
        expect(commerceReconcileCalls).toEqual([
            {
                subscriptionId: 'sub-gastro',
                subscriptionStatus: 'active',
                source: 'cron:entity-subscription-cache-reconcile'
            }
        ]);
    });

    it('reconciles a subscription ONCE however many of its listings drifted', async () => {
        // A commerce owner's whole cap (1/3/10) hangs off one subscription, and
        // the reconciler re-points every row of it in a single call. Fanning out
        // per row would re-reconcile the same listings N times per run.
        queueReads({
            ...NO_ACCOMMODATIONS,
            commerceRows: [
                {
                    entityId: 'gastro-1',
                    entityType: 'gastronomy',
                    subscriptionId: 'sub-gastro',
                    status: 'active'
                },
                {
                    entityId: 'gastro-2',
                    entityType: 'gastronomy',
                    subscriptionId: 'sub-gastro',
                    status: 'active'
                },
                {
                    entityId: 'gastro-3',
                    entityType: 'gastronomy',
                    subscriptionId: 'sub-gastro',
                    status: 'active'
                }
            ],
            liveCommerceSubscriptions: [{ id: 'sub-gastro', status: 'cancelled' }]
        });

        const result = await entitySubscriptionCacheReconcileJob.handler(buildCtx());

        expect(commerceReconcileCalls).toHaveLength(1);
        expect(result.details).toMatchObject({
            commerceRows: 3,
            commerceCorrected: 3,
            commerceSubscriptionsReconciled: 1
        });
    });
});
