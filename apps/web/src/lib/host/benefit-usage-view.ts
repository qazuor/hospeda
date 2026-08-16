/**
 * @file benefit-usage-view.ts
 * @description Pure view logic for the host's benefit-usage screens (HOS-376 T-046).
 *
 * Kept out of the island so each decision can be tested without rendering, and
 * so the two that are genuinely subtle are stated once instead of inline in JSX.
 */

import { parseCalendarDate as parseSharedCalendarDate } from '@repo/utils';
import type { BenefitUsageDeclaredBy, BenefitUsageStatus } from '@/lib/api/endpoints-protected';

/** The only two fields any of these decisions actually read. */
export interface BenefitUsageSide {
    readonly status: BenefitUsageStatus;
    readonly declaredBy: BenefitUsageDeclaredBy;
}

/**
 * Whether a row is waiting on the answer of the side reading it.
 *
 * THE ONE RULE OF THIS FLOW, stated once: the COUNTERPART of `declaredBy`
 * answers. It is role-blind by construction — the row decides, never the
 * actor's role — which is what lets a single account be host and provider at
 * the same time without either screen guessing wrong.
 *
 * Written as a mirror rather than as two hand-rolled predicates because the
 * provider's half of the flow was missing entirely (H-06/H-65/H-159): the host
 * had an inbox with buttons, the provider had a read-only list, and every usage
 * a host declared sat PENDING until it expired because nobody could answer it.
 * Deriving both sides from one expression is what stops that from happening
 * again on whichever side gets built next.
 *
 * @param usage - The row's status and declaring side.
 * @param side - The side reading the row.
 * @returns True when `side` is the one expected to answer.
 */
export function isAwaitingAnswerFrom(
    usage: BenefitUsageSide,
    side: BenefitUsageDeclaredBy
): boolean {
    return usage.status === 'PENDING' && usage.declaredBy !== side;
}

/**
 * Whether the side reading this row is the one that rejected it, and may undo.
 *
 * Same derivation as {@link isAwaitingAnswerFrom} and for the same reason: only
 * the counterpart can reject, so a REJECTED row not declared by `side` was
 * necessarily refused by `side`. The inverse is what matters — a row `side`
 * declared and the counterpart rejected must NOT offer undo, or the rejected
 * party could overturn a refusal aimed at them, and the button would 404.
 *
 * @param usage - The row's status and declaring side.
 * @param side - The side reading the row.
 * @returns True when `side` may reverse its own rejection.
 */
export function canUndoRejectionFrom(
    usage: BenefitUsageSide,
    side: BenefitUsageDeclaredBy
): boolean {
    return usage.status === 'REJECTED' && usage.declaredBy !== side;
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
    return canUndoRejectionFrom(usage, 'HOST');
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
    return isAwaitingAnswerFrom(usage, 'HOST');
}

/** `YYYY-MM-DD`, the shape a Postgres `date` column travels in. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads a `YYYY-MM-DD` service date as the calendar day it names.
 *
 * `new Date('2026-08-01')` is UTC midnight, which is 2026-07-31 21:00 in
 * Argentina — so the obvious one-liner renders every service date one day
 * early. The August 2026 smoke found the same defect on four other screens
 * (H-09, H-63, H-73, H-84), so the date arithmetic now lives once, in
 * `@repo/utils`; this stays as the host surface's narrow door onto it.
 *
 * Narrow on purpose: the shared helper also accepts a full ISO instant, and
 * this one must not. `servicedAt` is a Postgres `date` and always arrives bare,
 * so anything else reaching here is the wrong field, and returning null is how
 * that gets noticed instead of silently rendered.
 *
 * @param value - The calendar date as stored and transported.
 * @returns A local-midnight `Date`, or null when the value names no real day.
 */
export function parseCalendarDate(value: string): Date | null {
    if (!CALENDAR_DATE.test(value)) return null;

    // Also rejects `2026-02-31`, which the Date constructor would silently roll
    // forward into March.
    return parseSharedCalendarDate({ value });
}
