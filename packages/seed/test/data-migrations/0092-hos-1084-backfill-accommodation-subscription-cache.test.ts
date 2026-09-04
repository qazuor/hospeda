/**
 * @fileoverview
 * Unit tests for the `0092-hos-1084-backfill-accommodation-subscription-cache`
 * data migration, against a mocked query chain — no real database connection.
 *
 * The migration's whole job is to decide, per accommodation, WHICH subscription
 * state to cache. Everything worth testing is in that decision, and two of its
 * branches would be invisible in production if they were wrong:
 *
 * - a legacy subscription with a NULL `product_domain` must be treated as
 *   accommodation (the predicate fails OPEN), because caching `'none'` over a
 *   host who is paying is a lie the public read believes;
 * - an owner with no accommodation subscription must still get a row. Skipping
 *   them would look like a smaller, tidier backfill and would leave the most
 *   common owner on the platform missing the cache on every request.
 *
 * WHAT THESE TESTS CANNOT SEE: with a fake `db` no SQL predicate is evaluated,
 * so the `deleted_at IS NULL` filters and the JOIN are taken on trust. What IS
 * verified is the row-shaping and the selection ranking.
 *
 * @module test/data-migrations/0092-hos-1084-backfill-accommodation-subscription-cache
 */
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0092-hos-1084-backfill-accommodation-subscription-cache.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

interface AccommodationFixture {
    readonly id: string;
    readonly ownerId: string;
}

interface SubscriptionFixture {
    readonly ownerId: string;
    readonly id: string;
    readonly status: string;
    readonly planId: string | null;
    readonly productDomain: string | null;
    readonly createdAt: Date;
}

interface UpsertedRow {
    readonly subscriptionId: string | null;
    readonly productDomain: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly status: string;
    readonly planId: string | null;
}

/**
 * Builds a `ctx.db` double serving the migration's two reads in order
 * (accommodations, then subscriptions) and recording what it upserts.
 */
function makeCtx(input: {
    accommodations: readonly AccommodationFixture[];
    subscriptions: readonly SubscriptionFixture[];
}): { ctx: SeedMigrationCtx; upserted: UpsertedRow[] } {
    const queue: unknown[][] = [[...input.accommodations], [...input.subscriptions]];
    const upserted: UpsertedRow[] = [];

    function makeSelectChain(): Record<string, unknown> {
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.innerJoin = () => chain;
        chain.where = () => Promise.resolve(queue.shift() ?? []);
        return chain;
    }

    const db = {
        select: () => makeSelectChain(),
        insert: () => ({
            values: (values: UpsertedRow[]) => ({
                onConflictDoUpdate: () => {
                    upserted.push(...values);
                    return Promise.resolve(undefined);
                }
            })
        })
    };

    return { ctx: { db } as unknown as SeedMigrationCtx, upserted };
}

const ACTIVE = {
    id: 'sub-active',
    status: 'active',
    planId: 'plan-premium',
    productDomain: 'accommodation',
    createdAt: new Date('2026-01-01')
} as const;

describe('0092 — meta', () => {
    it('declares the columns it reads, so a reordering aborts instead of writing nothing', () => {
        // HOS-433: a backfill whose source column had already been dropped ran
        // in 18ms, moved zero rows and was ledgered `ok` forever.
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'entity_subscriptions', column: 'plan_id' },
            { table: 'billing_subscriptions', column: 'product_domain' }
        ]);
    });

    it('is contentOnly, so a fresh database RUNS it instead of stamping it applied', () => {
        // No fixture under src/data/** writes an entity_subscriptions row, so
        // the baseline-stamp premise ("the seed already produced this state")
        // is false here. Stamping would ledger it applied over an empty cache.
        expect(migration.meta.contentOnly).toBe(true);
    });

    it('is not destructive — every row it writes is re-derivable from billing', () => {
        expect(migration.meta.destructive).toBe(false);
    });
});

