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
 * four conditions are required, in `AND`:
 *
 * 1. **`status` in BOTH spellings** — `'canceled'` (qzpay) and `'cancelled'`.
 * 2. **A preapproval is present** — via {@link hasLinkedPreapprovalCondition} and
 *    NOT a hand-rolled `IS NOT NULL`, because the column can hold the EMPTY
 *    STRING. Same predicate the fix uses, so both describe the same universe.
 * 3. **Zero payments, in the broadest sense.**
 * 4. **It never LEFT the pending state by a recorded transition.**
 *
 * ### Conditions 1 and 2 discriminate almost nothing — read this before trusting them
 *
 * Both were in the first version of this migration, and neither does the work its
 * presence suggests:
 *
 * - **Condition 1 is nearly inert by the time this runs.** The deploy order on a
 *   live environment is `db:migrate` -> `db:apply-extras` -> `db:seed:migrate`,
 *   and `extras/035-canceled-spelling-normalize` folds `canceled` -> `cancelled`
 *   unconditionally on every single deploy. So by the time this migration
 *   executes, a bug row is spelled exactly like an honest cancellation. Matching
 *   both spellings is correctness, not selectivity.
 * - **Condition 2 excludes no real cancellation at all.** A genuine cancellation
 *   by a paying customer ALWAYS has a preapproval. It only removes `comp`
 *   subscriptions (created with `mp_subscription_id = NULL`) and never-linked rows.
 *
 * They stay because each is *necessary*; neither is *sufficient*, and reading them
 * as safety would be reading them wrong.
 *
 * ### Why condition 3 is not enough on its own
 *
 * "Never started" and "cancelled" are indistinguishable by status alone; what
 * separates them is whether money moved. So the exclusion is deliberately the
 * WIDEST reading of "a payment exists": any `billing_payments` row on
 * `subscription_id` at any `status` (a `pending`/`failed`/`refunded` row still
 * means MercadoPago engaged), regardless of `deleted_at`, plus any
 * `billing_orphan_payments` row (HOS-765 / HOS-1001).
 *
 * **But that union is the set of money that was REGISTERED, not the set of money
 * that MOVED.** `payment-reconcile.service.ts` says so about the incident that
 * produced it: *"the payment half had no path at all - the webhooks had already
 * answered 200, so MercadoPago never retried"*. `backfillPayment` exists
 * **because** settled charges reached production with no `billing_payments` row
 * and no orphan row — the orphan queue only records what a webhook TRIED to
 * record, and one that answered 200 without writing leaves nothing behind.
 *
 * So the concrete false positive condition 3 cannot stop: a customer authorises,
 * MercadoPago charges, the webhook 200s without writing the ledger row, they get
 * no entitlements, they complain, they cancel. Preapproval present, zero payments,
 * zero orphans — and relabelling them would destroy the truth about someone who
 * paid AND was already failed once. A second shape needs no broken webhook at all:
 * `deriveTrialingStatus` makes an authorised preapproval `trialing` while
 * `trial_end` is in the future, and a `trialing` row can legitimately have zero
 * payments. Production holds three of those today.
 *
 * ### Condition 4 is the one that closes both, and it is mechanical
 *
 * The bug's producer could only ever write over rows that were `incomplete` /
 * `pending_provider` — the reaper's candidate SELECT admits nothing else. So the
 * question that separates the populations is not about money or clocks:
 * **"did this subscription ever leave the pending state?"**
 *
 * `billing_subscription_events` answers it, and is a strictly better witness than
 * `billing_payments` for one specific reason: the event row is written by the same
 * code, in the same transaction, as the status change it records
 * (`subscription-logic.ts` Step 8, `tx.insert(billingSubscriptionEvents)`), and
 * every other lifecycle path writes one too — including
 * `subscription-cancel.service.ts` for a user-initiated cancellation. The payments
 * ledger is a *different concern* written by a *different* handler, which is
 * exactly how it came to be missing.
 *
 * Both named false positives are excluded by it: in the HOS-765 shape the
 * SUBSCRIPTION did activate (only the payment write was lost), so an `active`
 * event exists; in the trialing shape a `trialing` event exists.
 *
 * **`current_period_start IS NULL` was considered for this and REJECTED with
 * evidence**, because it looks like an activation signal and is not one:
 * `@qazuor/qzpay-drizzle` 4.0.0 declares the column `.notNull()` and its storage
 * adapter stamps `currentPeriodStart: now` at INSERT for every subscription
 * including `incomplete` ones; `pending-provider-subscription-create.ts:319`
 * stamps it at creation too; and **no code path rewrites it on activation** — the
 * activation webhook's own update touches `currentPeriodEnd` and never
 * `currentPeriodStart`. The predicate would be false for every row in the table,
 * and this migration would be a permanently-ledgered no-op.
 *
 * ### What the four conditions actually guarantee
 *
 * Not "a false positive is impossible" — an earlier version of this file claimed
 * that and the claim was false. What is true is narrower and checkable: a false
 * positive now requires **three independent write paths to have failed for the
 * same subscription** — the payments ledger, the orphan-charge queue, and the
 * status-transition audit written in the same transaction as the status change
 * itself. The audit is the one that closes both scenarios review identified, and
 * it is the only one of the three that cannot be missing without the status
 * change that produced it also being missing.
 *
 * A further signal was considered and deliberately left out as a FILTER: in an
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

