/**
 * @fileoverview
 * Data migration: 0068-hos-749-prod-billing-cleanup
 *
 * HOS-749. Production-only. Soft-deletes the transactional billing rows that
 * production accumulated while the only person paying was the owner, so the
 * books start at zero before the first real customer arrives.
 *
 * ## ⚠️ THIS MIGRATION IS NOT A COMPLETE CLEANUP ON ITS OWN
 *
 * Deleting the local row does NOT cancel the MercadoPago preapproval. A live
 * preapproval keeps charging the card next month, now with no local row to
 * explain it. **Cancel in MercadoPago first, verify against MP's API, and only
 * then run this.** The 2026-08-21 inventory found exactly one preapproval still
 * `authorized` — `275b27a37f6f4e94bc1ab7543c6bd092`, $15.000 ARS, next charge
 * 2026-09-19 — whose local row (`fa6abdd1-c98b-4780-ad3e-53c24888ad97`) already
 * says `cancelled`. The database is not the source of truth here; MP is.
 *
 * This migration deliberately does NOT talk to MercadoPago. A seed
 * data-migration runs inside one transaction and a provider call cannot be
 * rolled back with it, so the provider side stays a separate, operator-driven,
 * verified-out-of-band step. See the runbook section of the HOS-749 issue.
 *
 * ## What it touches — and what it deliberately does not
 *
 * SOFT-DELETED (`deleted_at = now()`), never hard-deleted (HOS-202: hard
 * deletion of `billing_customers` already left a user permanently unable to
 * re-subscribe; HOS-596's `UNIQUE (external_id, livemode) WHERE deleted_at IS
 * NULL` is what makes a soft-deleted customer row harmless to a fresh signup):
 *
 * - `billing_payments`
 * - `billing_addon_purchases`
 * - `billing_subscriptions`
 * - `billing_customers`
 *
 * NEVER TOUCHED:
 *
 * - **`users` and everything hanging off an account.** This module does not
 *   import the `users` table at all — there are real people registered who
 *   simply have not paid yet, and this is a cleanup of billing DATA, not of
 *   accounts. `packages/seed/test/data-migrations/0068-hos-749-prod-billing-cleanup.test.ts`
 *   fails CI if a `users` reference ever appears here.
 * - **Catalogue rows** — `billing_plans`, `billing_prices`, `billing_addons`,
 *   `billing_promo_codes`. Those are configuration, not test data.
 * - **The operational trail** — `billing_webhook_events`,
 *   `billing_notification_log`, `billing_audit_logs`,
 *   `billing_subscription_events`, `billing_idempotency_keys`. Same reasoning
 *   as `0059`: it is the diagnostic record, not demo data.
 *
 * ## The `comp` subscriptions: preserve-by-default, purge only by explicit id
 *
 * A complimentary subscription is the one thing here that a live human is
 * actually using. The inventory found **three**, and nothing in the row shape
 * distinguishes them: all three carry the `HOSPEDA_FREE` promo code, all three
 * have `current_period_end` in 2126, all three have `mp_subscription_id IS
 * NULL`. Only *whose they are* separates them.
 *
 * So `comp` is inverted relative to every other status: a `comp` row is
 * **preserved unless its id is listed** in {@link PURGEABLE_COMP_SUBSCRIPTION_IDS}.
 * Getting the list wrong therefore leaves a stale grant (visible, reversible)
 * instead of stripping a real person's entitlements (invisible until they
 * complain). {@link OWNER_COMP_SUBSCRIPTION_ID} is additionally named and
 * asserted, so the owner's own grant cannot be purged even by a bad edit to the
 * purge list.
 *
 * Note the mirror-image precedent this defends against: the QA grants that were
 * soft-deleted on 2026-08-16 were `active`, not `comp`, dated 2126 exactly like
 * the real ones, and carried no promo code. Status alone has never been a
 * reliable discriminator in this table — which is why every decision here is
 * made by id.
 *
 * ## Children of a preserved subscription are preserved
 *
 * The rule is uniform and deliberately simple: a `billing_payments` or
 * `billing_addon_purchases` row whose `subscription_id` points at a preserved
 * subscription is preserved too. As of the inventory that keeps exactly one row
 * alive — the owner's `visibility-boost-7d` addon purchase, which expires on its
 * own — and it keeps the invariant "no live child points at a soft-deleted
 * parent" true in both directions without a special case.
 *
 * ## FK order, discovered from the catalogue rather than listed by hand
 *
 * A soft delete cannot trip a Postgres foreign key, so `0059`'s failure mode
 * (HOS-712: a `RESTRICT` FK aborting the whole pending batch) cannot repeat
 * literally. The invariant that CAN break is the logical one: a live row left
 * pointing at a soft-deleted parent. Two mechanisms defend it — both live in
 * `helpers/billingCleanupGuards.ts` and both read the live
 * `pg_constraint`/`pg_attribute` catalogue rather than a table list written by
 * hand, because a hand list goes stale the moment somebody adds a table, and it
 * goes stale silently:
 *
 * 1. `assertSoftDeleteOrder` — writes run children → parents
 *    (`BILLING_CLEANUP_SOFT_DELETE_ORDER`), and that order is *verified*
 *    against the discovered graph before any write.
 * 2. `assertNoUnclassifiedReferrers` — every discovered referencing table that
 *    is NOT itself soft-deleted here is counted against the targeted parent
 *    ids. A non-zero count aborts unless that table is on
 *    `RETAINED_REFERENCING_TABLES`, the explicit reviewed set of "retained on
 *    purpose". A table nobody has classified makes this migration stop, not
 *    guess.
 *
 * ## Inertness assertions on the tables that have no `deleted_at`
 *
 * Most billing child tables have no `deleted_at` column at all, so they cannot
 * participate in a soft delete. Three of them are still *read* on paths that
 * decide whether something is live, and each is asserted inert before any write
 * (`assertRetainedTablesAreInert`). If one is not inert, the migration aborts
 * and reports which row — it does not "fix" an ambiguous case on its own.
 *
 * ## The inventory cutoff — a real customer can never be swept up
 *
 * Every decision here rests on an inventory taken on 2026-08-21. Rows created
 * at or after {@link INVENTORY_CUTOFF} were not in it, are never targeted, and
 * are reported as `skippedAfterCutoff`. That is what makes it safe for this
 * migration to sit unapplied for weeks: somebody who subscribes tomorrow is out
 * of scope by construction, not by hope. {@link MAX_TARGET_SUBSCRIPTIONS} is a
 * second, cruder fuse for the same worry.
 *
 * ## Idempotency
 *
 * Every write is `... AND deleted_at IS NULL`, so a second pass matches nothing
 * and reports zeroes. The ledger already prevents a re-run; this holds anyway.
 *
 * @module data-migrations/0068-hos-749-prod-billing-cleanup
 */
