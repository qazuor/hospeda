/**
 * Courtesy grant calculations (HOS-180)
 *
 * Pure date arithmetic and eligibility rules for gifting N free billing cycles
 * to a paying subscriber. No I/O, no clock of its own — everything is injected,
 * so every boundary condition is testable in isolation.
 *
 * @module services/billing/subscription/courtesy-grant.calc
 */

import { addCalendarMonths, type DayOverflowRule } from '@repo/utils';

/**
 * Minimum days that must remain before the next MercadoPago charge for a grant
 * to be accepted (spec AC-12, R-6).
 *
 * ## Why a lead time exists at all
 *
 * Pausing the preapproval is what stops the next charge. A grant issued too
 * close to the due date can land after MercadoPago has already begun
 * collecting — and then the subscriber is charged for precisely the cycle they
 * were given, which is the exact opposite of the feature.
 *
 * ## Why three days, honestly
 *
 * It is a judgement call, not a measurement. **How far ahead MercadoPago
 * actually commits a charge was never measured** — the sandbox experiment that
 * validated pause/resume did not cover it. Three days is the owner's choice of
 * a margin wide enough to absorb a provider-side head start without making the
 * feature impractical to use. If the real commit window is ever measured, this
 * is the single constant to revisit.
 */
export const COURTESY_MIN_LEAD_DAYS = 3;

const MS_PER_DAY = 86_400_000;

/** Billing cadences a courtesy can span. */
export type CourtesyCadence = 'monthly' | 'annual';

/** Why a courtesy grant was refused. */
export type CourtesyGrantRefusal =
    | {
          readonly kind: 'not-enough-lead-time';
          readonly nextChargeAt: Date;
          readonly daysUntil: number;
      }
    | { readonly kind: 'no-period-end' }
    | { readonly kind: 'invalid-cycles'; readonly cycles: number };

/** A computed, accepted courtesy window. */
export interface CourtesyWindow {
    /** When the gift begins: the end of the period already paid for. */
    readonly courtesyStartsAt: Date;
    /** When the gift expires: `courtesyStartsAt` plus `cycles` cadence steps. */
    readonly courtesyEndsAt: Date;
    /** Cycles gifted, echoed back for the audit trail. */
    readonly courtesyCyclesGranted: number;
}

/** Result of {@link computeCourtesyWindow}. */
export type CourtesyGrantResult =
    | { readonly ok: true; readonly window: CourtesyWindow }
    | { readonly ok: false; readonly refusal: CourtesyGrantRefusal };

/**
 * What the courtesy window does when the period end falls on a day the target
 * month does not have — 31 January plus one month lands on 28 February.
 *
 * ## This is our decision, not a copy of MercadoPago's
 *
 * The issue that found this bug assumed the rule had to be measured from
 * MercadoPago and imitated, on the reasoning that our window and the real
 * charge would otherwise diverge exactly at the boundary. That reasoning does
 * not apply here, and the mechanism is why: **a courtesy is a PAUSED
 * preapproval plus a local window**. While the gift runs, MercadoPago is not
 * charging and is not computing a cycle date at all — `courtesy-expiry.job`
 * resumes the preapproval when this window closes. There is no provider-side
 * date to diverge from.
 *
 * So the rule decides two things, and both are ours: how many days the gift
 * lasts, and which day of the month the subscriber is left billing on once the
 * preapproval resumes.
 *
 * ## Why clamp
 *
 * The three days are marginal. Where the subscriber ENDS UP is not. Clamping
 * leaves someone who billed on the 31st billing on the 28th — shifted, but
 * still anchored to the end of the month. Overflowing moves them to the 3rd of
 * the following month, which is not a shift but a change of anchor, it does not
 * revert on its own, and it cannot be stated on a screen: "your one month of
 * courtesy from 31 January ends on 3 March" is not a sentence a subscriber can
 * act on. In a feature whose whole purpose is to make someone feel well
 * treated, that confusion costs more than the days it hands out.
 *
 * Searched for documentation before deciding: MercadoPago does not document the
 * case anywhere (2026-09-01). Its `billing_day` field is reportedly restricted
 * to days 1-28, which would sidestep the question entirely, but that could not
 * be confirmed against the reference and we do not use that field.
 *
 * Owner decision, 2026-09-01. Every period ending on day 1-28 is identical
 * under either rule — only day 29-31 is at stake — and changing it stays a
 * one-line edit here, which is why {@link addCalendarMonths} takes the rule as
 * an argument instead of assuming one.
 */
