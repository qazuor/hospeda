/**
 * SQL discovery/count/transaction builders for `hops billing-test-reset`.
 *
 * Split out of `billing-test-reset.ts` to keep that file under the
 * project's 500-line-per-file limit. These functions do the actual
 * `docker exec ... psql` I/O and SQL string assembly; the parent command
 * module owns argv parsing, safety guards, and the confirm/execute flow.
 *
 * @module commands/billing-test-reset-queries
 */

import { runInContainer } from '../lib/docker.ts';
import { die } from '../lib/log.ts';

/** A resolved Better Auth user + optionally linked billing customer. */
export interface DiscoveredEntity {
    readonly userId: string;
    readonly userEmail: string;
    readonly customerId: string | null;
}

/**
 * Resolves a Hospeda signup user by email and, if present, the linked
 * `billing_customers` row (via `external_id = users.id::text`).
 *
 * @returns `null` when no user matches (caller `die()`s), a
 *   {@link DiscoveredEntity} otherwise. `customerId` is `null` when the
 *   user has no linked billing customer.
 */
export async function discoverTarget(params: {
    container: string;
    user: string;
    db: string;
    email: string;
}): Promise<DiscoveredEntity | null> {
    const escapedEmail = params.email.replace(/'/g, "''");
    const query = `
SELECT
    u.id::text       AS user_id,
    u.email          AS user_email,
    bc.id::text      AS customer_id
FROM users u
LEFT JOIN billing_customers bc ON bc.external_id = u.id::text
WHERE u.email = '${escapedEmail}';
`.trim();

    const result = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', params.db, '-t', '-A', '-F', '|', '-c', query]
    });
    if (result.exitCode !== 0) {
        die(result.stderr.trim() || `psql exited ${result.exitCode}`);
        return null;
    }
    const rows = result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (rows.length === 0) {
        return null;
    }
    if (rows.length > 1) {
        die(
            `Found ${rows.length} users with email ${params.email}. Refusing to operate ambiguously.`
        );
        return null;
    }
    const row = rows[0];
    if (!row) {
        return null;
    }
    const [userId, userEmail, customerId] = row.split('|');
    if (!userId || !userEmail) {
        die(`Malformed psql output row for email ${params.email}: "${row}"`);
        return null;
    }
    return { userId, userEmail, customerId: customerId || null };
}

/** Row count for one table in the reset preview. */
export interface RowCount {
    readonly table: string;
    readonly count: number;
}

/**
 * One customer-scoped billing table to purge, paired with the boolean SQL
 * predicate (no leading `WHERE`) that scopes its rows to a single customer.
 */
interface CustomerScopedDelete {
    readonly table: string;
    readonly where: string;
}

/**
 * Single source of truth for the customer-scoped billing tables the reset
 * touches. Both the preview counter ({@link countAffected}) and the
 * destructive transaction ({@link buildResetTransaction}) derive their SQL
 * from this one ordered list, so the two can never drift — every table
 * counted is deleted and vice-versa.
 *
 * The order is FK-safe for the DELETE path: children precede parents, and
 * rows referenced by a later statement's subquery are still present when an
 * earlier statement needs them.
 *   - `billing_audit_logs` runs FIRST: it is polymorphic
 *     `(entity_type, entity_id)` with NO `customer_id`, so it must resolve
 *     the customer's subscription/payment/invoice ids via subquery BEFORE
 *     those rows are deleted.
 *   - `billing_checkouts` runs before `billing_payments` and
 *     `billing_subscriptions`: its `payment_id` / `subscription_id` FKs are
 *     `ON DELETE no action` (non-deferrable), so the checkout rows must go
 *     first or the parent deletes raise a FK violation.
 *   - `billing_refunds` before `billing_payments`,
 *     `commerce_listing_subscriptions` before `billing_subscriptions`,
 *     `featured_listing_addon_grants` before `billing_addon_purchases`.
 *
 * `billing_customers` is intentionally NOT in this list — it is the parent
 * row (always exactly one), deleted last by {@link buildResetTransaction}
 * and shown separately in the preview.
 *
 * @param cid - The customer id, already single-quote-escaped by the caller.
 */
