/**
 * Commerce trial verdict schema (HOS-1184).
 *
 * The wire shape of "what happens if this owner publishes a listing in this
 * commerce vertical right now", produced by `resolveCommerceTrialVerdict`.
 *
 * ## Why three states and not a boolean
 *
 * This is the one design decision in the shape, and it is a correction rather
 * than a preference. The accommodation side already resolves three verdicts
 * server-side (`first_publish` / `has_active_sub` / `subscription_required`),
 * and its UI flattens them into a boolean meaning only `has_active_sub` — so it
 * hides the publish button from precisely the owner who still holds an intact
 * trial (HOS-1183). The commerce button repeats it today from the other side:
 * `hasVerticalSubscription ? 'Publicar' : 'Publicar y pagar'`, which will
 * promise a charge to an owner about to be granted thirty free days.
 *
 * `trial_available` and `has_active_sub` both mean "publishing works and costs
 * nothing today". Collapsing them loses the only thing the owner needs told
 * apart: whether a clock starts. So the verdict crosses the wire as three
 * named states, and a consumer that wants a boolean has to say which of the
 * three it is collapsing.
 *
 * @module api/billing/commerce-trial-verdict
 */

import { z } from 'zod';

/**
 * The three states an `(owner, commerce vertical)` pair can be in.
 *
 * Mirrors the `CommerceTrialVerdict` union in
 * `apps/api/src/services/commerce-trial-start.service.ts`. Kept as an explicit
 * enum rather than a free string so an unknown state is a validation failure at
 * the boundary instead of an unhandled branch in the UI.
 */
export const CommerceTrialVerdictKindSchema = z.enum([
    /** No live subscription, trial unspent: publishing starts a free trial. */
    'trial_available',
    /** Already paying for this vertical: publishing just attaches the listing. */
    'has_active_sub',
    /** Trial spent, no live subscription: publishing opens a MercadoPago checkout. */
    'payment_required'
]);

/** One of the three verdict states. */
export type CommerceTrialVerdictKind = z.infer<typeof CommerceTrialVerdictKindSchema>;

/**
 * `GET /api/v1/protected/commerce/subscriptions/{entityType}/trial-verdict`
 * response.
 */
export const CommerceTrialVerdictResponseSchema = z.object({
    /** Which of the three states this owner is in for this vertical. */
    verdict: CommerceTrialVerdictKindSchema,
    /**
     * How many days the trial would run. Present ONLY on `trial_available`.
     *
     * Optional rather than defaulted to zero: a `0` here would render as
     * "0 días de prueba gratis" in a copy string that interpolates it, which is
     * worse than the field being absent. The API reads it from the resolved
     * trial plan row rather than a constant, so the number the button promises
     * is the number the grant will write — the same reason the public pricing
     * pages read `trialDays` live from the database.
     */
    trialDays: z.number().int().positive().optional()
});

/** Response of the commerce trial-verdict endpoint. */
export type CommerceTrialVerdictResponse = z.infer<typeof CommerceTrialVerdictResponseSchema>;
