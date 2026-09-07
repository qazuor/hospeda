/**
 * `findExpiredAddons` and the soft-cancelled recurring add-on (HOS-847 PR 6).
 *
 * ## Why this file uses the REAL drizzle-orm and renders the SQL
 *
 * Its sibling `addon-expiration.queries.test.ts` replaces every operator with a
 * stub, which is right for what that file asserts (ctx routing, error handling)
 * and useless for what this one does: a stubbed `and`/`or`/`eq` cannot tell a
 * correct predicate from a catastrophic one. So this suite keeps the real
 * operators and the real table, captures the `where(...)` argument, and renders
 * it through Drizzle's own `PgDialect` — the SQL that actually reaches Postgres.
 *
 * ## What is and is not proven here
 *
 * Postgres performs the date comparison, and there is no Postgres in a unit
 * test. What IS proven: the exact SQL Postgres will be given, and — by reading
 * the comparison direction out of that SQL and the bound instant out of its
 * parameters — which side of the boundary a given row falls on. A mutation that
 * flips `<=` to `>=`, drops a branch, or binds a different instant changes the
 * rendered query and fails here. What is NOT proven is Postgres's own semantics,
 * which is not this repo's to test.
 *
 * ## The predicate this protects, and the accident it prevents
 *
 * Expiring a purchase REVOKES the customer's entitlement and limit. A live
 * recurring add-on that is still being charged has a `current_period_end` in the
 * past every time its renewal webhook is late — the charge lands, then the
 * period advances. So a sweep keyed on the DATE ALONE would revoke a paying
 * customer's add-on whenever MercadoPago was slow, silently and at scale.
 * `cancel_at_period_end = true` is the only thing standing between those two
 * cases, and it is the thing these tests are here to keep.
 *
 * @module test/billing/addon-expiration.soft-cancel-window
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));

// Only `getDb` is mocked. `@repo/db/schemas` and `drizzle-orm` stay REAL, which
// is the whole point: the rendered SQL has to come from the same operators
// production uses.
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    getDb: mockGetDb
}));

import { PgDialect } from 'drizzle-orm/pg-core';
import { findExpiredAddons } from '../../src/services/billing/addon/addon-expiration.queries.js';

/** A fixed "now" so the bound instants are assertable. */
const NOW = new Date('2026-09-07T12:00:00.000Z');

/** Captures the WHERE clause `findExpiredAddons` builds, rendered to SQL. */
async function renderExpiredWhere(): Promise<{ sql: string; params: readonly unknown[] }> {
    let captured: unknown;

    mockGetDb.mockReturnValue({
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(async (condition: unknown) => {
                    captured = condition;
                    return [];
                })
            }))
        }))
    });

    const result = await findExpiredAddons();
    expect(result.success).toBe(true);
    expect(captured).toBeDefined();

    const rendered = new PgDialect().sqlToQuery(captured as never);
    return { sql: rendered.sql, params: rendered.params };
}

/**
 * Answers whether a row would be swept, using ONLY what the rendered query says:
 * the comparison direction is read from the SQL and the boundary instant from
 * the bound parameters. Nothing about the predicate is hardcoded here, so a
 * mutation of either shows up as a different verdict rather than as a test that
 * still agrees with itself.
 *
 * @param rendered - The captured SQL and its parameters.
 * @param row - A candidate `billing_addon_purchases` row.
 * @returns Whether Postgres would return this row for the recurring branch.
 */
function sweepsSoftCancelledRow(
    rendered: { sql: string; params: readonly unknown[] },
    row: { cancelAtPeriodEnd: boolean; currentPeriodEnd: Date | null }
): boolean {
    const { sql, params } = rendered;

    const flagIndex = sql.indexOf('"cancel_at_period_end" = $');
    expect(flagIndex, 'the recurring branch must compare cancel_at_period_end').toBeGreaterThan(-1);
    const requiredFlag =
        params[Number(sql.charAt(flagIndex + '"cancel_at_period_end" = $'.length)) - 1];

    const dateClause = sql.slice(sql.indexOf('"current_period_end" is not null'));
    const comparison = /"current_period_end" (<=|>=|<|>) \$(\d)/.exec(dateClause);
    expect(comparison, 'the recurring branch must compare current_period_end').not.toBeNull();

    const operator = comparison?.[1];
    const boundary = new Date(String(params[Number(comparison?.[2]) - 1]));

    if (row.cancelAtPeriodEnd !== requiredFlag || row.currentPeriodEnd === null) {
        return false;
    }

    return operator === '<=' || operator === '<'
        ? row.currentPeriodEnd <= boundary
        : row.currentPeriodEnd >= boundary;
}

