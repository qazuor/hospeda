/**
 * @fileoverview
 * Data migration: 0106-hos-1326-abandoned-checkout-mislabelled-cancelled
 *
 * Relabels the subscription rows that HOS-1326's bug filed as cancellations when
 * they were abandoned checkouts.
 *
 * ## The window this exists to close
 *
 * The bug: `abandoned-pending-subs` cancelled a stale checkout's preapproval
 * through `billing.subscriptions.cancel()`, which ALSO writes `status: 'canceled'`
 * on the local row. That took the row out of the pending statuses before the
 * reaper's own `abandoned` write could match it, so every candidate holding an
 * `mp_subscription_id` stopped at `canceled` — a checkout that never started,
 * filed as a customer who left, and counted as churn
 * (`billing-metrics.service.ts` matches BOTH spellings and filters by no product
 * domain at all).
 *
 * The fix ships in the same release as this migration, so this runs strictly
 * AFTER the window closed and catches exactly what the window produced.
 *
 * ## Why the criterion can be this simple
 *
 * Production was measured on 2026-09-10 and holds **zero** rows in either
 * cancellation spelling (8 subscriptions: 3 `trialing`, 3 `abandoned`, 2 `comp`).
 * So any such row present when this runs was, by construction, born inside the
 * window — there are no historical cancellations to tell it apart from. That is
 * what makes a narrow, mechanical criterion sufficient rather than a heuristic.
 *
 * It is also why this migration is worth shipping despite that measurement:
 * several days pass between writing it and the release reaching production, and
 * production keeps taking checkouts the whole time.
 *
 * ## The criterion — NARROW, and silent when unsure
 *
 * A wide criterion turns an honest cancellation into an abandonment, and that is
 * worse than the bug it repairs: a false negative costs one churn data point, a
 * false positive destroys a true fact about a customer who actually paid. All
 * three conditions are required, in `AND`:
 *
 * 1. **`status` in BOTH spellings** — `'canceled'` (qzpay) and `'cancelled'`
 *    (every direct Hospeda writer). Not assumed: the bug wrote the first, but the
 *    normalisation extras file folds spellings on every `db:apply-extras`, so
 *    which one a given row shows depends on when the last deploy ran.
 * 2. **A preapproval is present** — the cron bug only ever affected candidates
 *    that had one. Expressed with {@link hasLinkedPreapprovalCondition} and NOT a
 *    hand-rolled `IS NOT NULL`, because the column can hold the EMPTY STRING (the
 *    blind spot that produced HOS-1326's follow-up bug). Same predicate the fix
 *    uses, so both describe the same universe.
 * 3. **Zero payments, in the broadest sense** — see below.
 *
 * ### Condition 3 is the one that makes a false positive impossible
 *
 * "Never started" and "cancelled" are indistinguishable by status alone. What
 * separates them is whether money ever moved. A row with any payment attached is
 * a real relationship and this migration must not touch it.
 *
 * So the exclusion is deliberately the WIDEST reading of "a payment exists":
 *
 * - **any `billing_payments` row** whose `subscription_id` matches — regardless
 *   of `status`. Not just settled ones: a `pending`, `failed` or `refunded` row
 *   still means MercadoPago engaged with this subscription, and that is enough
 *   doubt to leave it alone. Filtering on a status would also have walked into a
 *   live trap: `billing-metrics.service.ts` filters payments by
 *   `status = 'completed'`, a value this table can never hold.
 * - **regardless of `deleted_at`** — a soft-deleted payment row still records
 *   that money moved.
 * - **plus any `billing_orphan_payments` row** pointing at the subscription: a
 *   charge that landed but could not be linked (HOS-765 / HOS-1001) is money
 *   moved with no `billing_payments` row to show for it, which is exactly the
 *   case a payments-only check would miss.
 *
 * The join is `billing_payments.subscription_id = billing_subscriptions.id`,
 * plain equality on two `uuid` columns — verified against the installed
 * `@qazuor/qzpay-drizzle` 4.0.0 schema. No cast, unlike the
 * `subscriptions.plan_id` (varchar) → `plans.id` (uuid) pair this repo warns
 * about elsewhere.
 *
 * A fourth signal was considered and deliberately left out as a FILTER: in an
 * abandonment `canceled_at - created_at` is set by the hourly cron, so it clusters
 * just past the 30-minute TTL. It is reported below as corroboration, but it never
 * decides — a clock-based rule would start guessing, which is the one thing the
 * criterion must not do.
 *
 * ## Idempotency and reporting
 *
 * The `UPDATE` re-asserts the cancellation statuses, so a second run matches
 * nothing.
 *
 * It reports **ids, not counts**. A data migration that reads nothing is ledgered
 * applied forever and never runs again — measured in this repo's own production
 * (HOS-433: zero rows, `ok`, 18 ms, permanent). The timing saves this one, but for
 * exactly that reason "there was nothing" and "it never looked" must be
 * distinguishable in the deploy log. It also lists the rows that matched
 * conditions 1 and 2 but were held back by condition 3 — that number is what says
 * whether the criterion is doing its job or is mis-set in either direction.
 *
 * ## Dual-write
 *
 * Not applicable. This touches live transactional billing rows, not seed catalogue
 * data, so there is no baseline fixture to keep in step: a fresh database has no
 * mislabelled rows to correct.
 */

