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
    /**
     * Subscription ids with a `billing_subscription_events` row recording a
     * transition to something OUTSIDE the pending statuses — condition 4.
     */
    movedIds?: string[];
}) {
    const updatedIds: string[] = [];
    /** Every `.where(...)` condition, keyed by the table it was issued against. */
    const wheres = new Map<string, unknown[]>();

    // Dispatched on the table NAME, not on object identity. `@repo/db` can
    // resolve to a different module instance for the test than for the migration
    // (source vs built entry), and identity comparison then silently misses —
    // which is how the orphan-charge lookup came back empty and this suite briefly
    // "proved" the migration relabelling a row it must refuse.
    //
    // The condition is RECORDED as well as ignored for row selection. Ignoring it
    // is fine for the decision tests — they hand the fake exactly the rows each
    // query would have returned — but it means the WHERE itself is invisible, and
    // conditions 1, 2 and 4 live entirely in WHEREs. Deleting any of them left
    // this suite 7/7 green. `sqlOf()` below is what closes that.
    const selectFrom = (rowsByTable: Map<string, unknown[]>) => (table: unknown) => ({
        where: async (condition: unknown) => {
            // biome-ignore lint/suspicious/noExplicitAny: drizzle table at runtime
            const name = getTableName(table as any);
            wheres.set(name, [...(wheres.get(name) ?? []), condition]);
            return rowsByTable.get(name) ?? [];
        }
    });

    const suspectRows = new Map<string, unknown[]>([['billing_subscriptions', scenario.suspects]]);
    const moneyRows = new Map<string, unknown[]>([
        ['billing_payments', (scenario.paidIds ?? []).map((id) => ({ subscriptionId: id }))],
        [
            'billing_orphan_payments',
            (scenario.orphanIds ?? []).map((id) => ({ subscriptionId: id }))
        ],
        [
            'billing_subscription_events',
            (scenario.movedIds ?? []).map((id) => ({ subscriptionId: id }))
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

    /**
     * The rendered SQL + params of the WHERE issued against `table`.
     *
     * Renders through the real Postgres dialect, so an assertion is about the
     * statement the migration actually built — the only way a clause that lives
     * inside a query can be tested without a database.
     */
    const sqlOf = (table: string, index = 0): { text: string; params: readonly unknown[] } => {
        const condition = (wheres.get(table) ?? [])[index];
        // biome-ignore lint/suspicious/noExplicitAny: dialect takes a drizzle SQL node
        const query = new PgDialect().sqlToQuery(condition as any);
        return { text: query.sql, params: query.params };
    };

    return { ctx: { db } as unknown as SeedMigrationCtx, updatedIds, sqlOf };
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

    // ── The WHERE itself ─────────────────────────────────────────────────────
    //
    // Conditions 1, 2 and 4 live ENTIRELY inside `.where(...)`, and the fake above
    // hands back its scenario rows regardless of the condition. So a test that
    // only inspects the returned rows cannot see them: deleting
    // `inArray(status, CANCELLATION_SPELLINGS)` or `hasLinkedPreapprovalCondition()`
    // from the production file left this suite 7/7 green. These assert the
    // rendered statement instead — and at operator level, per the same lesson the
    // `@repo/db` predicate test records.

    it('CONDITION 1: the candidate SELECT filters on BOTH cancellation spellings', async () => {
        const { ctx, sqlOf } = makeCtx({ suspects: [suspect('sub-a')] });

        await up(ctx);
        const { text, params } = sqlOf('billing_subscriptions');

        expect(text).toContain('"status" in');
        // Both, as bound params. `extras/035` folds the spelling on every deploy,
        // so which one a live row shows depends on deploy timing — matching one
        // would miss the other.
        expect(params).toContain('cancelled');
        expect(params).toContain('canceled');
    });

    it('CONDITION 2: the candidate SELECT requires a preapproval, empty string excluded', async () => {
        const { ctx, sqlOf } = makeCtx({ suspects: [suspect('sub-a')] });

        await up(ctx);
        const { text } = sqlOf('billing_subscriptions');

        // Operator-level, not silhouette: `IS NOT NULL` alone would admit the `''`
        // rows that mean "no preapproval at all".
        expect(text).toContain('"mp_subscription_id" is not null');
        expect(text).toContain('"mp_subscription_id" <> ');
    });

    it('CONDITION 4: the events lookup asks for transitions OUT of the pending statuses', async () => {
        const { ctx, sqlOf } = makeCtx({ suspects: [suspect('sub-a')] });

        await up(ctx);
        const { text, params } = sqlOf('billing_subscription_events');

        // `NOT IN` over the pending set, plus the NULL arm — an event whose
        // new_status is unknown must exclude the row, not be ignored.
        expect(text).toContain('"new_status" is null');
        expect(text).toContain('"new_status" not in');
        expect(params).toContain('incomplete');
        expect(params).toContain('pending_provider');
    });

    it('relabels BOTH cancellation spellings', async () => {
        const { ctx, updatedIds } = makeCtx({
            suspects: [suspect('sub-american', 'canceled'), suspect('sub-british', 'cancelled')]
        });

        await up(ctx);

        expect(updatedIds).toEqual(['sub-american', 'sub-british']);
    });

    // ── Condition 4's decision ───────────────────────────────────────────────

    // The false positive condition 3 cannot stop: MercadoPago charged, the webhook
    // answered 200 without writing the ledger row (the HOS-765 class), the customer
    // got nothing, complained and cancelled. Zero payments, zero orphans — but the
    // SUBSCRIPTION did activate, and that transition is recorded in the same
    // transaction that performed it.
    it('HOLDS BACK a paid customer whose payment row was never written, on the transition record alone', async () => {
        const { ctx, updatedIds } = makeCtx({
            suspects: [suspect('sub-abandoned'), suspect('sub-paid-but-unrecorded')],
            // deliberately NO paidIds and NO orphanIds — that is the scenario
            movedIds: ['sub-paid-but-unrecorded']
        });

        const result = await up(ctx);

        expect(updatedIds).toEqual(['sub-abandoned']);
        expect(updatedIds).not.toContain('sub-paid-but-unrecorded');
        expect(result.counts?.heldBackByHistory).toBe(1);
        expect(result.counts?.heldBackByPayments).toBe(0);
    });

    // The second shape, with no broken webhook at all: an authorised preapproval
    // is reported `trialing` while trial_end is in the future, and such a row can
    // legitimately have zero payments. Production holds three today.
    it('HOLDS BACK a trialing-then-cancelled row that never had a payment', async () => {
        const { ctx, updatedIds } = makeCtx({
            suspects: [suspect('sub-trialing-cancelled')],
            movedIds: ['sub-trialing-cancelled']
        });

        const result = await up(ctx);

        expect(updatedIds).toEqual([]);
        expect(result.counts?.relabelled).toBe(0);
        expect(result.counts?.heldBackByHistory).toBe(1);
    });

    it('reports the two exclusion reasons separately', async () => {
        const { ctx } = makeCtx({
            suspects: [suspect('sub-money'), suspect('sub-history'), suspect('sub-clean')],
            paidIds: ['sub-money'],
            movedIds: ['sub-history']
        });

        const result = await up(ctx);

        expect(result.counts?.heldBackByPayments).toBe(1);
        expect(result.counts?.heldBackByHistory).toBe(1);
        expect(result.counts?.heldBackTotal).toBe(2);
        expect(result.counts?.relabelled).toBe(1);
        // Named, so the deploy log can be audited rather than trusted.
        expect(result.summary).toContain('sub-money');
        expect(result.summary).toContain('sub-history');
    });

    it('writes nothing, and says so distinguishably, when there are no suspects', async () => {
        const { ctx, updatedIds } = makeCtx({ suspects: [] });

        const result = await up(ctx);

        expect(updatedIds).toEqual([]);
        expect(result.counts).toEqual({
            suspects: 0,
            relabelled: 0,
            heldBackByPayments: 0,
            heldBackByHistory: 0,
            heldBackTotal: 0
        });
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
