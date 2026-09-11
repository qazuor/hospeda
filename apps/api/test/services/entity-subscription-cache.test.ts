/**
 * HOS-1084 — the accommodation half of the shared subscription-status cache.
 *
 * What these tests pin is the small set of properties that decide whether the
 * cache is an improvement or a liability:
 *
 * - a row is written per ACCOMMODATION, so a host with three properties gets
 *   three rows on one subscription (the `UNIQUE(entity_type, entity_id)` is per
 *   listing, never per subscription);
 * - an owner with NO subscription still gets rows, carrying the `'none'`
 *   sentinel, because a missing row for the most common kind of host would send
 *   every request straight back to the live billing walk;
 * - the domain filter goes through `isAccommodationSubscription`, so a
 *   commerce/partner subscription never lands in an accommodation row and a
 *   legacy row with a NULL `product_domain` still does;
 * - the sync RE-DERIVES the owner's current subscription instead of trusting
 *   the status it was called with, so a late webhook for a superseded
 *   subscription cannot overwrite the live one;
 * - the read prefers an entitlement-granting row when an owner's rows
 *   disagree — failing in the direction of the host who is paying.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── A minimal Drizzle chain double ────────────────────────────────────────────
//
// Each query in the module under test ends at `.where(...)`, so the double
// serves results from a FIFO queue and records what was inserted/deleted. That
// keeps the assertions about the module's own logic rather than about Drizzle.

interface InsertRecord {
    readonly values: unknown;
    readonly conflict: unknown;
}

const selectQueue: unknown[][] = [];
const inserts: InsertRecord[] = [];

function queueSelect(rows: unknown[]): void {
    selectQueue.push(rows);
}

function nextSelectResult(): unknown[] {
    return selectQueue.shift() ?? [];
}

function makeSelectChain() {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.innerJoin = () => chain;
    chain.leftJoin = () => chain;
    chain.limit = () => Promise.resolve(nextSelectResult());
    chain.where = () => {
        const rows = nextSelectResult();
        const thenable = Promise.resolve(rows) as Promise<unknown[]> & {
            limit: () => Promise<unknown[]>;
        };
        thenable.limit = () => Promise.resolve(rows);
        return thenable;
    };
    return chain;
}

const mockDb = {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => ({
        values: (values: unknown) => ({
            onConflictDoUpdate: (conflict: unknown) => {
                inserts.push({ values, conflict });
                return Promise.resolve(undefined);
            }
        })
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
    accommodations: {
        id: 'accommodations.id',
        ownerId: 'accommodations.owner_id',
        deletedAt: 'accommodations.deleted_at'
    },
    billingCustomers: {
        id: 'billing_customers.id',
        externalId: 'billing_customers.external_id',
        deletedAt: 'billing_customers.deleted_at'
    },
    billingSubscriptions: {
        id: 'billing_subscriptions.id',
        customerId: 'billing_subscriptions.customer_id',
        planId: 'billing_subscriptions.plan_id',
        status: 'billing_subscriptions.status',
        productDomain: 'billing_subscriptions.product_domain',
        createdAt: 'billing_subscriptions.created_at',
        deletedAt: 'billing_subscriptions.deleted_at'
    },
    entitySubscriptions: {
        entityType: 'entity_subscriptions.entity_type',
        entityId: 'entity_subscriptions.entity_id',
        subscriptionId: 'entity_subscriptions.subscription_id',
        status: 'entity_subscriptions.status',
        planId: 'entity_subscriptions.plan_id',
        productDomain: 'entity_subscriptions.product_domain'
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    readAccommodationSubscriptionCacheByOwnerIds,
    syncAccommodationSubscriptionCacheForOwner,
    syncAccommodationSubscriptionCacheForSubscription
} from '../../src/services/entity-subscription-cache.service';

const OWNER = 'owner-1';

interface UpsertedRow {
    subscriptionId: string | null;
    entityType: string;
    entityId: string;
    status: string;
    planId: string | null;
    productDomain: string;
}

function upsertedRows(): UpsertedRow[] {
    return inserts.flatMap((record) => record.values as UpsertedRow[]);
}

beforeEach(() => {
    selectQueue.length = 0;
    inserts.length = 0;
    vi.clearAllMocks();
});

describe('syncAccommodationSubscriptionCacheForOwner', () => {
    it('writes ONE row per accommodation, all pointing at the same subscription', async () => {
        queueSelect([{ id: 'acc-1' }, { id: 'acc-2' }, { id: 'acc-3' }]);
        queueSelect([
            {
                id: 'sub-live',
                status: 'active',
                planId: 'plan-a',
                productDomain: 'accommodation',
                createdAt: new Date('2026-01-01')
            }
        ]);

        const written = await syncAccommodationSubscriptionCacheForOwner({
            ownerId: OWNER,
            source: 'test'
        });

        expect(written).toBe(3);
        const rows = upsertedRows();
        expect(rows.map((r) => r.entityId)).toEqual(['acc-1', 'acc-2', 'acc-3']);
        // The whole point of the per-LISTING unique index: three rows, one
        // subscription. A unique on subscription_id would reject two of these.
        expect(new Set(rows.map((r) => r.subscriptionId))).toEqual(new Set(['sub-live']));
        expect(rows.every((r) => r.status === 'active' && r.planId === 'plan-a')).toBe(true);
        expect(rows.every((r) => r.entityType === 'accommodation')).toBe(true);
        expect(rows.every((r) => r.productDomain === 'accommodation')).toBe(true);
    });

    it('caches the NEGATIVE answer for an owner with no subscription at all', async () => {
        queueSelect([{ id: 'acc-1' }]);
        queueSelect([]);

        await syncAccommodationSubscriptionCacheForOwner({ ownerId: OWNER, source: 'test' });

        const rows = upsertedRows();
        expect(rows).toHaveLength(1);
        // Without this row the most common host on the platform would MISS the
        // cache on every request and pay the live walk it exists to remove.
        expect(rows[0]).toMatchObject({
            entityId: 'acc-1',
            subscriptionId: null,
            status: 'none',
            planId: null
        });
    });

    it('ignores a commerce subscription and caches the negative answer instead', async () => {
        queueSelect([{ id: 'acc-1' }]);
        queueSelect([
            {
                id: 'sub-gastro',
                status: 'active',
                planId: 'plan-gastro',
                productDomain: 'gastronomy',
                createdAt: new Date('2026-01-01')
            }
        ]);

        await syncAccommodationSubscriptionCacheForOwner({ ownerId: OWNER, source: 'test' });

        const rows = upsertedRows();
        expect(rows[0]?.status).toBe('none');
        expect(rows[0]?.planId).toBeNull();
    });

    it('treats a legacy NULL product_domain row as accommodation (fails OPEN)', async () => {
        queueSelect([{ id: 'acc-1' }]);
        queueSelect([
            {
                id: 'sub-legacy',
                status: 'active',
                planId: 'plan-legacy',
                productDomain: null,
                createdAt: new Date('2026-01-01')
            }
        ]);

        await syncAccommodationSubscriptionCacheForOwner({ ownerId: OWNER, source: 'test' });

        expect(upsertedRows()[0]).toMatchObject({
            subscriptionId: 'sub-legacy',
            status: 'active',
            planId: 'plan-legacy'
        });
    });

    it('prefers the entitlement-granting subscription over a newer dead one', async () => {
        queueSelect([{ id: 'acc-1' }]);
        queueSelect([
            {
                id: 'sub-cancelled-newer',
                status: 'cancelled',
                planId: 'plan-old',
                productDomain: 'accommodation',
                createdAt: new Date('2026-06-01')
            },
            {
                id: 'sub-active-older',
                status: 'active',
                planId: 'plan-live',
                productDomain: 'accommodation',
                createdAt: new Date('2026-01-01')
            }
        ]);

        await syncAccommodationSubscriptionCacheForOwner({ ownerId: OWNER, source: 'test' });

        expect(upsertedRows()[0]).toMatchObject({
            subscriptionId: 'sub-active-older',
            status: 'active',
            planId: 'plan-live'
        });
    });

    it('falls back to the NEWEST subscription when none of them grants', async () => {
        queueSelect([{ id: 'acc-1' }]);
        queueSelect([
            {
                id: 'sub-old',
                status: 'cancelled',
                planId: 'plan-old',
                productDomain: 'accommodation',
                createdAt: new Date('2026-01-01')
            },
            {
                id: 'sub-new',
                status: 'past_due',
                planId: 'plan-new',
                productDomain: 'accommodation',
                createdAt: new Date('2026-06-01')
            }
        ]);

        await syncAccommodationSubscriptionCacheForOwner({ ownerId: OWNER, source: 'test' });

        expect(upsertedRows()[0]).toMatchObject({ subscriptionId: 'sub-new', status: 'past_due' });
    });

    it('writes nothing when the owner has no accommodations', async () => {
        queueSelect([]);

        const written = await syncAccommodationSubscriptionCacheForOwner({
            ownerId: OWNER,
            source: 'test'
        });

        expect(written).toBe(0);
        expect(inserts).toHaveLength(0);
    });
});

describe('syncAccommodationSubscriptionCacheForSubscription', () => {
    it('re-derives the owner state instead of stamping the triggering subscription', async () => {
        // subscription -> owner
        queueSelect([{ ownerId: OWNER }]);
        // owner's accommodations
        queueSelect([{ id: 'acc-1' }]);
        // owner's live subscriptions — the one that is actually current is NOT
        // the one this call was triggered for.
        queueSelect([
            {
                id: 'sub-current',
                status: 'active',
                planId: 'plan-current',
                productDomain: 'accommodation',
                createdAt: new Date('2026-06-01')
            }
        ]);

        await syncAccommodationSubscriptionCacheForSubscription({
            subscriptionId: 'sub-superseded',
            source: 'mp-webhook'
        });

        // A late webhook for a replaced subscription must not un-publish the
        // one the owner is paying for.
        expect(upsertedRows()[0]).toMatchObject({
            subscriptionId: 'sub-current',
            status: 'active'
        });
    });

    it('is a no-op when the subscription has no resolvable owner', async () => {
        queueSelect([]);

        await syncAccommodationSubscriptionCacheForSubscription({
            subscriptionId: 'sub-orphan',
            source: 'mp-webhook'
        });

        expect(inserts).toHaveLength(0);
    });

    it('never throws — a cache failure must not break a webhook or a cron', async () => {
        mockDb.select.mockImplementationOnce(() => {
            throw new Error('connection reset');
        });

        await expect(
            syncAccommodationSubscriptionCacheForSubscription({
                subscriptionId: 'sub-1',
                source: 'mp-webhook'
            })
        ).resolves.toBeUndefined();
    });
});

describe('readAccommodationSubscriptionCacheByOwnerIds', () => {
    it('returns nothing, and issues no query, for an empty owner list', async () => {
        const result = await readAccommodationSubscriptionCacheByOwnerIds([]);

        expect(result.size).toBe(0);
        expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('maps each owner to their cached status and plan', async () => {
        queueSelect([
            { ownerId: 'owner-a', status: 'active', planId: 'plan-a' },
            { ownerId: 'owner-b', status: 'none', planId: null }
        ]);

        const result = await readAccommodationSubscriptionCacheByOwnerIds([
            'owner-a',
            'owner-b',
            'owner-a'
        ]);

        expect(result.get('owner-a')).toEqual({ status: 'active', planId: 'plan-a' });
        expect(result.get('owner-b')).toEqual({ status: 'none', planId: null });
    });

    it('prefers the granting row when one owner rows disagree', async () => {
        queueSelect([
            { ownerId: 'owner-a', status: 'cancelled', planId: null },
            { ownerId: 'owner-a', status: 'active', planId: 'plan-a' },
            { ownerId: 'owner-a', status: 'cancelled', planId: null }
        ]);

        const result = await readAccommodationSubscriptionCacheByOwnerIds(['owner-a']);

        // A partially-applied sync must fail towards the host who is paying,
        // not against them.
        expect(result.get('owner-a')).toEqual({ status: 'active', planId: 'plan-a' });
    });

    it('omits an owner with no cache row, so the caller resolves them live', async () => {
        queueSelect([{ ownerId: 'owner-a', status: 'active', planId: 'plan-a' }]);

        const result = await readAccommodationSubscriptionCacheByOwnerIds([
            'owner-a',
            'owner-missing'
        ]);

        // Absence must be distinguishable from "no subscription" — the latter
        // is the explicit 'none' sentinel above.
        expect(result.has('owner-missing')).toBe(false);
    });
});
