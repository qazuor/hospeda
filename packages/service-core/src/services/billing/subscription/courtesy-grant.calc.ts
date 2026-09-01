/**
 * Courtesy grant calculations (HOS-180)
 *
 * Pure date arithmetic and eligibility rules for gifting N free billing cycles
 * to a paying subscriber. No I/O, no clock of its own — everything is injected,
 * so every boundary condition is testable in isolation.
 *
 * @module services/billing/subscription/courtesy-grant.calc
 */

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
 * Adds `cycles` billing periods to a date.
 *
 * Uses calendar months rather than fixed day counts, so a gift spanning
 * February is still "one month" and lands on the same day-of-month the
 * subscriber is used to being charged. `Date` clamps an overflowing day
 * (31 January + 1 month) to the end of the target month on its own, which is
 * the same behaviour a billing provider applies.
 */
function addCycles(from: Date, cycles: number, cadence: CourtesyCadence): Date {
    const result = new Date(from.getTime());
    const months = cadence === 'annual' ? cycles * 12 : cycles;
    result.setMonth(result.getMonth() + months);
    return result;
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
