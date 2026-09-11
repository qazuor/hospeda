/**
 * Self-serve Subscription Pause / Resume Schemas (SPEC-143 #29)
 *
 * Schemas for the host self-serve endpoints that pause or resume the
 * authenticated user's own subscription:
 *
 * - `POST /api/v1/protected/billing/me/subscription-pause`
 * - `POST /api/v1/protected/billing/me/subscription-resume`
 *
 * A self-pause always stops billing (MercadoPago preapproval paused). The
 * SERVICE-suspension side effect is domain-dependent (HOS-1278): an
 * ACCOMMODATION-domain subscription hides/edit-locks the owner's
 * accommodations (`accommodationsUpdated` below); a commerce
 * (gastronomy/experience) subscription instead flips its linked listing's
 * visibility through the shared `reconcileSubscriptionLinkedEntities` bridge,
 * which does not touch `accommodationsUpdated` at all. Resume reverts
 * whichever effect applied.
 *
 * `subscriptionId` is REQUIRED in the request body (HOS-1278). Before this,
 * the route had no body at all and guessed the caller's "current" subscription
 * via `getByCustomerId().find()` — ambiguous for anyone holding more than one
 * subscription (a dual host/commerce owner, or a host auto-promoted from
 * tourist), and unable to tell a partner's own subscription apart from
 * anything else. The id makes the target explicit; the route still verifies
 * it belongs to the caller.
 *
 * @module api/billing/subscription-pause
 */

import { z } from 'zod';
import { SubscriptionStatusEnumSchema } from '../../enums/subscription-status.schema.js';

/**
 * Request body shared by the self-serve pause and resume endpoints (HOS-1278).
 */
export const SubscriptionPauseResumeRequestSchema = z.object({
    subscriptionId: z
        .string()
        .min(1)
        .describe(
            'The id of the subscription to pause/resume. Required so the caller can ' +
                "disambiguate among the customer's subscriptions — the route no longer " +
                'guesses via getByCustomerId().find().'
        )
});
export type SubscriptionPauseResumeRequest = z.infer<typeof SubscriptionPauseResumeRequestSchema>;

/**
 * Response body shared by the self-serve pause and resume endpoints.
 *
 * `accommodationsUpdated` is the number of the owner's accommodations whose
 * denormalized `ownerSuspended` flag flipped as part of the service-suspension
 * side effect. It is always `0` for a non-accommodation-domain subscription
 * (gastronomy, experience, partner) — that domain's listing visibility is
 * driven by the shared subscription-linked-entities bridge instead, which has
 * no per-accommodation count to report (HOS-1278).
 */
export const SubscriptionPauseResumeResponseSchema = z.object({
    success: z.boolean(),
    subscriptionId: z.string().describe('The subscription that was paused or resumed'),
    status: SubscriptionStatusEnumSchema.describe('The resulting subscription status'),
    accommodationsUpdated: z
        .number()
        .int()
        .describe(
            "Count of the owner's accommodations whose ownerSuspended flag changed. " +
                'Always 0 for a non-accommodation-domain subscription.'
        )
});
export type SubscriptionPauseResumeResponse = z.infer<typeof SubscriptionPauseResumeResponseSchema>;
