/**
 * @file benefit-usage-view.ts
 * @description Pure view logic for the host's benefit-usage screens (HOS-376 T-046).
 *
 * Kept out of the island so each decision can be tested without rendering, and
 * so the two that are genuinely subtle are stated once instead of inline in JSX.
 */

import type { BenefitUsageDeclaredBy, BenefitUsageStatus } from '@/lib/api/endpoints-protected';

/** The only two fields any of these decisions actually read. */
export interface BenefitUsageSide {
    readonly status: BenefitUsageStatus;
    readonly declaredBy: BenefitUsageDeclaredBy;
}

/**
 * Whether this row is one the HOST himself rejected, and may therefore reverse.
 *
 * Derived rather than read: the protected payload carries `rejectedAt` but not
 * `rejectedById`. It does not need to — only the COUNTERPART of `declaredBy`
 * can reject, so on the host's own page a REJECTED row that a provider declared
 * was necessarily refused by the host.
 *
 * The inverse matters more than it looks: a row the host declared and the
 * provider rejected must NOT offer undo. Only the account that rejected may
 * reverse it, which is exactly what stops the rejected party from overturning a
 * refusal aimed at them — and a button for it would 404.
 *
 * @param usage - The row's status and declaring side.
 * @returns True when the host may undo his own rejection.
 */
export function canUndoRejection(usage: BenefitUsageSide): boolean {
    return usage.status === 'REJECTED' && usage.declaredBy === 'PROVIDER';
}

/**
 * Whether this row is waiting on the host's answer.
 *
 * The host's own PENDING declaration waits on the PROVIDER, so it belongs in
 * the history and not in the inbox — the same definition the navigation badge
 * counts, so the badge can never disagree with the list underneath it.
 *
 * @param usage - The row's status and declaring side.
 * @returns True when the host is the one expected to answer.
 */
export function isAwaitingHostAnswer(usage: BenefitUsageSide): boolean {
    return usage.status === 'PENDING' && usage.declaredBy === 'PROVIDER';
}

/** `YYYY-MM-DD`, the shape a Postgres `date` column travels in. */
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Reads a `YYYY-MM-DD` service date as the calendar day it names.
 *
 * `new Date('2026-08-01')` is UTC midnight, which is 2026-07-31 21:00 in
 * Argentina — so the obvious one-liner renders every service date one day
 * early. The parts are therefore fed to the local-time constructor instead.
 *
 * @param value - The calendar date as stored and transported.
 * @returns A local-midnight `Date`, or null when the value names no real day.
 */
export function parseCalendarDate(value: string): Date | null {
    const match = CALENDAR_DATE.exec(value);
    if (!match) return null;

    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));

    // Rejects `2026-02-31`, which the constructor would silently roll into March.
    if (
        parsed.getFullYear() !== Number(year) ||
        parsed.getMonth() !== Number(month) - 1 ||
        parsed.getDate() !== Number(day)
    ) {
        return null;
    }

    return parsed;
}