import {
    and,
    billingOrphanPayments,
    billingPayments,
    billingSubscriptions,
    hasLinkedPreapprovalCondition,
    inArray,
    isNotNull
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0106-hos-1326-abandoned-checkout-mislabelled-cancelled',
    group: 'required',
    // Overwrites a terminal status on live billing rows. The criterion is built
    // so it cannot reach a genuine cancellation, but "I am confident it is
    // narrow" is exactly the reasoning a destructive gate exists to not take on
    // faith — 0102 and 0103 record the same call for the same reason.
    destructive: true,
    // HOS-433: a migration whose target column is gone moves zero rows, reports
    // success, and is ledgered applied forever. These are the columns whose
    // absence would make it silently meaningless.
    requiresColumns: [
        { table: 'billing_subscriptions', column: 'status' },
        { table: 'billing_subscriptions', column: 'mp_subscription_id' },
        { table: 'billing_payments', column: 'subscription_id' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * Both spellings the cancellation status is stored in.
 *
 * `cancelled` is {@link SubscriptionStatusEnum.CANCELLED} (every direct Hospeda
 * writer); `canceled` is qzpay-core's American form, written by
 * `billing.subscriptions.cancel()` — the call that caused this. Listed as a pair
 * because `extras/035-canceled-spelling-normalize` folds them on every
 * `db:apply-extras`, so which one a row shows depends on deploy timing. HOS-1329
 * unifies the vocabulary; until then, matching one would miss the other.
 */
const CANCELLATION_SPELLINGS: readonly string[] = [
    SubscriptionStatusEnum.CANCELLED,
    'canceled'
] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const db = ctx.db;
    const now = new Date();

    // ── Conditions 1 + 2: cancelled-looking, and it had a preapproval ────────
    //
    // No `deleted_at` filter: a soft-deleted row still carries the wrong status
    // and is still counted by the churn query, which does not filter it either.
    const suspects = await db
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            createdAt: billingSubscriptions.createdAt,
            canceledAt: billingSubscriptions.canceledAt
        })
        .from(billingSubscriptions)
        .where(
            and(
                inArray(billingSubscriptions.status, [...CANCELLATION_SPELLINGS]),
                hasLinkedPreapprovalCondition()
            )
        );

    if (suspects.length === 0) {
        return {
            summary:
                'No subscription is sitting on a cancellation status with a preapproval attached — nothing to relabel. ' +
                'Expected on an environment that never ran the buggy reaper, and on a re-run.',
            counts: { suspects: 0, relabelled: 0, heldBackByPayments: 0 }
        };
    }

    const suspectIds = suspects.map((row) => row.id);

    // ── Condition 3: zero payments, in the widest sense ──────────────────────
    //
    // Any status, deleted or not, plus the orphan-charge queue. Every id that
    // comes back here is EXCLUDED from the relabel.
    const paidRows = await db
        .selectDistinct({ subscriptionId: billingPayments.subscriptionId })
        .from(billingPayments)
        .where(inArray(billingPayments.subscriptionId, suspectIds));

    const orphanRows = await db
        .selectDistinct({ subscriptionId: billingOrphanPayments.subscriptionId })
        .from(billingOrphanPayments)
        .where(
            and(
                isNotNull(billingOrphanPayments.subscriptionId),
                inArray(billingOrphanPayments.subscriptionId, suspectIds)
            )
        );

    const withMoney = new Set<string>(
        [...paidRows, ...orphanRows]
            .map((row) => row.subscriptionId)
            .filter((id): id is string => typeof id === 'string')
    );

    const relabelTargets = suspectIds.filter((id) => !withMoney.has(id));
    const heldBack = suspectIds.filter((id) => withMoney.has(id));

    if (relabelTargets.length === 0) {
        return {
            summary:
                `Found ${suspects.length} cancelled-looking subscription(s) with a preapproval, and EVERY one has a payment ` +
                `attached — all left untouched, which is the criterion working. Held back: ${heldBack.join(', ')}.`,
            counts: {
                suspects: suspects.length,
                relabelled: 0,
                heldBackByPayments: heldBack.length
            }
        };
    }

    // The status `inArray` is re-asserted so a concurrent run, or a second
    // invocation, matches nothing rather than rewriting rows twice.
    const relabelled = await db
        .update(billingSubscriptions)
        .set({ status: SubscriptionStatusEnum.ABANDONED, updatedAt: now })
        .where(
            and(
                inArray(billingSubscriptions.id, relabelTargets),
                inArray(billingSubscriptions.status, [...CANCELLATION_SPELLINGS])
            )
        )
        .returning({ id: billingSubscriptions.id });

    // Corroboration only — reported, never used to decide. In an abandonment the
    // gap is set by the hourly cron and clusters just past the 30-minute TTL; a
    // wildly different gap deserves a human's eye, not an automatic exclusion.
    const relabelledSet = new Set(relabelled.map((row) => row.id));
    const gapsMinutes = suspects
        .filter((row) => relabelledSet.has(row.id))
        .map((row) => {
            const created = row.createdAt ? new Date(row.createdAt).getTime() : null;
            const canceled = row.canceledAt ? new Date(row.canceledAt).getTime() : null;
            return created !== null && canceled !== null
                ? Math.round((canceled - created) / 60_000)
                : null;
        })
        .filter((gap): gap is number => gap !== null);

    return {
        summary:
            `Relabelled ${relabelled.length} abandoned checkout(s) from a cancellation status to '${SubscriptionStatusEnum.ABANDONED}': ` +
            `${relabelled.map((row) => row.id).join(', ')}. ` +
            (heldBack.length > 0
                ? `Held back ${heldBack.length} row(s) that matched the status+preapproval criteria but HAVE payments (a real cancellation, left alone): ${heldBack.join(', ')}. `
                : 'No suspect had payments attached. ') +
            (gapsMinutes.length > 0
                ? `Corroboration only — created→cancelled gap in minutes for the relabelled rows: ${gapsMinutes.join(', ')} (an abandonment is timed by the hourly cron, so expect values just past the 30-minute TTL).`
                : ''),
        counts: {
            suspects: suspects.length,
            relabelled: relabelled.length,
            heldBackByPayments: heldBack.length
        }
    };
}
