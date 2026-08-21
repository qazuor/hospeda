/**
 * @fileoverview
 * Data migration: 0065-hos-692-purge-orphaned-commerce-fixtures
 *
 * HOS-692 (epic HOS-589), release B. Production-only cleanup of the 3
 * `billing_subscriptions` rows (+ their 5 `commerce_listing_subscriptions`
 * link rows, cascaded) that a single seed run left behind: the 3
 * `gastro-owner-{julieta,rodrigo,valentina}@local.test` fixtures, all
 * `product_domain = 'commerce'`, all created `2026-07-08 03:18:39` within
 * 22ms — the one timestamp is the tell that this is a seed run, not
 * customers (spec §6.13).
 *
 * ## ⚠️ BLOCKED ON HOS-712 — DO NOT DEPLOY THIS MIGRATION UNTIL THAT ISSUE RESOLVES
 *
 * While writing this migration, cross-checking it against
 * `0059-purge-test-and-commerce-example.ts` (never touched — see below)
 * surfaced a real bug in that ALREADY-MERGED file, filed as **HOS-712
 * (Urgent)**: its Step 7 deletes `billing_customers` for these same 3
 * accounts, and its own comment claims "Deleting the customer CASCADEs its
 * subscriptions" — but `billing_subscriptions.customer_id` REFERENCES
 * `billing_customers.id` with `ON DELETE RESTRICT`
 * (`packages/db/src/migrations/0000_baseline.sql:1647`), not CASCADE. As
 * long as these 3 accounts' `billing_subscriptions` rows still exist when
 * 0059 runs, its `billing_customers` `DELETE` throws a foreign-key
 * violation, and per `runner.ts`'s "no partial runs" contract that ABORTS
 * THE ENTIRE PENDING BATCH — including this migration and everything
 * numbered after it, since 0059 (< 0065) always runs first.
 *
 * This migration's OWN logic does not depend on 0059 having succeeded (see
 * "Order independence" below), so it is written, tested, and ready. What is
 * NOT safe is deploying it to any environment where 0059 is also pending,
 * until HOS-712 is resolved. Track that issue's resolution before running
 * `db:seed:migrate` anywhere this file and 0059 are both unapplied.
 *
 * ## These rows are DELETED, not migrated
 *
 * `0059-purge-test-and-commerce-example.ts:125-127` already hard-deletes
 * these 3 accounts and the gastronomies they own, but it does not reach
 * `billing_subscriptions` / `commerce_listing_subscriptions` and cannot: it
 * has no FK-enforced path into either table (`billing_customers` has no FK
 * to `users`, and the link table's only FK is `subscription_id →
 * billing_subscriptions ON DELETE CASCADE`, not to any user/customer). After
 * 0059 runs, these 8 rows survive as orphans. This migration deletes the 3
 * `billing_subscriptions` rows; the 5 link rows cascade automatically.
 *
 * A NEW migration, never an edit to 0059: the `seed_migrations` ledger
 * stores a `checksum` per applied migration
 * (`seed_migration.dbschema.ts:25-50`) — editing a file already applied
 * anywhere corrupts that environment's ledger.
 *
 * ## Order independence (w.r.t. 0059, once HOS-712 is resolved)
 *
 * This migration's `up()` identifies its 3 target rows entirely by
 * `billing_subscriptions.product_domain = 'commerce'` — a column ON
 * `billing_subscriptions` ITSELF, never a join to `billing_customers` or
 * `users`. That is deliberate and load-bearing: `0059` deletes BOTH
 * `billing_customers` and `users` for these accounts, so a lookup that
 * needed either table to still exist would break depending on which
 * migration ran first. Per spec §6.13's own production inventory (verified
 * 2026-08-20), these 3 rows are the ONLY `'commerce'`-domain subscriptions
 * that exist in production — the checkout path that would create a REAL
 * one does not go live until this same release, so there is nothing else
 * this filter could match. Whichever of 0059 / this migration runs first
 * (once they are not forced into the same failing batch by HOS-712), the
 * end state is identical: 0 orphaned billing rows, 0 orphaned accounts.
 *
 * ## Never guesses beyond the 3-row inventory
 *
 * If MORE than 3 rows match `product_domain = 'commerce'` at run time (a
 * real commerce subscription was sold between spec-writing and this
 * migration's deployment — release B is supposed to ship before that is
 * possible, but this does not trust that promise blindly), this migration
 * refuses to delete anything and reports the discrepancy instead of
 * guessing which rows are the fixtures.
 *
 * ## `destructive` flag
 *
 * `true`: hard-deletes rows in production, gated the same way `0059` is (own
 * `NODE_ENV !== 'production'` skip below, mirroring `0058`/`0059`) plus the
 * runner's standard destructive-migration production gate
 * (`HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true` / `--allow-destructive`).
 *
 * ## Idempotency
 *
 * A second run matches zero rows (`product_domain = 'commerce'` no longer
 * matches anything once the first run deletes them) and reports 0 deleted —
 * a clean no-op.
 */