function customerScopedDeletes(cid: string): readonly CustomerScopedDelete[] {
    const subsSub = `(SELECT id FROM billing_subscriptions WHERE customer_id = '${cid}')`;
    const paymentsSub = `(SELECT id FROM billing_payments WHERE customer_id = '${cid}')`;
    const invoicesSub = `(SELECT id FROM billing_invoices WHERE customer_id = '${cid}')`;
    const purchasesSub = `(SELECT id FROM billing_addon_purchases WHERE customer_id = '${cid}')`;
    return [
        {
            table: 'billing_audit_logs',
            where: `entity_id = '${cid}' OR entity_id IN ${subsSub} OR entity_id IN ${paymentsSub} OR entity_id IN ${invoicesSub}`
        },
        { table: 'billing_subscription_polling_jobs', where: `subscription_id IN ${subsSub}` },
        { table: 'billing_subscription_addons', where: `subscription_id IN ${subsSub}` },
        { table: 'billing_subscription_events', where: `subscription_id IN ${subsSub}` },
        { table: 'billing_dunning_attempts', where: `customer_id = '${cid}'` },
        { table: 'billing_invoice_payments', where: `invoice_id IN ${invoicesSub}` },
        { table: 'billing_invoice_lines', where: `invoice_id IN ${invoicesSub}` },
        { table: 'billing_checkouts', where: `customer_id = '${cid}'` },
        { table: 'billing_invoices', where: `customer_id = '${cid}'` },
        { table: 'billing_refunds', where: `payment_id IN ${paymentsSub}` },
        { table: 'billing_payments', where: `customer_id = '${cid}'` },
        { table: 'billing_payment_methods', where: `customer_id = '${cid}'` },
        { table: 'commerce_listing_subscriptions', where: `subscription_id IN ${subsSub}` },
        { table: 'billing_subscriptions', where: `customer_id = '${cid}'` },
        { table: 'featured_listing_addon_grants', where: `purchase_id IN ${purchasesSub}` },
        { table: 'billing_addon_purchases', where: `customer_id = '${cid}'` },
        { table: 'billing_customer_entitlements', where: `customer_id = '${cid}'` },
        { table: 'billing_customer_limits', where: `customer_id = '${cid}'` },
        { table: 'billing_promo_code_usage', where: `customer_id = '${cid}'` },
        { table: 'billing_notification_log', where: `customer_id = '${cid}'` }
    ];
}

/**
 * Builds the `WITH counts AS (...)` preview query for one customer id
 * (already single-quote-escaped). Pure string builder — no I/O — so the
 * preview SQL, and specifically the fact that it counts EXACTLY the same
 * table set {@link buildResetTransaction} deletes, is unit-testable.
 */
export function buildCountAffectedQuery(cid: string): string {
    const unionParts = customerScopedDeletes(cid).map(
        (d) =>
            `SELECT '${d.table}' AS table_name, (SELECT count(*) FROM ${d.table} WHERE ${d.where}) AS row_count`
    );
    return `
WITH counts AS (
    ${unionParts.join('\n    UNION ALL ')}
)
SELECT table_name, row_count FROM counts WHERE row_count > 0 ORDER BY table_name;
`.trim();
}

/**
 * Counts rows that would be deleted across every customer-scoped billing
 * table listed in {@link customerScopedDeletes} — the exact same set the
 * destructive transaction removes, so the preview never undercounts. Only
 * rows with `count > 0` are returned. `billing_customers` itself is not
 * counted here (it is always exactly one and shown separately).
 */
