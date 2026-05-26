/**
 * Self-serve Subscription Pause / Resume Schemas (SPEC-143 #29)
 *
 * Schemas for the host self-serve endpoints that pause or resume the
 * authenticated user's own subscription:
 *
 * - `POST /api/v1/protected/billing/subscriptions/me/pause`
 * - `POST /api/v1/protected/billing/subscriptions/me/resume`
 *
 * A host self-pause is always "full": it stops billing (MercadoPago preapproval
 * paused) AND suspends service (hides the owner's accommodations from public
 * reads and edit-locks them). Resume reverts both. There is no request body —
 * the operation targets the caller's own active/paused subscription.
 *
 * @module api/billing/subscription-pause
 */

import { z } from 'zod';
import { SubscriptionStatusEnumSchema } from '../../enums/subscription-status.schema.js';

/**
 * Response body shared by the self-serve pause and resume endpoints.
 *
 * `accommodationsUpdated` is the number of the owner's accommodations whose
 * denormalized `ownerSuspended` flag flipped as part of the service-suspension
 * side effect (0 when the owner has no listings).
 */
export const SubscriptionPauseResumeResponseSchema = z.object({
    success: z.boolean(),
    subscriptionId: z.string().describe('The subscription that was paused or resumed'),
    status: SubscriptionStatusEnumSchema.describe('The resulting subscription status'),
    accommodationsUpdated: z
        .number()
        .int()
        .describe("Count of the owner's accommodations whose ownerSuspended flag changed")
});
export type SubscriptionPauseResumeResponse = z.infer<typeof SubscriptionPauseResumeResponseSchema>;
