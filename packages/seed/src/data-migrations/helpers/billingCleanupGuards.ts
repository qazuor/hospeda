/**
 * @fileoverview
 * Pre-write safety guards for the HOS-749 production billing cleanup
 * (`0067-hos-749-prod-billing-cleanup`).
 *
 * Split out of the migration itself because these three checks are the part
 * that must be reviewed hardest and re-read whenever someone adds a billing
 * table — keeping them in their own module makes that review a diff on one
 * small file instead of a scroll through a long migration.
 *
 * All three read the LIVE PostgreSQL catalogue (`pg_constraint` /
 * `pg_attribute`, via {@link getInboundForeignKeys}) rather than a
 * hand-maintained table list. A hand list goes stale the moment somebody adds a
 * table, and it goes stale silently — which is exactly the class of failure
 * HOS-712 already produced once, when `0059` assumed a CASCADE that was really
 * a RESTRICT and aborted an entire pending migration batch in production.
 *
 * None of these functions writes anything. Each throws
 * {@link BillingCleanupAbort} on a state it was not written to decide about,
 * so the migration stops instead of guessing.
 *
 * @module data-migrations/helpers/billingCleanupGuards
 */
import { ENTITLEMENT_GRANTING_STATUSES } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingPendingCheckouts,
    commerceListingSubscriptions,
    eq,
    gt,
    inArray,
    partnerSubscriptions,
    sql
} from '@repo/db';
import { getInboundForeignKeys } from './fkGuard.js';

/**
 * The four tables the HOS-749 cleanup soft-deletes, in write order: children
 * first, parents last, so no live row is ever left pointing at a soft-deleted
 * parent. {@link assertSoftDeleteOrder} verifies this order against the real FK
 * graph before anything is written.
 */
export const BILLING_CLEANUP_SOFT_DELETE_ORDER: readonly string[] = [
    'billing_payments',
    'billing_addon_purchases',
    'billing_subscriptions',
    'billing_customers'
] as const;

/**
 * Referencing tables that keep rows pointing at soft-deleted parents ON
 * PURPOSE, each with the reason it is safe. Any OTHER table discovered pointing
 * at a targeted parent aborts the cleanup — that is the whole point of deriving
 * the graph from `pg_constraint` instead of trusting this list to be complete.
 */
export const RETAINED_REFERENCING_TABLES: Readonly<Record<string, string>> = {
    billing_webhook_events: 'operational trail — the diagnostic record, as in 0059',
    billing_webhook_dead_letter: 'operational trail',
    billing_notification_log: 'operational trail',
    billing_audit_logs: 'operational trail',
    billing_subscription_events: 'operational trail — the state-transition log',
    billing_idempotency_keys: 'operational trail — per-request keys, inert once expired',
    billing_subscription_polling_jobs: 'operational trail — completed provider-poll jobs',
    billing_promo_code_usage:
        'per-customer counters; a fresh signup gets a NEW customer id, so old rows cannot gate it',
    billing_customer_entitlements: 'keyed by customer_id; unreachable once that customer is gone',
    billing_customer_limits: 'keyed by customer_id; unreachable once that customer is gone',
    billing_usage_records: 'keyed by customer_id; unreachable once that customer is gone',
    billing_dunning_attempts: 'operational trail — dunning history',
    billing_invoices: 'has its own deleted_at; the 2026-08-21 inventory found 0 rows',
    billing_invoice_lines: 'child of billing_invoices; inventory found 0 rows',
    billing_invoice_payments: 'child of billing_invoices; inventory found 0 rows',
    billing_refunds: 'operational trail; inventory found 0 rows',
    billing_checkouts: 'superseded checkout sessions; not read by any live-state decision',
    billing_payment_methods: 'has its own deleted_at; inventory found 0 rows',
    billing_subscription_addons: 'inventory found 0 rows',
    featured_listing_addon_grants:
        'addon→accommodation grants; inventory found 0 rows, and the reconcile cron corrects drift',
    commerce_listing_subscriptions: 'asserted inert by assertRetainedTablesAreInert',
    partner_subscriptions: 'asserted inert by assertRetainedTablesAreInert',
    billing_pending_checkouts: 'asserted inert by assertRetainedTablesAreInert'
};

