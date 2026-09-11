/**
 * Accommodation publish-eligibility read endpoint — HOS-1183 D-1.
 *
 * Answers what `POST /accommodations/{id}/publish` would decide for the
 * authenticated owner, without writing anything.
 *
 * @route GET /api/v1/protected/accommodations/publish-eligibility
 */
import { PublishEligibilityResponseSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getQZPayBilling } from '../../../middlewares/billing';
import { buildAccommodationPublishDeps } from '../../../services/accommodation-publish-deps';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

// Same wiring as the publish route itself. The billing client is passed as a
// getter rather than a value so the resolver reads it per request instead of
// capturing a `null` when module load races billing initialisation.
const accommodationService = new AccommodationService(
    { logger: apiLogger },
    undefined,
    null,
    undefined,
    buildAccommodationPublishDeps(() => getQZPayBilling())
);

/**
 * GET /api/v1/protected/accommodations/publish-eligibility
 *
 * ## Why this endpoint exists
 *
 * The publish verdict had no reader. `checkEligibility` lives in a closure
 * inside the deps object `publish()` holds, so the only way to learn it was to
 * POST `/publish` and take the 403 — and a publish button cannot be rendered
 * from an error it has not caused yet. So the card gated on "does this owner
 * have a plan loaded", which is `has_active_sub` and nothing else, and vanished
 * for owners the server would have published.
 *
 * ## Owner-level, not per-listing
 *
 * Billing eligibility is a property of the OWNER, so a page rendering N cards
 * resolves it once. A per-listing variant would multiply a billing read by
 * portfolio size for an answer that cannot differ between two listings of the
 * same owner.
 *
 * The corollary is that a `canPublish: true` here is not a promise that any
 * given listing will publish: per-listing completeness (main photo, bathrooms,
 * the rest of the publish guard) is enforced by `publish()` afterwards. This
 * endpoint answers the billing half, which is the half the button was reading
 * wrong.
 *
 * ## Not HOS-1156's precheck
 *
 * `GET /protected/publish/precheck/{vertical}` answers "can you CREATE another
 * listing" — caps and drafts, asked before a create form renders. This answers
 * "can you put an existing one LIVE". Different gate, different moment; folding
 * them together would couple two questions that never separate again.
 *
 * No entitlement gate: this READS billing state, so gating it on an
 * entitlement would make the answer depend on the thing it reports. It is
 * authenticated and scoped to the actor, which is the whole authorisation
 * surface it needs — there is no id to own.
 */
export const protectedGetPublishEligibilityRoute = createProtectedRoute({
    method: 'get',
    path: '/publish-eligibility',
    summary: 'Get publish eligibility (owner)',
    description:
        "Returns the authenticated owner's accommodation publish eligibility: the " +
        'billing verdict, whether publishing would be accepted right now (staff ' +
        'billing bypass included), and whether it would start a free trial. Read-only ' +
        'mirror of the decision POST /accommodations/{id}/publish makes.',
    tags: ['Accommodations'],
    responseSchema: PublishEligibilityResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.getPublishEligibility(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