import { PENDING_PROVIDER_STORED_STATUSES } from '@repo/billing';
import {
    and,
    billingOrphanPayments,
    billingPayments,
    billingSubscriptionEvents,
    billingSubscriptions,
    hasLinkedPreapprovalCondition,
    inArray,
    isNotNull,
    isNull,
    notInArray,
    or,
    sql
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
        { table: 'billing_payments', column: 'subscription_id' },
        // Both halves of condition 3, not just the first — an absent
        // orphan-payment column would silently drop half the money check.
        { table: 'billing_orphan_payments', column: 'subscription_id' },
        // Condition 4. Without this column the "did it ever leave pending?"
        // question cannot be asked at all, and the migration would fall back to
        // exactly the criterion review rejected.
        { table: 'billing_subscription_events', column: 'new_status' }
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
            counts: {
                suspects: 0,
                relabelled: 0,
                heldBackByPayments: 0,
                heldBackByHistory: 0,
                heldBackTotal: 0
            }
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

    // ── Condition 4: it never LEFT the pending state by a recorded transition ─
    //
    // The decisive one. See the docblock: `billing_payments` records money that
    // was REGISTERED, not money that MOVED, and `backfillPayment` (HOS-765)
    // exists because a webhook can answer 200 without writing that row. Condition
    // 3 alone therefore cannot separate "never started" from "paid, but the
    // ledger write was lost".
    //
    // This asks a different question, of the table that records the status change
    // ITSELF: has anything ever moved this subscription to a status outside the
    // pending set? Any recorded transition to `active`, `trialing`, `past_due`,
    // `cancelled` — or to anything this migration does not recognise — excludes
    // the row. Only a subscription whose entire recorded history stayed inside
    // "the provider never confirmed it" survives, which is exactly the population
    // the bug could write to: the reaper's candidate SELECT admitted nothing else.
    //
    // Fails CLOSED twice over: an event whose `new_status` is NULL tells us
    // nothing, so it excludes; and an unrecognised status is "not pending", so it
    // excludes too.
    const movedRows = await db
        .selectDistinct({ subscriptionId: billingSubscriptionEvents.subscriptionId })
        .from(billingSubscriptionEvents)
        .where(
            and(
                inArray(billingSubscriptionEvents.subscriptionId, suspectIds),
                or(
                    isNull(billingSubscriptionEvents.newStatus),
                    notInArray(billingSubscriptionEvents.newStatus, [
                        ...PENDING_PROVIDER_STORED_STATUSES
                    ])
                )
            )
        );

    const everLeftPending = new Set<string>(
        movedRows
            .map((row) => row.subscriptionId)
            .filter((id): id is string => typeof id === 'string')
    );

    const excluded = new Set<string>([...withMoney, ...everLeftPending]);
    const relabelTargets = suspectIds.filter((id) => !excluded.has(id));
    const heldBack = suspectIds.filter((id) => excluded.has(id));
    const heldBackByPayments = suspectIds.filter((id) => withMoney.has(id));
    const heldBackByHistory = suspectIds.filter((id) => everLeftPending.has(id));

    if (relabelTargets.length === 0) {
        return {
            summary:
                `Found ${suspects.length} cancelled-looking subscription(s) with a preapproval, and EVERY one is excluded — ` +
                'all left untouched, which is the criterion working. ' +
                `Held back by payments: ${heldBackByPayments.join(', ') || 'none'}. ` +
                `Held back by a recorded transition out of pending: ${heldBackByHistory.join(', ') || 'none'}.`,
            counts: {
                suspects: suspects.length,
                relabelled: 0,
                heldBackByPayments: heldBackByPayments.length,
                heldBackByHistory: heldBackByHistory.length,
                heldBackTotal: heldBack.length
            }
        };
    }

    // The status `inArray` is re-asserted so a concurrent run, or a second
    // invocation, matches nothing rather than rewriting rows twice.
    //
    // The `NOT EXISTS` re-asserts condition 3 AT WRITE TIME. Everything above is
    // a read, Postgres defaults to READ COMMITTED, and a rolling deploy keeps the
    // API serving while this runs — so a payment could land between the SELECT
    // and this UPDATE. A correlated `NOT EXISTS` closes that window inside the
    // statement itself; `NOT IN` would not, because a single NULL
    // `subscription_id` in the subquery makes the whole predicate UNKNOWN and the
    // UPDATE silently matches nothing.
    const relabelled = await db
        .update(billingSubscriptions)
        .set({ status: SubscriptionStatusEnum.ABANDONED, updatedAt: now })
        .where(
            and(
                inArray(billingSubscriptions.id, relabelTargets),
                inArray(billingSubscriptions.status, [...CANCELLATION_SPELLINGS]),
                sql`NOT EXISTS (SELECT 1 FROM billing_payments p WHERE p.subscription_id = ${billingSubscriptions.id})`
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
                ? `Held back ${heldBack.length} row(s) that matched the status+preapproval criteria — ` +
                  `by payments: ${heldBackByPayments.join(', ') || 'none'}; ` +
                  `by a recorded transition out of pending: ${heldBackByHistory.join(', ') || 'none'}. `
                : 'No suspect had payments or a recorded transition out of pending. ') +
            (gapsMinutes.length > 0
                ? `Corroboration only — created→cancelled gap in minutes for the relabelled rows: ${gapsMinutes.join(', ')} (an abandonment is timed by the hourly cron, so expect values just past the 30-minute TTL).`
                : ''),
        counts: {
            suspects: suspects.length,
            relabelled: relabelled.length,
            heldBackByPayments: heldBackByPayments.length,
            heldBackByHistory: heldBackByHistory.length,
            heldBackTotal: heldBack.length
        }
    };
}
