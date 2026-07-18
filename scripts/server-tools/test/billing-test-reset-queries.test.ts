/**
 * Unit tests for `src/commands/billing-test-reset-queries.ts`.
 *
 * `buildResetTransaction` is a pure string-builder (no I/O) so its SQL
 * output — including FK-safe ordering and the new
 * `commerce_listing_subscriptions` / `featured_listing_addon_grants` /
 * `accommodations` statements — is fully unit-testable. `discoverTarget`,
 * `countAffected`, and `countFeaturedAccommodations` shell out to
 * `docker exec ... psql` and are not covered here.
 */

import { describe, expect, it } from 'bun:test';
import {
    buildCountAffectedQuery,
    buildResetTransaction
} from '../src/commands/billing-test-reset-queries.ts';

const CUSTOMER_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

/** Index of the first line matching `needle`, or -1 if absent. */
function lineIndex(sql: string, needle: string): number {
    return sql.split('\n').findIndex((line) => line.includes(needle));
}

/** Table names targeted by every `DELETE FROM <table>` in `sql`. */
function deletedTables(sql: string): Set<string> {
    const tables = new Set<string>();
    for (const match of sql.matchAll(/DELETE FROM (\w+)/g)) {
        const table = match[1];
        if (table) {
            tables.add(table);
        }
    }
    return tables;
}

/** Table names counted by every `count(*) FROM <table>` in `sql`. */
function countedTables(sql: string): Set<string> {
    const tables = new Set<string>();
    for (const match of sql.matchAll(/count\(\*\) FROM (\w+)/g)) {
        const table = match[1];
        if (table) {
            tables.add(table);
        }
    }
    return tables;
}