const COURTESY_DAY_OVERFLOW: DayOverflowRule = 'clamp';

/**
 * Adds `cycles` billing periods to a date.
 *
 * Uses calendar months rather than fixed day counts, so a gift spanning
 * February is still "one month" and lands on the same day-of-month the
 * subscriber is used to being charged.
 *
 * ## Why this delegates instead of calling `setMonth`
 *
 * It used to be `result.setMonth(result.getMonth() + months)`, and that is
 * wrong in a way that is invisible in CI. `getMonth`/`setMonth` read and write
 * in the process's LOCAL timezone, while `currentPeriodEnd` arrives from a
 * `timestamptz` column as a UTC instant. Under `TZ=America/Argentina/Buenos_Aires`,
 * `2026-02-01T00:00:00.000Z` is 31 January locally, so the arithmetic ran on
 * the wrong month and the window came out **three days long** — and three days
 * **short** the following month. Production and CI run in UTC and never saw it.
 *
 * See {@link COURTESY_DAY_OVERFLOW} for the end-of-month rule, which is a
 * separate question and still unmeasured.
 */
function addCycles(from: Date, cycles: number, cadence: CourtesyCadence): Date {
    const months = cadence === 'annual' ? cycles * 12 : cycles;
    return addCalendarMonths({ from, months, dayOverflow: COURTESY_DAY_OVERFLOW });
}

/**
 * Computes the courtesy window for a grant, or refuses it.
 *
 * The window starts at `currentPeriodEnd`, **not** at the grant instant
 * (spec OQ-4): the subscriber already paid for the cycle in flight, so the gift
 * is what comes after it. This is why granting and starting are two separate
 * moments, and why the subscriber hears about the gift twice.
 *
 * The lead-time check is the guardrail from R-6 — see
 * {@link COURTESY_MIN_LEAD_DAYS} for what it does and does not prove.
 *
 * @param args.currentPeriodEnd - End of the period already paid for; also the
 *   moment MercadoPago would next charge. `null` refuses the grant, since
 *   without it there is no boundary to start from and no charge to outrun.
 * @param args.cycles - How many cycles to gift. Must be a positive integer;
 *   there is no upper cap (spec OQ-5).
 * @param args.cadence - The subscription's billing cadence.
 * @param args.now - Injected clock.
 * @returns The computed window, or a typed refusal.
 *
 * @example
 * ```ts
 * // Two months gifted on a monthly plan whose period ends in three weeks
 * computeCourtesyWindow({
 *   currentPeriodEnd: new Date('2026-10-01'),
 *   cycles: 2,
 *   cadence: 'monthly',
 *   now: new Date('2026-09-10'),
 * });
 * // => { ok: true, window: { courtesyStartsAt: 2026-10-01,
 * //                          courtesyEndsAt: 2026-12-01, ... } }
 * ```
 */
export function computeCourtesyWindow(args: {
    readonly currentPeriodEnd: Date | null | undefined;
    readonly cycles: number;
    readonly cadence: CourtesyCadence;
    readonly now: Date;
}): CourtesyGrantResult {
    const { currentPeriodEnd, cycles, cadence, now } = args;

    if (!Number.isInteger(cycles) || cycles <= 0) {
        return { ok: false, refusal: { kind: 'invalid-cycles', cycles } };
    }

    if (currentPeriodEnd === null || currentPeriodEnd === undefined) {
        return { ok: false, refusal: { kind: 'no-period-end' } };
    }

    const msUntilCharge = currentPeriodEnd.getTime() - now.getTime();
    const daysUntil = msUntilCharge / MS_PER_DAY;

    if (daysUntil < COURTESY_MIN_LEAD_DAYS) {
        return {
            ok: false,
            refusal: {
                kind: 'not-enough-lead-time',
                nextChargeAt: currentPeriodEnd,
                // Floor, so the message never overstates the room left. A grant
                // 2.9 days out reports "2 days", not "3" — reporting 3 would name
                // exactly the threshold that just rejected it.
                daysUntil: Math.floor(daysUntil)
            }
        };
    }

    return {
        ok: true,
        window: {
            courtesyStartsAt: currentPeriodEnd,
            courtesyEndsAt: addCycles(currentPeriodEnd, cycles, cadence),
            courtesyCyclesGranted: cycles
        }
    };
}
