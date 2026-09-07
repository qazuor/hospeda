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

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    return { sql: rendered.sql.toLowerCase(), params: rendered.params };
}

describe('findExpiredAddons — the soft-cancel window (HOS-847 PR 6)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('still sweeps a one-time add-on that ran out', async () => {
        const { sql } = await renderExpiredWhere();

        expect(sql).toContain('"expires_at" is not null');
        expect(sql).toContain('"expires_at" <=');
    });

    it('also sweeps a soft-cancelled recurring add-on past its paid period', async () => {
        const { sql } = await renderExpiredWhere();

        expect(sql).toContain('"cancel_at_period_end"');
        expect(sql).toContain('"current_period_end" is not null');
        expect(sql).toContain('"current_period_end" <=');
        // The two are alternatives, not extra requirements: a one-time add-on has
        // no `current_period_end` and would otherwise never be swept again.
        expect(sql).toContain(' or ');
    });

    it('REQUIRES the flag alongside the date, never the date alone', async () => {
        const { sql, params } = await renderExpiredWhere();

        // The dangerous mutation is dropping the flag and keeping the date. It
        // is invisible in staging (nothing is soft-cancelled yet) and revokes a
        // paying customer's add-on the first time a renewal webhook is late.
        const periodEndClause = sql.slice(sql.indexOf('"cancel_at_period_end"'));
        expect(periodEndClause).toContain('"current_period_end"');
        expect(params).toContain(true);
    });

    it('keeps the sweep scoped to live, undeleted rows', async () => {
        const { sql, params } = await renderExpiredWhere();

        // Both branches sit under the same status/deleted guard; losing it would
        // re-expire rows that are already terminal.
        expect(sql).toContain('"deleted_at" is null');
        expect(params).toContain('active');
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