import {
    and,
    billingAddonPurchases,
    billingCustomers,
    billingPayments,
    billingSubscriptions,
    inArray,
    isNull,
    lt,
    or
} from '@repo/db';
import { logger } from '../utils/logger.js';
import {
    assertNoUnclassifiedReferrers,
    assertRetainedTablesAreInert,
    assertSoftDeleteOrder,
    BillingCleanupAbort
} from './helpers/billingCleanupGuards.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0068-hos-749-prod-billing-cleanup',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * The owner's own complimentary subscription (`qazuor@gmail.com`, billing
 * customer `a0d625d6-f1e8-4f8c-985f-8ce96d15b83e`). Purging it would leave the
 * owner as an account with no plan. Named separately from the general
 * preserve-by-default `comp` rule so that even an incorrect edit to
 * {@link PURGEABLE_COMP_SUBSCRIPTION_IDS} cannot reach it.
 */
const OWNER_COMP_SUBSCRIPTION_ID = '5cf22a13-e353-4627-825a-e95586771ab7';

/**
 * The ONLY `comp` subscriptions this migration is allowed to purge. Everything
 * else at `status = 'comp'` is preserved, whether or not it was in the
 * inventory — see the module docstring for why the default runs this way round.
 *
 * `9c1a79e3` belongs to `qazuor+smoke2@gmail.com` ("Test Smoke"), a smoke-test
 * account.
 *
 * Deliberately ABSENT, pending an owner decision: `9da44403-44c3-47b0-8254-af08e57adefd`,
 * the comp granted to `rominapaolavillaverde@gmail.com` (Romina Villaverde) 20
 * minutes after she signed up on 2026-08-14. She reads as a real person, not a
 * fixture, so this migration preserves her grant. Add the id here only on an
 * explicit decision that it was a test.
 */
const PURGEABLE_COMP_SUBSCRIPTION_IDS: readonly string[] = [
    '9c1a79e3-0882-4526-9278-6f96faf65465'
] as const;

/**
 * Rows created at or after this instant were not in the 2026-08-21 inventory
 * this migration was written against, so they are never targeted. See the
 * module docstring.
 */
const INVENTORY_CUTOFF = new Date('2026-08-21T00:00:00.000Z');

/**
 * Sanity fuse. The inventory found 20 `billing_subscriptions` rows in total;
 * migrations numbered below this one (0058 / 0059 / 0065) hard-delete a good
 * share of them before this runs, so the real figure can only be lower. A
 * target set larger than this means the cutoff rule failed or this is not the
 * database it was written for — abort rather than purge.
 */
const MAX_TARGET_SUBSCRIPTIONS = 25;