/** Thrown when the cleanup meets a state it was not written to decide about. */
export class BillingCleanupAbort extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BillingCleanupAbort';
    }
}

/**
 * Verifies {@link BILLING_CLEANUP_SOFT_DELETE_ORDER} against the live FK
 * catalogue: wherever one in-scope table references another, the referencing
 * (child) side must be written FIRST. Throws otherwise.
 *
 * @param db - Transaction-scoped Drizzle client.
 */
export async function assertSoftDeleteOrder(db: DrizzleClient): Promise<void> {
    for (const table of BILLING_CLEANUP_SOFT_DELETE_ORDER) {
        const parentIndex = BILLING_CLEANUP_SOFT_DELETE_ORDER.indexOf(table);
        const inbound = await getInboundForeignKeys({ db, table });

        for (const fk of inbound) {
            const childIndex = BILLING_CLEANUP_SOFT_DELETE_ORDER.indexOf(fk.referencingTable);
            if (childIndex === -1 || childIndex < parentIndex) {
                continue;
            }
            throw new BillingCleanupAbort(
                `FK order violation: "${fk.referencingTable}" references "${table}" ` +
                    `(constraint ${fk.constraintName}) but is soft-deleted AFTER it. ` +
                    'Children must be soft-deleted before their parents so no live row is ' +
                    'left pointing at a soft-deleted parent. Fix the soft-delete order.'
            );
        }
    }
}

/**
 * Discovers every inbound FK to `billing_customers` / `billing_subscriptions`
 * and counts, per referencing table, how many rows point at a row about to be
 * soft-deleted. A non-zero count on a table that is neither soft-deleted by the
 * cleanup nor listed in {@link RETAINED_REFERENCING_TABLES} throws.
 *
 * @param args.db - Transaction-scoped Drizzle client.
 * @param args.customerIds - `billing_customers.id` values about to be soft-deleted.
 * @param args.subscriptionIds - `billing_subscriptions.id` values about to be soft-deleted.
 */
export async function assertNoUnclassifiedReferrers(args: {
    readonly db: DrizzleClient;
    readonly customerIds: readonly string[];
    readonly subscriptionIds: readonly string[];
}): Promise<void> {
    const { db, customerIds, subscriptionIds } = args;
    const targetsByTable: Readonly<Record<string, readonly string[]>> = {
        billing_customers: customerIds,
        billing_subscriptions: subscriptionIds
    };

    for (const [table, targetIds] of Object.entries(targetsByTable)) {
        if (targetIds.length === 0) {
            continue;
        }
        const inbound = await getInboundForeignKeys({ db, table });

        for (const fk of inbound) {
            if (BILLING_CLEANUP_SOFT_DELETE_ORDER.includes(fk.referencingTable)) {
                continue; // handled by the cleanup itself
            }
            if (RETAINED_REFERENCING_TABLES[fk.referencingTable] !== undefined) {
                continue; // classified and reviewed
            }

            // Identifiers come from the pg catalogue, never from input, and are
            // still quoted via `sql.identifier()`. Both sides are cast to text so
            // the comparison holds whether the column is `uuid` or `varchar` —
            // `billing_subscriptions.plan_id` proves the billing schema mixes both.
            //
            // `sql.param()` is load-bearing, not decoration. Interpolating a bare
            // JS array into a Drizzle `sql` template expands it to a
            // COMMA-SEPARATED PLACEHOLDER LIST, so `${[a, b, c]}::text[]` renders
            // as `($1, $2, $3)::text[]` — a row constructor, which Postgres
            // rejects outright with `cannot cast type record to text[]`.
            //
            // The trap is that it only misfires with TWO OR MORE ids: with
            // exactly one, `($1)::text[]` is just a parenthesised scalar cast and
            // the query runs fine. Every fixture had at most one target, so this
            // guard passed everywhere and then aborted the whole production run
            // on 0068's seven real subscriptions (HOS-749). `sql.param()` binds
            // the array as ONE parameter, which is what `= ANY(...)` needs.
            const result = await db.execute<{ count: string }>(sql`
                SELECT COUNT(*) AS count
                FROM ${sql.identifier(fk.referencingTable)}
                WHERE CAST(${sql.identifier(fk.referencingColumn)} AS text)
                      = ANY(${sql.param([...targetIds])}::text[])
            `);
            const count = Number(result.rows[0]?.count ?? 0);
            if (count > 0) {
                throw new BillingCleanupAbort(
                    `Unclassified referencing table: ${count} row(s) in ` +
                        `"${fk.referencingTable}"."${fk.referencingColumn}" point at a "${table}" ` +
                        'row about to be soft-deleted, and that table is neither soft-deleted ' +
                        'here nor listed in RETAINED_REFERENCING_TABLES. Classify it ' +
                        'deliberately instead of letting the cleanup guess.'
                );
            }
        }
    }
}

