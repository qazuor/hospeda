/**
 * Tests for data-migration `0106-hos-1326-abandoned-checkout-mislabelled-cancelled`.
 *
 * These cover the DECISION, which is the part that is mine to get wrong: which
 * suspect ids end up relabelled, which are held back, and what the summary
 * reports. The SQL itself is Drizzle's job, and the `mp_subscription_id`
 * predicate the migration leans on is pinned separately against real emitted SQL
 * (`packages/db/test/billing-subscription-conditions.test.ts`).
 *
 * The fake client dispatches on the TABLE each query selects from, so a test can
 * state "these are the suspects, these have payments, these have orphan charges"
 * and read back what the migration concluded. That is deliberately not a
 * pass-through mock: the whole risk here is a criterion that is too WIDE, and the
 * only way to see it is to hand it a row it must refuse and check that it did.
 *
 * @module test/data-migrations/0106-abandoned-checkout-mislabelled-cancelled
 */

import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { up } from '../../src/data-migrations/0106-hos-1326-abandoned-checkout-mislabelled-cancelled.ts';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.ts';

type Suspect = {
    id: string;
    status: string;
    createdAt: Date | null;
    canceledAt: Date | null;
};

/**
 * Builds a `ctx` whose `db` answers each of the migration's four queries from
 * the scenario given, and records the ids the UPDATE was asked to touch.
 */
function makeCtx(scenario: {
    suspects: Suspect[];
    /** Subscription ids that have a `billing_payments` row. */
    paidIds?: string[];
    /** Subscription ids that have a `billing_orphan_payments` row. */
    orphanIds?: string[];
}) {
    const updatedIds: string[] = [];

    // Dispatched on the table NAME, not on object identity. `@repo/db` can
    // resolve to a different module instance for the test than for the migration
    // (source vs built entry), and identity comparison then silently misses —
    // which is how the orphan-charge lookup came back empty and this suite briefly
    // "proved" the migration relabelling a row it must refuse.
    const selectFrom = (rowsByTable: Map<string, unknown[]>) => (table: unknown) => ({
        // biome-ignore lint/suspicious/noExplicitAny: drizzle table at runtime
        where: async () => rowsByTable.get(getTableName(table as any)) ?? []
    });

    const suspectRows = new Map<string, unknown[]>([['billing_subscriptions', scenario.suspects]]);
    const moneyRows = new Map<string, unknown[]>([
        ['billing_payments', (scenario.paidIds ?? []).map((id) => ({ subscriptionId: id }))],
        [
            'billing_orphan_payments',
            (scenario.orphanIds ?? []).map((id) => ({ subscriptionId: id }))
        ]
    ]);

    const db = {
        select: () => ({ from: selectFrom(suspectRows) }),
        selectDistinct: () => ({ from: selectFrom(moneyRows) }),
        update: () => ({
            set: () => ({
                // The migration passes `inArray(id, relabelTargets)` first; the
                // fake reads the target list off the recorded call instead of
                // re-deriving it, so the assertion is about what the migration
                // decided rather than about this helper's own arithmetic.
                where: (condition: unknown) => ({
                    returning: async () => {
                        const ids = extractInArrayValues(condition);
                        updatedIds.push(...ids);
                        return ids.map((id) => ({ id }));
                    }
                })
            })
        })
    };

    return { ctx: { db } as unknown as SeedMigrationCtx, updatedIds };
}

/**
 * Pulls the target id list out of the UPDATE's `WHERE`.
 *
 * Renders the condition through the real Postgres dialect and reads the bound
 * parameters, rather than walking the object graph — drizzle's table references
 * are circular, and a hand-rolled traversal blows the stack on them.
 */
function extractInArrayValues(condition: unknown): string[] {
    // biome-ignore lint/suspicious/noExplicitAny: dialect takes a drizzle SQL node
    const { params } = new PgDialect().sqlToQuery(condition as any);
    return [
        ...new Set(
            params.filter(
                (value): value is string => typeof value === 'string' && value.startsWith('sub-')
            )
        )
    ];
}