/**
 * The four `UPDATE ... SET deleted_at = now()` statements are written out one
 * per table rather than behind a generic helper: Drizzle's table objects share
 * no public supertype that keeps `.set()` type-checked, and the only way to
 * write one helper for all four is an `any` this codebase forbids. Four
 * explicit blocks also make it directly readable which tables are written —
 * which, for a production billing purge, is the property worth optimizing for.
 *
 * Each is guarded by `isNull(deletedAt)`, so a second pass updates zero rows.
 */
async function softDeleteTargets(args: {
    readonly db: SeedMigrationCtx['db'];
    readonly paymentIds: readonly string[];
    readonly addonPurchaseIds: readonly string[];
    readonly subscriptionIds: readonly string[];
    readonly customerIds: readonly string[];
}): Promise<{
    paymentsSoftDeleted: number;
    addonPurchasesSoftDeleted: number;
    subscriptionsSoftDeleted: number;
    customersSoftDeleted: number;
}> {
    const { db, paymentIds, addonPurchaseIds, subscriptionIds, customerIds } = args;
    const now = new Date();

    // 1. billing_payments — child of both subscription and customer.
    const payments = paymentIds.length
        ? await db
              .update(billingPayments)
              .set({ deletedAt: now })
              .where(
                  and(
                      inArray(billingPayments.id, [...paymentIds]),
                      isNull(billingPayments.deletedAt)
                  )
              )
              .returning({ id: billingPayments.id })
        : [];

    // 2. billing_addon_purchases — child of both subscription and customer.
    const addonPurchases = addonPurchaseIds.length
        ? await db
              .update(billingAddonPurchases)
              .set({ deletedAt: now })
              .where(
                  and(
                      inArray(billingAddonPurchases.id, [...addonPurchaseIds]),
                      isNull(billingAddonPurchases.deletedAt)
                  )
              )
              .returning({ id: billingAddonPurchases.id })
        : [];

    // 3. billing_subscriptions — child of customer, parent of the two above.
    const subscriptions = subscriptionIds.length
        ? await db
              .update(billingSubscriptions)
              .set({ deletedAt: now })
              .where(
                  and(
                      inArray(billingSubscriptions.id, [...subscriptionIds]),
                      isNull(billingSubscriptions.deletedAt)
                  )
              )
              .returning({ id: billingSubscriptions.id })
        : [];

    // 4. billing_customers — the parent, last.
    const customers = customerIds.length
        ? await db
              .update(billingCustomers)
              .set({ deletedAt: now })
              .where(
                  and(
                      inArray(billingCustomers.id, [...customerIds]),
                      isNull(billingCustomers.deletedAt)
                  )
              )
              .returning({ id: billingCustomers.id })
        : [];

    return {
        paymentsSoftDeleted: payments.length,
        addonPurchasesSoftDeleted: addonPurchases.length,
        subscriptionsSoftDeleted: subscriptions.length,
        customersSoftDeleted: customers.length
    };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const { db } = ctx;

    // Production-only, matching 0058 / 0059 / 0065. Local and staging keep their
    // billing fixtures — wiping them there would break the SPEC-143 test-user
    // matrix that local entitlement testing depends on.
    if (process.env.NODE_ENV !== 'production') {
        return {
            summary:
                'Skipped: the HOS-749 production billing cleanup runs in production only ' +
                '(local/staging keep their billing fixtures).',
            counts: { skipped: 1 }
        };
    }

    // ── 1. Read the live state ───────────────────────────────────────────────
    const liveSubscriptions = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status,
            createdAt: billingSubscriptions.createdAt
        })
        .from(billingSubscriptions)
        .where(isNull(billingSubscriptions.deletedAt));

    // ── 2. Decide what is targeted ───────────────────────────────────────────
    const preservedSubscriptionIds = new Set<string>([OWNER_COMP_SUBSCRIPTION_ID]);
    const targetSubscriptionIds: string[] = [];
    let skippedAfterCutoff = 0;

    for (const sub of liveSubscriptions) {
        if (sub.id === OWNER_COMP_SUBSCRIPTION_ID) {
            continue;
        }
        // `comp` is preserve-by-default: only an explicitly listed id is purged.
        if (sub.status === 'comp' && !PURGEABLE_COMP_SUBSCRIPTION_IDS.includes(sub.id)) {
            preservedSubscriptionIds.add(sub.id);
            continue;
        }
        if (sub.createdAt >= INVENTORY_CUTOFF) {
            skippedAfterCutoff += 1;
            preservedSubscriptionIds.add(sub.id);
            continue;
        }
        targetSubscriptionIds.push(sub.id);
    }

    if (targetSubscriptionIds.length > MAX_TARGET_SUBSCRIPTIONS) {
        throw new BillingCleanupAbort(
            `Refusing to purge: ${targetSubscriptionIds.length} billing_subscriptions rows are ` +
                `targeted, above the MAX_TARGET_SUBSCRIPTIONS fuse of ${MAX_TARGET_SUBSCRIPTIONS}. ` +
                'This is not the database this migration was written against.'
        );
    }

    // A customer survives iff it still owns a preserved subscription.
    const preservedCustomerIds = new Set(
        liveSubscriptions.filter((s) => preservedSubscriptionIds.has(s.id)).map((s) => s.customerId)
    );

    const liveCustomers = await db
        .select({ id: billingCustomers.id, createdAt: billingCustomers.createdAt })
        .from(billingCustomers)
        .where(isNull(billingCustomers.deletedAt));

    const targetCustomerIds = liveCustomers
        .filter((c) => !preservedCustomerIds.has(c.id) && c.createdAt < INVENTORY_CUTOFF)
        .map((c) => c.id);

    // ── 3. Guards — abort before any write ───────────────────────────────────
    await assertSoftDeleteOrder(db);
    await assertNoUnclassifiedReferrers({
        db,
        customerIds: targetCustomerIds,
        subscriptionIds: targetSubscriptionIds
    });
    await assertRetainedTablesAreInert({
        db,
        customerIds: targetCustomerIds,
        subscriptionIds: targetSubscriptionIds
    });

    // ── 4. Children of PRESERVED subscriptions stay; everything else goes ────
    //
    // No "and not preserved" clause is needed: `targetSubscriptionIds` is built
    // by EXCLUDING every preserved id, so the two sets are disjoint by
    // construction. A child pointing at a preserved subscription therefore
    // cannot match the `inArray(..., targetSubscriptionIds)` branch, and the
    // orphan branch below only fires when `subscription_id IS NULL`.
    const hasSubscriptionTargets = targetSubscriptionIds.length > 0;
    const hasCustomerTargets = targetCustomerIds.length > 0;

    const targetPayments =
        hasSubscriptionTargets || hasCustomerTargets
            ? await db
                  .select({ id: billingPayments.id })
                  .from(billingPayments)
                  .where(
                      and(
                          isNull(billingPayments.deletedAt),
                          lt(billingPayments.createdAt, INVENTORY_CUTOFF),
                          or(
                              hasSubscriptionTargets
                                  ? inArray(billingPayments.subscriptionId, targetSubscriptionIds)
                                  : undefined,
                              hasCustomerTargets
                                  ? and(
                                        isNull(billingPayments.subscriptionId),
                                        inArray(billingPayments.customerId, targetCustomerIds)
                                    )
                                  : undefined
                          )
                      )
                  )
            : [];

    const targetAddonPurchases =
        hasSubscriptionTargets || hasCustomerTargets
            ? await db
                  .select({ id: billingAddonPurchases.id })
                  .from(billingAddonPurchases)
                  .where(
                      and(
                          isNull(billingAddonPurchases.deletedAt),
                          lt(billingAddonPurchases.createdAt, INVENTORY_CUTOFF),
                          or(
                              hasSubscriptionTargets
                                  ? inArray(
                                        billingAddonPurchases.subscriptionId,
                                        targetSubscriptionIds
                                    )
                                  : undefined,
                              hasCustomerTargets
                                  ? and(
                                        isNull(billingAddonPurchases.subscriptionId),
                                        inArray(billingAddonPurchases.customerId, targetCustomerIds)
                                    )
                                  : undefined
                          )
                      )
                  )
            : [];

    // ── 5. Write, children → parents ─────────────────────────────────────────
    const {
        paymentsSoftDeleted,
        addonPurchasesSoftDeleted,
        subscriptionsSoftDeleted,
        customersSoftDeleted
    } = await softDeleteTargets({
        db,
        paymentIds: targetPayments.map((r) => r.id),
        addonPurchaseIds: targetAddonPurchases.map((r) => r.id),
        subscriptionIds: targetSubscriptionIds,
        customerIds: targetCustomerIds
    });

    const summary =
        `HOS-749: soft-deleted ${subscriptionsSoftDeleted} subscription(s), ` +
        `${customersSoftDeleted} customer(s), ${paymentsSoftDeleted} payment(s) and ` +
        `${addonPurchasesSoftDeleted} addon purchase(s). ` +
        `Preserved ${preservedSubscriptionIds.size} subscription(s) including the owner's comp ` +
        `(${OWNER_COMP_SUBSCRIPTION_ID}). No account row was touched. ` +
        'MercadoPago preapprovals are NOT cancelled by this migration.';
    logger.info(summary);

    return {
        summary,
        counts: {
            subscriptionsSoftDeleted,
            customersSoftDeleted,
            paymentsSoftDeleted,
            addonPurchasesSoftDeleted,
            preservedSubscriptions: preservedSubscriptionIds.size,
            skippedAfterCutoff
        }
    };
}