/**
 * Asserts the three retained tables that have NO `deleted_at` column and ARE
 * read by a live "is this thing active?" decision are already inert for the
 * targeted rows. Throws naming the offending rows otherwise.
 *
 * - `commerce_listing_subscriptions` / `partner_subscriptions` carry their OWN
 *   `status` column, which `commerce-visibility.ts` and `checkout-idempotency.ts`
 *   read WITHOUT joining `billing_subscriptions`. Soft-deleting the subscription
 *   would not change what those paths see.
 * - `billing_pending_checkouts` gates checkout reuse on `status = 'pending' AND
 *   expires_at > now()`. An unexpired pending row for a purged customer would
 *   survive as a reusable checkout.
 *
 * @param args.db - Transaction-scoped Drizzle client.
 * @param args.customerIds - `billing_customers.id` values about to be soft-deleted.
 * @param args.subscriptionIds - `billing_subscriptions.id` values about to be soft-deleted.
 */
export async function assertRetainedTablesAreInert(args: {
    readonly db: DrizzleClient;
    readonly customerIds: readonly string[];
    readonly subscriptionIds: readonly string[];
}): Promise<void> {
    const { db, customerIds, subscriptionIds } = args;
    const grantingStatuses = [...ENTITLEMENT_GRANTING_STATUSES];

    if (subscriptionIds.length > 0) {
        const liveCommerce = await db
            .select({ id: commerceListingSubscriptions.id })
            .from(commerceListingSubscriptions)
            .where(
                and(
                    inArray(commerceListingSubscriptions.subscriptionId, [...subscriptionIds]),
                    inArray(commerceListingSubscriptions.status, grantingStatuses)
                )
            );
        if (liveCommerce.length > 0) {
            throw new BillingCleanupAbort(
                `${liveCommerce.length} commerce_listing_subscriptions row(s) still hold an ` +
                    `entitlement-granting status (${grantingStatuses.join('/')}) for a ` +
                    'subscription about to be soft-deleted. That table has no deleted_at and is ' +
                    'read WITHOUT joining billing_subscriptions, so the listing would stay ' +
                    `publicly visible. Offending ids: ${liveCommerce.map((r) => r.id).join(', ')}`
            );
        }

        const livePartner = await db
            .select({ id: partnerSubscriptions.id })
            .from(partnerSubscriptions)
            .where(
                and(
                    inArray(partnerSubscriptions.subscriptionId, [...subscriptionIds]),
                    inArray(partnerSubscriptions.status, grantingStatuses)
                )
            );
        if (livePartner.length > 0) {
            throw new BillingCleanupAbort(
                `${livePartner.length} partner_subscriptions row(s) still hold an ` +
                    'entitlement-granting status for a subscription about to be soft-deleted. ' +
                    `Offending ids: ${livePartner.map((r) => r.id).join(', ')}`
            );
        }
    }

    if (customerIds.length > 0) {
        const reusable = await db
            .select({ id: billingPendingCheckouts.id })
            .from(billingPendingCheckouts)
            .where(
                and(
                    inArray(billingPendingCheckouts.customerId, [...customerIds]),
                    eq(billingPendingCheckouts.status, 'pending'),
                    gt(billingPendingCheckouts.expiresAt, new Date())
                )
            );
        if (reusable.length > 0) {
            throw new BillingCleanupAbort(
                `${reusable.length} billing_pending_checkouts row(s) are still 'pending' and ` +
                    'unexpired for a customer about to be soft-deleted. That table has no ' +
                    'deleted_at, so the stale checkout would remain reusable. Offending ids: ' +
                    reusable.map((r) => r.id).join(', ')
            );
        }
    }
}