const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
const halfAnHourLater = new Date(anHourAgo.getTime() + 31 * 60 * 1000);

function suspect(id: string, status = 'canceled'): Suspect {
    return { id, status, createdAt: anHourAgo, canceledAt: halfAnHourLater };
}

describe('0106 — relabels abandoned checkouts filed as cancellations', () => {
    it('relabels a suspect with no payments at all', async () => {
        const { ctx, updatedIds } = makeCtx({ suspects: [suspect('sub-abandoned')] });

        const result = await up(ctx);

        expect(updatedIds).toEqual(['sub-abandoned']);
        expect(result.counts?.relabelled).toBe(1);
        expect(result.counts?.heldBackByPayments).toBe(0);
    });

    // Condition 3, the one that makes a false positive impossible. A row with a
    // payment is a real relationship: relabelling it would destroy a true fact
    // about a customer who paid, which is worse than the bug being repaired.
    it('HOLDS BACK a suspect that has a payment, whatever its status', async () => {
        const { ctx, updatedIds } = makeCtx({
            suspects: [suspect('sub-abandoned'), suspect('sub-really-cancelled')],
            paidIds: ['sub-really-cancelled']
        });

        const result = await up(ctx);

        expect(updatedIds).toEqual(['sub-abandoned']);
        expect(updatedIds).not.toContain('sub-really-cancelled');
        expect(result.counts?.relabelled).toBe(1);
        expect(result.counts?.heldBackByPayments).toBe(1);
        // Reported by ID, so the deploy log can be audited rather than trusted.
        expect(result.summary).toContain('sub-really-cancelled');
    });

    // The half a payments-only check misses: a charge that landed but could not
    // be linked (HOS-765 / HOS-1001) is money moved with NO `billing_payments`
    // row to show for it.
    it('HOLDS BACK a suspect whose only evidence of money is an ORPHAN charge', async () => {
        const { ctx, updatedIds } = makeCtx({
            suspects: [suspect('sub-abandoned'), suspect('sub-orphan-charge')],
            orphanIds: ['sub-orphan-charge']
        });

        const result = await up(ctx);

        expect(updatedIds).toEqual(['sub-abandoned']);
        expect(updatedIds).not.toContain('sub-orphan-charge');
        expect(result.counts?.heldBackByPayments).toBe(1);
    });

    it('relabels BOTH cancellation spellings', async () => {
        const { ctx, updatedIds } = makeCtx({
            suspects: [suspect('sub-american', 'canceled'), suspect('sub-british', 'cancelled')]
        });

        await up(ctx);

        expect(updatedIds).toEqual(['sub-american', 'sub-british']);
    });

    it('writes nothing, and says so distinguishably, when there are no suspects', async () => {
        const { ctx, updatedIds } = makeCtx({ suspects: [] });

        const result = await up(ctx);

        expect(updatedIds).toEqual([]);
        expect(result.counts).toEqual({ suspects: 0, relabelled: 0, heldBackByPayments: 0 });
        // "There was nothing" must not read like "it never looked" — a migration
        // that reads nothing is ledgered applied forever (HOS-433).
        expect(result.summary).toContain('nothing to relabel');
    });

    it('writes nothing when EVERY suspect has money attached, and reports that as the criterion working', async () => {
        const { ctx, updatedIds } = makeCtx({
            suspects: [suspect('sub-one'), suspect('sub-two')],
            paidIds: ['sub-one'],
            orphanIds: ['sub-two']
        });

        const result = await up(ctx);

        expect(updatedIds).toEqual([]);
        expect(result.counts?.relabelled).toBe(0);
        expect(result.counts?.heldBackByPayments).toBe(2);
    });

    it('names every relabelled id in the summary, not just a count', async () => {
        const { ctx } = makeCtx({ suspects: [suspect('sub-a'), suspect('sub-b')] });

        const result = await up(ctx);

        expect(result.summary).toContain('sub-a');
        expect(result.summary).toContain('sub-b');
    });
});
