/**
 * Static guard for the add-on preapproval uniqueness index (HOS-847 PR 7c).
 *
 * Subject: `packages/db/src/migrations/extras/041-hos847-addon-purchases-mp-id-unique.index.sql`
 *
 * ## Why a SOURCE-level guard and not an introspection test
 *
 * The sibling migration tests in this directory introspect a live PostgreSQL
 * and skip themselves via `isDbAvailable()` when there is none. A skipped test
 * reports success, so it cannot defend an invariant in CI. This guard reads the
 * SQL file itself and therefore runs everywhere, always.
 *
 * ## What it defends
 *
 * The index is what makes `findRecurringAddonPurchaseByPreapprovalId`'s
 * `limit(1)`-with-no-ordering safe: it is how the MercadoPago webhook decides
 * an incoming charge belongs to an add-on rather than a plan, and with two rows
 * claiming one preapproval it picks one arbitrarily.
 *
 * Two properties would silently destroy that, and both are the kind of thing a
 * hurried fix adds when the extras run aborts in production:
 *
 * 1. **Making the index non-unique or non-partial.** A non-unique index
 *    enforces nothing; a non-partial UNIQUE collapses every NULL row (all
 *    one-time add-ons) into one collision and cannot be created at all.
 * 2. **Auto-dedup.** Deleting or mutating a row to force the CREATE through
 *    destroys the evidence of which real charge belongs to which customer. The
 *    CREATE must fail LOUDLY instead — that failure is the feature.
 *
 * The destructive-statement scan runs over the SQL with comments STRIPPED, so
 * the file's own prose explaining why it does not delete anything cannot trip
 * its own guard — and equally, a `DELETE` cannot hide by being described in a
 * comment somewhere above it.
 *
 * @module test/migrations/addon-purchases-mp-id-unique.guard
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
    import.meta.dirname,
    '../../src/migrations/extras/041-hos847-addon-purchases-mp-id-unique.index.sql'
);

/** The file as written, comments and all. */
const rawSql = readFileSync(MIGRATION_PATH, 'utf-8');

/**
 * The file with `--` line comments removed, so prose about a statement is never
 * mistaken for the statement (and vice versa).
 */
const executableSql = rawSql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

/**
 * Statements that would turn a loud failure into silent data loss. Matched as
 * whole words, case-insensitively, so `Delete`, `delete` and a mid-line
 * `; DELETE FROM ...` are all caught — a guard anchored on one spelling lets
 * the other four through.
 */
const DESTRUCTIVE_STATEMENTS = [
    'DELETE',
    'TRUNCATE',
    'UPDATE',
    'DROP',
    'ALTER',
    'ON CONFLICT',
    'INSERT'
] as const;

describe('041 add-on purchases mp_subscription_id unique index', () => {
    it('creates a UNIQUE index — a plain index would enforce nothing', () => {
        expect(executableSql).toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
    });

    it('is idempotent, as the whole extras carril must be', () => {
        expect(executableSql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS/i);
    });

    it('targets billing_addon_purchases (mp_subscription_id)', () => {
        expect(executableSql).toMatch(
            /ON\s+billing_addon_purchases\s*\(\s*mp_subscription_id\s*\)/i
        );
    });

    it('is PARTIAL on mp_subscription_id IS NOT NULL', () => {
        // Without the predicate the index cannot even be created: every
        // one-time add-on carries a NULL here.
        expect(executableSql).toMatch(/WHERE\s+mp_subscription_id\s+IS\s+NOT\s+NULL/i);
    });

    it('is not CONCURRENTLY — the extras carril applies files inside a transaction', () => {
        expect(executableSql).not.toMatch(/CONCURRENTLY/i);
    });

    it.each(
        DESTRUCTIVE_STATEMENTS
    )('contains no %s: a duplicate preapproval id must fail loudly, never be deduped', (statement) => {
        const pattern = new RegExp(`\\b${statement.replace(/ /g, '\\s+')}\\b`, 'i');
        expect(
            pattern.test(executableSql),
            `${MIGRATION_PATH} contains a "${statement}" statement.\nThis file must do exactly one thing: CREATE the partial unique index. A duplicate mp_subscription_id means two purchase rows claim one real MercadoPago preapproval — money already charged, with no way to tell from the rows alone which customer's benefit it paid for. The CREATE failing is how a human finds out. Removing or mutating a row to force it through destroys that evidence.`
        ).toBe(false);
    });

    it('still explains, in prose, why it refuses to dedup', () => {
        // The rule above is enforceable; the reason for it is not, and a future
        // reader hitting a failed extras run needs it. Losing the explanation is
        // how the rule gets "fixed" away.
        expect(rawSql).toMatch(/No auto-dedup/i);
    });
});
