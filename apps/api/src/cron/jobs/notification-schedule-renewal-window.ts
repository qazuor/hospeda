/**
 * Renewal-reminder window decision (HOS-854).
 *
 * Decides whether a subscription is owed a "your subscription renews soon"
 * reminder. Extracted from `notification-schedule.job.ts` so the rule is a pure,
 * directly testable function: the job wraps its whole renewal pass in a
 * try/catch that logs and moves on, so any defect in this predicate surfaces
 * there only as "zero reminders sent" — indistinguishable from "nothing was due".
 *
 * @module cron/jobs/notification-schedule-renewal-window
 */

/**
 * Days before renewal when reminders should be sent.
 * Sends at 7 days, 3 days, and 1 day before subscription renewal.
 */
export const RENEWAL_REMINDER_DAYS: readonly number[] = [7, 3, 1] as const;

/** Milliseconds in a day, used to turn a remaining span into whole days. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Subscription statuses that may legitimately receive a renewal reminder.
 *
 * The billing listing is already asked to filter this
 * (`subscriptions.list({ filters: { status: 'active' } })`), but that filter was
 * silently ignored: the Drizzle storage adapter reads only `limit`/`offset` and
 * drops `options.filters` entirely, so `abandoned` and `pending_provider` rows
 * reached this job (HOS-854). Re-checking here is defence in depth — the same
 * stance `trial-expiry.ts` already takes — and it stays even after the adapter
 * is fixed, because this job must never depend on the listing being clean.
 *
 * Trialing subscriptions are deliberately excluded: their reminders come from a
 * separate pipeline (`processTrialReminders`) with durable dedup. `past_due`,
 * `paused` and `comp` are excluded because none of them is an upcoming charge.
 *
 * Compared as a raw string rather than through
 * `normalizeStoredSubscriptionStatus` (`@repo/service-core`), which is the
 * canonical translator for `billing_subscriptions.status` — that column mixes
 * qzpay vocabulary (`incomplete`, `canceled`) with Hospeda's
 * (`pending_provider`, `cancelled`). That is safe ONLY because `active` is
 * spelled identically in both vocabularies. If this set ever grows beyond
 * `active`, normalize first: a raw comparison would silently miss the
 * qzpay-spelled half of the column.
 */
const RENEWAL_ELIGIBLE_STATUSES: ReadonlySet<string> = new Set(['active']);

/** Minimal shape this decision needs from a listed subscription. */
export type RenewalReminderCandidate = {
    readonly status?: string | null;
    readonly currentPeriodEnd?: string | Date | null;
};

/**
 * Verdict for a single subscription: either no reminder, or one due in N days.
 *
 * `renewalDate` is the parsed `currentPeriodEnd`, returned so the caller can put
 * it in the notification payload without parsing the value a second time.
 */
export type RenewalReminderVerdict =
    | { readonly due: false }
    | { readonly due: true; readonly daysRemaining: number; readonly renewalDate: Date };

/**
 * Decides whether a subscription is owed a renewal reminder at `now`.
 *
 * Shared by the job's real and `dryRun` branches so the two can never drift.
 * Before HOS-854 each branch carried its own copy of this arithmetic, which is
 * why fixing one would have left the other reporting inflated counts.
 *
 * @param params.subscription - Subscription as returned by the billing listing.
 * @param params.now - Reference instant, injected so callers and tests are deterministic.
 * @param params.reminderDays - Day offsets that trigger a reminder (7, 3, 1).
 * @returns `{ due: false }`, or `{ due: true, daysRemaining, renewalDate }` when one is owed.
 */
export function evaluateRenewalReminder(params: {
    subscription: RenewalReminderCandidate;
    now: Date;
    reminderDays: ReadonlySet<number>;
}): RenewalReminderVerdict {
    const { subscription, now, reminderDays } = params;

    if (!subscription.currentPeriodEnd) return { due: false };
    if (!RENEWAL_ELIGIBLE_STATUSES.has(String(subscription.status ?? ''))) return { due: false };

    const renewalDate = new Date(subscription.currentPeriodEnd);
    const msRemaining = renewalDate.getTime() - now.getTime();
    if (Number.isNaN(msRemaining)) return { due: false };

    // An elapsed period is not an upcoming renewal — it is a subscription that
    // already ended. The previous `Math.max(..., 1)` folded every negative span
    // onto 1, the exact value that triggers the "renews tomorrow" reminder, so
    // expired rows qualified forever and were re-sent daily (HOS-854).
    if (msRemaining < 0) return { due: false };

    // The clamp survives only for the boundary case it was actually written
    // for: `Math.ceil(0)` is 0, which is not a reminder day. A subscription
    // ending at the exact instant of this check is therefore reported as
    // 1 day remaining, and does get the "renews tomorrow" reminder.
    const daysRemaining = Math.max(Math.ceil(msRemaining / MS_PER_DAY), 1);
    if (!reminderDays.has(daysRemaining)) return { due: false };

    return { due: true, daysRemaining, renewalDate };
}