export async function countAffected(params: {
    container: string;
    user: string;
    db: string;
    customerId: string;
}): Promise<RowCount[]> {
    const cid = params.customerId.replace(/'/g, "''");
    const query = buildCountAffectedQuery(cid);

    const result = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', params.db, '-t', '-A', '-F', '|', '-c', query]
    });
    if (result.exitCode !== 0) {
        die(result.stderr.trim() || `psql exited ${result.exitCode}`);
        return [];
    }
    return result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .flatMap((line) => {
            const [table, count] = line.split('|');
            return table ? [{ table, count: Number(count) || 0 }] : [];
        });
}

/**
 * Counts accommodations owned by `userId` that currently have either
 * entitlement-driven featured flag set. Scoped by ownership rather than
 * `customerId` because the self-service `isFeatured` toggle (SPEC-309
 * T-019/T-020) requires a live entitlement but the flag itself lives on
 * `accommodations`, independent of whether the `billing_customers` row
 * still exists.
 */
export async function countFeaturedAccommodations(params: {
    container: string;
    user: string;
    db: string;
    userId: string;
}): Promise<number> {
    const uid = params.userId.replace(/'/g, "''");
    const query = `
SELECT count(*) FROM accommodations
 WHERE owner_id = '${uid}' AND (featured_by_entitlement = true OR is_featured = true);
`.trim();

    const result = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', params.db, '-t', '-A', '-c', query]
    });
    if (result.exitCode !== 0) {
        die(result.stderr.trim() || `psql exited ${result.exitCode}`);
        return 0;
    }
    return Number(result.stdout.trim()) || 0;
}

/**
 * SQL transaction body. The customer-scoped deletes are emitted from the
 * shared {@link customerScopedDeletes} list (same set the preview counts),
 * ordered so children precede parents and every FK stays satisfied even for
 * FKs that are NOT `ON DELETE CASCADE`:
 *   - `billing_audit_logs` first (polymorphic, resolves child ids via
 *     subquery before those children are deleted).
 *   - `billing_checkouts` before `billing_payments` / `billing_subscriptions`
 *     (its FKs are `ON DELETE no action`).
 *   - `commerce_listing_subscriptions` before `billing_subscriptions`,
 *     `featured_listing_addon_grants` before `billing_addon_purchases`.
 * `billing_usage_records` is NOT deleted directly: its only scope is
 * `subscription_id` (it has no `customer_id` column) and its FK to
 * `billing_subscriptions` is `ON DELETE cascade`, so it is removed
 * automatically when the subscriptions rows go.
 * `billing_customers` (the parent shell) is deleted last, but ONLY when
 * `deleteUser` is set (HOS-202) — a plain reset preserves it so the user can
 * still checkout afterwards. The accommodations UPDATE runs unconditionally
 * (scoped by owner_id, not customerId) so it also fires when the user has no
 * billing_customers row at all.
 */
export function buildResetTransaction(params: {
    customerId: string | null;
    userId: string;
    deleteUser: boolean;
}): string {
    const cid = params.customerId?.replace(/'/g, "''");
    const uid = params.userId.replace(/'/g, "''");
    const lines: string[] = ['BEGIN;'];

    if (cid) {
        for (const d of customerScopedDeletes(cid)) {
            lines.push(`DELETE FROM ${d.table} WHERE ${d.where};`);
        }
        // HOS-202: preserve the billing_customers shell on a plain reset. The
        // row is created ONCE at signup (the `user.create.after` Better Auth
        // hook) and is never recreated for an existing user, so deleting it
        // without --delete-user leaves the user unable to checkout
        // ("No billing account found", 400). It is account infrastructure, not
        // smoke state. Only drop it when the whole user is being removed anyway.
        if (params.deleteUser) {
            lines.push(`DELETE FROM billing_customers WHERE id = '${cid}';`);
        }
    }

    lines.push(
        `UPDATE accommodations SET featured_by_entitlement = false, is_featured = false, updated_at = NOW() WHERE owner_id = '${uid}' AND (featured_by_entitlement = true OR is_featured = true);`
    );

    if (params.deleteUser) {
        lines.push(`DELETE FROM users WHERE id = '${uid}';`);
    }

    lines.push('COMMIT;');
    return lines.join('\n');
}