describe('findExpiredAddons — the soft-cancel window (HOS-847 PR 6)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('asks Postgres for exactly the two windows, and nothing else', async () => {
        const { sql, params } = await renderExpiredWhere();

        // The whole predicate, verbatim. Any mutation — a dropped branch, a
        // flipped operator, a lost guard — changes this string.
        expect(sql).toBe(
            '("billing_addon_purchases"."status" = $1 and "billing_addon_purchases"."deleted_at" is null and ' +
                '(("billing_addon_purchases"."expires_at" is not null and "billing_addon_purchases"."expires_at" <= $2) or ' +
                '("billing_addon_purchases"."cancel_at_period_end" = $3 and "billing_addon_purchases"."current_period_end" is not null and ' +
                '"billing_addon_purchases"."current_period_end" <= $4)))'
        );

        // Both windows compare against the query's OWN clock, not a constant.
        expect(params).toEqual(['active', NOW.toISOString(), true, NOW.toISOString()]);
    });

    it('sweeps a soft-cancelled add-on whose paid period has ENDED', async () => {
        const rendered = await renderExpiredWhere();

        expect(
            sweepsSoftCancelledRow(rendered, {
                cancelAtPeriodEnd: true,
                currentPeriodEnd: new Date(NOW.getTime() - 60_000)
            })
        ).toBe(true);
    });

    it('CONTROL: does NOT touch it one minute BEFORE that date', async () => {
        // The customer paid for this period and is still inside it. Sweeping
        // here would revoke the benefit early — the exact outcome the owner
        // rejected when choosing end-of-period cancellation.
        const rendered = await renderExpiredWhere();

        expect(
            sweepsSoftCancelledRow(rendered, {
                cancelAtPeriodEnd: true,
                currentPeriodEnd: new Date(NOW.getTime() + 60_000)
            })
        ).toBe(false);
    });

    it('CONTROL: does NOT touch a PAYING add-on whose renewal webhook is merely late', async () => {
        // Same past date, flag not set. This is the dangerous case: dropping
        // `cancel_at_period_end` from the predicate is invisible in staging,
        // where nothing is soft-cancelled yet, and revokes a paying customer's
        // add-on the first time MercadoPago is slow to report a charge.
        const rendered = await renderExpiredWhere();

        expect(
            sweepsSoftCancelledRow(rendered, {
                cancelAtPeriodEnd: false,
                currentPeriodEnd: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)
            })
        ).toBe(false);
    });

    it('still sweeps a one-time add-on that ran out', async () => {
        const { sql } = await renderExpiredWhere();

        // The two windows are alternatives, not extra requirements: a one-time
        // add-on has no `current_period_end` and would otherwise never be swept.
        expect(sql).toContain('"expires_at" is not null');
        expect(sql).toContain(' or ');
    });

    it('dates the swept row by current_period_end when it has no expires_at', async () => {
        // The mapper falls back `expiresAt ?? currentPeriodEnd ?? new Date()`.
        // A soft-cancelled recurring row takes the middle branch; landing on the
        // final `new Date()` would report "expired today" for a period that
        // ended weeks ago.
        const periodEnd = new Date('2026-09-01T00:00:00.000Z');

        mockGetDb.mockReturnValue({
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(async () => [
                        {
                            id: 'p1',
                            customerId: 'c1',
                            subscriptionId: 's1',
                            addonSlug: 'extra-accommodations-20',
                            purchasedAt: new Date('2026-08-01T00:00:00.000Z'),
                            expiresAt: null,
                            currentPeriodEnd: periodEnd,
                            limitAdjustments: null,
                            entitlementAdjustments: null
                        }
                    ])
                }))
            }))
        });

        const result = await findExpiredAddons();

        expect(result.success).toBe(true);
        expect(result.data?.[0]?.expiresAt).toEqual(periodEnd);
    });
});