import { billingSubscriptions, eq } from '@repo/db';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0065-hos-692-purge-orphaned-commerce-fixtures',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * The exact count spec §6.13's production inventory (2026-08-20) found: 3
 * `billing_subscriptions` rows at `product_domain = 'commerce'`, all the
 * `gastro-owner-*` seed fixtures. A different count at run time means the
 * assumption "these are the only commerce-domain rows in production" no
 * longer holds, and this migration refuses to guess.
 */
const EXPECTED_ORPHAN_COUNT = 3;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const { db } = ctx;

    // Production-only, matching 0058/0059: staging and local keep the
    // gastro-owner-* fixtures as legitimate demo data (0059 no-ops there
    // too), so nothing here is "orphaned" outside production.
    if (process.env.NODE_ENV !== 'production') {
        return {
            summary:
                'Skipped: orphaned-commerce-fixture purge runs in production only ' +
                '(staging/local keep the gastro-owner-* fixtures as legitimate demo data).',
            counts: { skipped: 1 }
        };
    }

    // Self-contained: identifies rows by billing_subscriptions' OWN
    // product_domain column. Never joins users or billing_customers — see
    // "Order independence" above.
    // Literal 'commerce' string, not `ProductDomainEnum.COMMERCE`: HOS-695
    // (release C) removed that member from the live vocabulary. This is a
    // historical, already-numbered migration record of what it purged AT THE
    // TIME it ran, when 'commerce' was still a real value — see
    // `scripts/check-product-domain-raw-sql.sh`'s header for why files under
    // `data-migrations/` are exempt from the "no living source may hardcode
    // 'commerce'" guard.
    const candidates = await db
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.productDomain, 'commerce'));

    if (candidates.length === 0) {
        // Nothing to do — a clean re-run (this migration only runs once per
        // the ledger, but the check stays cheap and correct regardless).
        return {
            summary:
                'No product_domain=commerce billing_subscriptions rows found — nothing to purge.',
            counts: { subscriptionsFound: 0, subscriptionsDeleted: 0 }
        };
    }

    if (candidates.length !== EXPECTED_ORPHAN_COUNT) {
        const message =
            `HOS-692 orphan purge: expected exactly ${EXPECTED_ORPHAN_COUNT} ` +
            `product_domain='commerce' billing_subscriptions row(s) (the gastro-owner-* seed ` +
            `fixtures per spec §6.13's production inventory), found ${candidates.length}. ` +
            'Refusing to delete anything — this count mismatch means a real commerce ' +
            'subscription may now exist and must not be swept up by this purge.';
        logger.error(message);
        return {
            summary: message,
            counts: { subscriptionsFound: candidates.length, subscriptionsDeleted: 0 }
        };
    }

    // Deletes cascade to commerce_listing_subscriptions via
    // subscription_id → billing_subscriptions ON DELETE CASCADE.
    let deleted = 0;
    for (const candidate of candidates) {
        await db.delete(billingSubscriptions).where(eq(billingSubscriptions.id, candidate.id));
        deleted += 1;
    }

    return {
        summary: `Purged ${deleted} orphaned commerce billing_subscriptions row(s) (cascaded to their commerce_listing_subscriptions link rows).`,
        counts: { subscriptionsFound: candidates.length, subscriptionsDeleted: deleted }
    };
}