describe('0092 — backfill', () => {
    it('writes one row per accommodation, all pointing at the owner subscription', async () => {
        const { ctx, upserted } = makeCtx({
            accommodations: [
                { id: 'acc-1', ownerId: 'owner-a' },
                { id: 'acc-2', ownerId: 'owner-a' },
                { id: 'acc-3', ownerId: 'owner-a' }
            ],
            subscriptions: [{ ownerId: 'owner-a', ...ACTIVE }]
        });

        const result = await migration.up(ctx);

        expect(upserted).toHaveLength(3);
        // Three listings, one subscription — the shape a UNIQUE on
        // subscription_id would have rejected.
        expect(new Set(upserted.map((r) => r.subscriptionId))).toEqual(new Set(['sub-active']));
        expect(upserted.every((r) => r.entityType === 'accommodation')).toBe(true);
        expect(upserted.every((r) => r.productDomain === 'accommodation')).toBe(true);
        expect(upserted.every((r) => r.status === 'active' && r.planId === 'plan-premium')).toBe(
            true
        );
        expect(result.counts).toMatchObject({ rowsWritten: 3, ownersWithSubscription: 1 });
    });

    it('caches the NEGATIVE answer for an owner with no subscription', async () => {
        const { ctx, upserted } = makeCtx({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-none' }],
            subscriptions: []
        });

        await migration.up(ctx);

        expect(upserted[0]).toMatchObject({
            entityId: 'acc-1',
            subscriptionId: null,
            status: 'none',
            planId: null
        });
    });

    it('treats a legacy NULL product_domain as accommodation (fails OPEN)', async () => {
        const { ctx, upserted } = makeCtx({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-legacy' }],
            subscriptions: [
                {
                    ownerId: 'owner-legacy',
                    id: 'sub-legacy',
                    status: 'active',
                    planId: 'plan-legacy',
                    productDomain: null,
                    createdAt: new Date('2025-01-01')
                }
            ]
        });

        await migration.up(ctx);

        // A SQL `product_domain = 'accommodation'` would have written 'none'
        // here — caching "does not pay" over a host who does.
        expect(upserted[0]).toMatchObject({
            subscriptionId: 'sub-legacy',
            status: 'active',
            planId: 'plan-legacy'
        });
    });

    it('ignores a commerce subscription held by the same owner', async () => {
        const { ctx, upserted } = makeCtx({
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
            ]
        });

        await migration.up(ctx);

        expect(upserted[0]).toMatchObject({ subscriptionId: null, status: 'none' });
    });

    it('prefers the granting subscription over a newer dead one', async () => {
        const { ctx, upserted } = makeCtx({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-a' }],
            subscriptions: [
                {
                    ownerId: 'owner-a',
                    id: 'sub-cancelled',
                    status: 'cancelled',
                    planId: 'plan-old',
                    productDomain: 'accommodation',
                    createdAt: new Date('2026-06-01')
                },
                { ownerId: 'owner-a', ...ACTIVE }
            ]
        });

        await migration.up(ctx);

        expect(upserted[0]).toMatchObject({ subscriptionId: 'sub-active', status: 'active' });
    });

    it('falls back to the newest subscription when none of them grants', async () => {
        const { ctx, upserted } = makeCtx({
            accommodations: [{ id: 'acc-1', ownerId: 'owner-a' }],
            subscriptions: [
                {
                    ownerId: 'owner-a',
                    id: 'sub-old',
                    status: 'cancelled',
                    planId: 'plan-old',
                    productDomain: 'accommodation',
                    createdAt: new Date('2026-01-01')
                },
                {
                    ownerId: 'owner-a',
                    id: 'sub-new',
                    status: 'past_due',
                    planId: 'plan-new',
                    productDomain: 'accommodation',
                    createdAt: new Date('2026-06-01')
                }
            ]
        });

        await migration.up(ctx);

        expect(upserted[0]).toMatchObject({ subscriptionId: 'sub-new', status: 'past_due' });
    });

    it('keeps each owner separate', async () => {
        const { ctx, upserted } = makeCtx({
            accommodations: [
                { id: 'acc-a', ownerId: 'owner-a' },
                { id: 'acc-b', ownerId: 'owner-b' }
            ],
            subscriptions: [{ ownerId: 'owner-a', ...ACTIVE }]
        });

        await migration.up(ctx);

        expect(upserted.find((r) => r.entityId === 'acc-a')?.status).toBe('active');
        expect(upserted.find((r) => r.entityId === 'acc-b')?.status).toBe('none');
    });

    it('writes nothing, and reports it, when there are no accommodations', async () => {
        const { ctx, upserted } = makeCtx({ accommodations: [], subscriptions: [] });

        const result = await migration.up(ctx);

        expect(upserted).toHaveLength(0);
        expect(result.counts).toMatchObject({ accommodations: 0, rowsWritten: 0 });
    });
});
