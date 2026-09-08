/**
 * Accommodation publish-eligibility schema (HOS-1183).
 *
 * The wire shape of "what would happen if this owner published a listing right
 * now", produced by `AccommodationService.getPublishEligibility` and served by
 * `GET /api/v1/protected/accommodations/publish-eligibility`.
 *
 * ## Why the verdict crosses the wire at all
 *
 * `POST /accommodations/{id}/publish` resolves three outcomes and two of them
 * publish, but the resolver was unreadable: `checkEligibility` is a closure
 * inside the deps object `publish()` holds, so a client could only learn the
 * answer by posting and taking the 403. The card's publish button therefore
 * gated on a plan-shaped boolean instead — which is `has_active_sub` and
 * nothing else — and hid itself from exactly the owner whose accommodation
 * trial was still intact.
 *
 * ## Sibling of, not shared with, the commerce verdict
 *
 * `CommerceTrialVerdictKindSchema` answers the same question for commerce
 * verticals and deliberately spells its states differently
 * (`trial_available` / `payment_required`), because publishing a commerce
 * listing opens a MercadoPago checkout where publishing an accommodation starts
 * a local trial. Two enums rather than one: merging them would force one name
 * onto two different mechanisms, and the next change to either would have to
 * decide which vertical it meant.
 *
 * @module api/billing/publish-eligibility
 */

import { z } from 'zod';

/**
 * The three states an accommodation owner can be in, mirroring the
 * `PublishEligibility` union in `@repo/service-core`.
 *
 * An explicit enum rather than a free string so an unknown state is a
 * validation failure at the boundary instead of an unhandled branch in the UI.
 */
export const PublishEligibilityKindSchema = z.enum([
    /** No live owner subscription, accommodation trial unspent: publishing starts it. */
    'first_publish',
    /** Already on a live owner/complex plan: publishing just flips the lifecycle. */
    'has_active_sub',
    /** Trial spent and no live plan: publishing is refused, the owner goes to plans. */
    'subscription_required'
]);

/** One of the three verdict states. */
export type PublishEligibilityKind = z.infer<typeof PublishEligibilityKindSchema>;

/**
 * `GET /api/v1/protected/accommodations/publish-eligibility` response.
 *
 * Three fields for three questions. `canPublish` is NOT redundant with
 * `eligibility`: platform staff bypass the billing gate entirely, so they
 * publish while their honest verdict stays `subscription_required`. A consumer
 * that gates an affordance reads `canPublish`; one that picks copy reads the
 * other two.
 */
export const PublishEligibilityResponseSchema = z.object({
    /**
     * What billing says, verbatim. Never rewritten for staff — it stays the
     * honest answer, so "which owner is this" survives into any later
     * diagnosis.
     */
    eligibility: PublishEligibilityKindSchema,
    /**
     * Whether `publish()` would accept right now, staff bypass included. This
     * is the field a publish button gates on.
     *
     * It answers for BILLING only. Per-listing completeness — a main photo,
     * bathrooms, the rest of the publish guard — is a separate gate enforced
     * when the publish actually runs, and this endpoint deliberately does not
     * predict it: it is resolved once per owner, not once per listing.
     */
    canPublish: z.boolean(),
    /**
     * Whether publishing would start a Hospeda-owned trial and its clock.
     *
     * Carried rather than derived from `eligibility === 'first_publish'` for
     * two reasons: that comparison in a client is how this bug is reintroduced,
     * and it would be wrong for staff, who publish on any verdict and are never
     * given a trial. A trial line shown to them would promise a clock that
     * never starts.
     */
    startsTrial: z.boolean()
});

/** Response of the accommodation publish-eligibility endpoint. */
export type PublishEligibilityResponse = z.infer<typeof PublishEligibilityResponseSchema>;