describe('buildResetTransaction(params)', () => {
    describe('transaction envelope', () => {
        it('starts with BEGIN and ends with COMMIT', () => {
            const sql = buildResetTransaction({
                customerId: CUSTOMER_ID,
                userId: USER_ID,
                deleteUser: false
            });
            const lines = sql.split('\n');
            expect(lines[0]).toBe('BEGIN;');
            expect(lines.at(-1)).toBe('COMMIT;');
        });
    });

    describe('customerId is null (no linked billing_customers row)', () => {
        it('emits no billing_* deletes', () => {
            const sql = buildResetTransaction({
                customerId: null,
                userId: USER_ID,
                deleteUser: false
            });
            expect(sql).not.toContain('billing_subscriptions');
            expect(sql).not.toContain('billing_customers');
        });

        it('still emits the accommodations UPDATE scoped by owner_id', () => {
            const sql = buildResetTransaction({
                customerId: null,
                userId: USER_ID,
                deleteUser: false
            });
            expect(sql).toContain(
                `UPDATE accommodations SET featured_by_entitlement = false, is_featured = false`
            );
            expect(sql).toContain(`owner_id = '${USER_ID}'`);
        });
    });

    describe('new tables added by this change', () => {
        const sql = buildResetTransaction({
            customerId: CUSTOMER_ID,
            userId: USER_ID,
            deleteUser: false
        });

        it('deletes commerce_listing_subscriptions scoped by subscription_id subquery', () => {
            expect(sql).toContain('DELETE FROM commerce_listing_subscriptions');
            expect(sql).toContain(
                `WHERE subscription_id IN (SELECT id FROM billing_subscriptions WHERE customer_id = '${CUSTOMER_ID}')`
            );
        });

        it('deletes featured_listing_addon_grants scoped by purchase_id subquery', () => {
            expect(sql).toContain('DELETE FROM featured_listing_addon_grants');
            expect(sql).toContain(
                `WHERE purchase_id IN (SELECT id FROM billing_addon_purchases WHERE customer_id = '${CUSTOMER_ID}')`
            );
        });

        it('updates accommodations featured flags scoped by owner_id', () => {
            expect(sql).toContain(
                `UPDATE accommodations SET featured_by_entitlement = false, is_featured = false, updated_at = NOW() WHERE owner_id = '${USER_ID}'`
            );
        });
    });

    describe('FK-safe ordering: children before parents', () => {
        const sql = buildResetTransaction({
            customerId: CUSTOMER_ID,
            userId: USER_ID,
            deleteUser: false
        });

        it('deletes commerce_listing_subscriptions before billing_subscriptions', () => {
            const childIdx = lineIndex(sql, 'DELETE FROM commerce_listing_subscriptions');
            const parentIdx = lineIndex(sql, 'DELETE FROM billing_subscriptions WHERE customer_id');
            expect(childIdx).toBeGreaterThan(-1);
            expect(parentIdx).toBeGreaterThan(-1);
            expect(childIdx).toBeLessThan(parentIdx);
        });

        it('deletes featured_listing_addon_grants before billing_addon_purchases', () => {
            const childIdx = lineIndex(sql, 'DELETE FROM featured_listing_addon_grants');
            const parentIdx = lineIndex(sql, 'DELETE FROM billing_addon_purchases');
            expect(childIdx).toBeGreaterThan(-1);
            expect(parentIdx).toBeGreaterThan(-1);
            expect(childIdx).toBeLessThan(parentIdx);
        });

        it('deletes billing_customers last among the customer-scoped deletes (with --delete-user)', () => {
            // HOS-202: billing_customers is only deleted when the whole user is
            // removed, so this ordering only applies with deleteUser: true.
            const sqlWithUser = buildResetTransaction({
                customerId: CUSTOMER_ID,
                userId: USER_ID,
                deleteUser: true
            });
            const customersIdx = lineIndex(sqlWithUser, 'DELETE FROM billing_customers WHERE id');
            const subsIdx = lineIndex(
                sqlWithUser,
                'DELETE FROM billing_subscriptions WHERE customer_id'
            );
            const addonPurchasesIdx = lineIndex(sqlWithUser, 'DELETE FROM billing_addon_purchases');
            expect(customersIdx).toBeGreaterThan(subsIdx);
            expect(customersIdx).toBeGreaterThan(addonPurchasesIdx);
        });

        it('runs the accommodations UPDATE after billing_customers is deleted (with --delete-user)', () => {
            const sqlWithUser = buildResetTransaction({
                customerId: CUSTOMER_ID,
                userId: USER_ID,
                deleteUser: true
            });
            const customersIdx = lineIndex(sqlWithUser, 'DELETE FROM billing_customers WHERE id');
            const accommodationsIdx = lineIndex(sqlWithUser, 'UPDATE accommodations SET');
            expect(accommodationsIdx).toBeGreaterThan(customersIdx);
        });
    });

    describe('regression: FK ordering + preview/execute sync (C1/C2/W1/W2)', () => {
        const sql = buildResetTransaction({
            customerId: CUSTOMER_ID,
            userId: USER_ID,
            deleteUser: false
        });

        it('C2: deletes billing_checkouts before billing_payments and billing_subscriptions', () => {
            const checkoutsIdx = lineIndex(sql, 'DELETE FROM billing_checkouts');
            const paymentsIdx = lineIndex(sql, 'DELETE FROM billing_payments WHERE customer_id');
            const subsIdx = lineIndex(sql, 'DELETE FROM billing_subscriptions WHERE customer_id');
            expect(checkoutsIdx).toBeGreaterThan(-1);
            expect(paymentsIdx).toBeGreaterThan(-1);
            expect(subsIdx).toBeGreaterThan(-1);
            // billing_checkouts.payment_id / .subscription_id are ON DELETE
            // no action, so the checkout rows must be deleted first.
            expect(checkoutsIdx).toBeLessThan(paymentsIdx);
            expect(checkoutsIdx).toBeLessThan(subsIdx);
        });

        it('C1: never issues a direct DELETE against billing_usage_records', () => {
            // billing_usage_records has no customer_id column; it is removed
            // via ON DELETE cascade when billing_subscriptions rows go.
            expect(sql).not.toContain('DELETE FROM billing_usage_records');
            expect(sql).not.toContain('billing_usage_records WHERE customer_id');
        });

        it('W1: scopes billing_audit_logs by customer + child subscription/payment/invoice ids', () => {
            const auditLine = sql
                .split('\n')
                .find((line) => line.includes('DELETE FROM billing_audit_logs'));
            expect(auditLine).toBeDefined();
            const line = auditLine as string;
            expect(line).toContain(`entity_id = '${CUSTOMER_ID}'`);
            expect(line).toContain(
                `entity_id IN (SELECT id FROM billing_subscriptions WHERE customer_id = '${CUSTOMER_ID}')`
            );
            expect(line).toContain(
                `entity_id IN (SELECT id FROM billing_payments WHERE customer_id = '${CUSTOMER_ID}')`
            );
            expect(line).toContain(
                `entity_id IN (SELECT id FROM billing_invoices WHERE customer_id = '${CUSTOMER_ID}')`
            );
        });

        it('W1: deletes billing_audit_logs before the child rows its subqueries read', () => {
            const auditIdx = lineIndex(sql, 'DELETE FROM billing_audit_logs');
            const subsIdx = lineIndex(sql, 'DELETE FROM billing_subscriptions WHERE customer_id');
            const paymentsIdx = lineIndex(sql, 'DELETE FROM billing_payments WHERE customer_id');
            const invoicesIdx = lineIndex(sql, 'DELETE FROM billing_invoices WHERE customer_id');
            expect(auditIdx).toBeGreaterThan(-1);
            expect(auditIdx).toBeLessThan(subsIdx);
            expect(auditIdx).toBeLessThan(paymentsIdx);
            expect(auditIdx).toBeLessThan(invoicesIdx);
        });

        it('W2: the preview counts EXACTLY the tables the execute deletes', () => {
            const previewSql = buildCountAffectedQuery(CUSTOMER_ID);
            const counted = countedTables(previewSql);
            const deleted = deletedTables(sql);
            // billing_customers is not among the customer-scoped deletes on a
            // plain reset (the shell is preserved — HOS-202) and is shown
            // separately in the preview, so exclude it from the compare either way.
            deleted.delete('billing_customers');
            expect([...counted].sort()).toEqual([...deleted].sort());
        });
    });

    describe('--delete-user', () => {
        it('appends DELETE FROM users as the last statement before COMMIT', () => {
            const sql = buildResetTransaction({
                customerId: CUSTOMER_ID,
                userId: USER_ID,
                deleteUser: true
            });
            const lines = sql.split('\n');
            expect(lines.at(-2)).toBe(`DELETE FROM users WHERE id = '${USER_ID}';`);
        });

        it('omits DELETE FROM users when deleteUser is false', () => {
            const sql = buildResetTransaction({
                customerId: CUSTOMER_ID,
                userId: USER_ID,
                deleteUser: false
            });
            expect(sql).not.toContain('DELETE FROM users');
        });
    });

    describe('HOS-202: billing_customers shell preservation', () => {
        it('preserves the billing_customers shell on a plain reset (no --delete-user)', () => {
            const sql = buildResetTransaction({
                customerId: CUSTOMER_ID,
                userId: USER_ID,
                deleteUser: false
            });
            // The shell is created once at signup and never recreated, so a
            // plain reset must keep it or the user cannot checkout afterwards.
            expect(sql).not.toContain('DELETE FROM billing_customers');
            // The transactional child tables are still purged.
            expect(sql).toContain(
                `DELETE FROM billing_subscriptions WHERE customer_id = '${CUSTOMER_ID}';`
            );
        });

        it('deletes the billing_customers shell only when --delete-user is set', () => {
            const sql = buildResetTransaction({
                customerId: CUSTOMER_ID,
                userId: USER_ID,
                deleteUser: true
            });
            expect(sql).toContain(`DELETE FROM billing_customers WHERE id = '${CUSTOMER_ID}';`);
            // ...and it precedes the DELETE FROM users so the shell is gone
            // before the user row it belongs to.
            const customersIdx = lineIndex(sql, 'DELETE FROM billing_customers WHERE id');
            const usersIdx = lineIndex(sql, 'DELETE FROM users WHERE id');
            expect(customersIdx).toBeLessThan(usersIdx);
        });
    });

    describe('SQL string escaping', () => {
        it('escapes single quotes in customerId and userId', () => {
            const sql = buildResetTransaction({
                customerId: "abc'; DROP TABLE users; --",
                userId: "def'gh",
                deleteUser: true
            });
            expect(sql).toContain("abc''; DROP TABLE users; --");
            expect(sql).toContain("def''gh");
        });
    });
});
