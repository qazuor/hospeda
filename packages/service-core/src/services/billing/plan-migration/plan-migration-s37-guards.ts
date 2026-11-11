import { PLAN_MIGRATION_REASONS } from '@repo/db';
import { getLocalDateString } from '@repo/utils';

/**
 * Technical lead time of `S37` (TRANS:B:S37): seven local days before the
 * migration's application date. It is not a configurable commercial value:
 * `NUCLEO/02` §1.5 fixes it because it leaves room for the three-day amount
 * mutation retry before the charge (`20-fase-3/B12.md:224-226`).
 */
export const PLAN_MIGRATION_S37_LEAD_DAYS = 7;

/** Typed reason a row does not proceed through `S37`. */
export type PlanMigrationS37GuardReason =
    | 'MIGRATION_CANCELLED'
    | 'REASON_NOT_SUPPORTED'
    | 'SCOPE_NOT_PENDING'
    | 'NOT_PRINCIPAL'
    | 'SUBSCRIPTION_NOT_ACTIVE'
    | 'SUCCESSION_IN_PROGRESS'
    | 'QUEUED_CHANGE_EXISTS'
    | 'DESTINATION_CYCLE_MISSING'
    | 'NOT_YET_DUE'
    | 'APPLICATION_DATE_REACHED';

/** Verdict of the pure `S37` guards. */
export type PlanMigrationS37GuardVerdict =
    | { readonly verdict: 'PROCEED' }
    | {
          readonly verdict: 'SKIPPED' | 'WAITING' | 'NOT_DUE';
          readonly reason: PlanMigrationS37GuardReason;
      };

/**
 * Evaluates every `S37` guard for one migration row (TRANS:B:S37).
 *
 * Both motives of `PLAN_MIGRATION_REASONS` walk the same `S37` path; any other
 * motive is skipped with a typed reason instead of a buried branch.
 * The window compares MARKET-LOCAL calendar days (never instants), so a clock
 * late in the local day still lands on the right day.
 *
 * @param input.reason - The migration motive (`RETIREMENT` or `PRICE_INCREASE`)
 * @param input.migrationCancelled - Whether `plan_migration.cancelled_at` is set
 * @param input.scopeStatus - The participation row status
 * @param input.subscription - The principal row's class, status and succession slots
 * @param input.hasQueuedChange - Whether `subscription_scheduled_change` has a row
 * @param input.targetOffersCycle - Whether the destination offers the row's cycle
 * @param input.applicationDate - The row's application date
 * @param input.today - The act's instant
 * @returns `PROCEED` or the typed verdict that stops the row
 */
export function evaluateS37Guards(input: {
    readonly reason: string;
    readonly migrationCancelled: boolean;
    readonly scopeStatus: string;
    readonly subscription: {
        readonly class: string;
        readonly status: string;
        readonly successionInProgress: boolean;
    };
    readonly hasQueuedChange: boolean;
    readonly targetOffersCycle: boolean;
    readonly applicationDate: Date;
    readonly today: Date;
}): PlanMigrationS37GuardVerdict {
    if (input.migrationCancelled) return { verdict: 'SKIPPED', reason: 'MIGRATION_CANCELLED' };
    if (!(PLAN_MIGRATION_REASONS as readonly string[]).includes(input.reason))
        return { verdict: 'SKIPPED', reason: 'REASON_NOT_SUPPORTED' };
    if (input.scopeStatus !== 'PENDIENTE')
        return { verdict: 'SKIPPED', reason: 'SCOPE_NOT_PENDING' };
    if (input.subscription.class !== 'PRINCIPAL')
        return { verdict: 'SKIPPED', reason: 'NOT_PRINCIPAL' };
    if (input.subscription.status !== 'ACTIVE')
        return { verdict: 'WAITING', reason: 'SUBSCRIPTION_NOT_ACTIVE' };
    if (input.subscription.successionInProgress)
        return { verdict: 'WAITING', reason: 'SUCCESSION_IN_PROGRESS' };
    if (input.hasQueuedChange) return { verdict: 'SKIPPED', reason: 'QUEUED_CHANGE_EXISTS' };
    if (!input.targetOffersCycle)
        return { verdict: 'SKIPPED', reason: 'DESTINATION_CYCLE_MISSING' };

    const applicationDay = getLocalDateString({ instant: input.applicationDate });
    const today = getLocalDateString({ instant: input.today });
    if (today >= applicationDay) return { verdict: 'NOT_DUE', reason: 'APPLICATION_DATE_REACHED' };
    if (today < subtractDays(applicationDay, PLAN_MIGRATION_S37_LEAD_DAYS))
        return { verdict: 'NOT_DUE', reason: 'NOT_YET_DUE' };
    return { verdict: 'PROCEED' };
}

function subtractDays(day: string, days: number): string {
    const [year, month, date] = day.split('-').map(Number);
    const instant = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) - days));
    return `${instant.getUTCFullYear().toString().padStart(4, '0')}-${(instant.getUTCMonth() + 1)
        .toString()
        .padStart(2, '0')}-${instant.getUTCDate().toString().padStart(2, '0')}`;
}
