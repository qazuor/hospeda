/**
 * Trial Eligibility Route (HOS-226)
 *
 * Lightweight, read-only endpoint answering whether the CURRENT
 * authenticated user is still eligible for a free trial.
 *
 * Exists because the pricing card's "N days free" badge is rendered from
 * `GET /api/v1/public/plans` — a public, unauthenticated, 1h-edge-cached
 * endpoint that is 100% static plan config and has no notion of "this
 * particular visitor already used their lifetime trial". That badge stays
 * exactly as-is (never gate it behind auth — see the Pricing Exception in
 * `apps/web/CLAUDE.md`); this endpoint lets the `PlanPurchaseButton` island
 * correct it client-side, at hydration time, only for a logged-in visitor
 * who turns out to be ineligible.
 *
 * Routes:
 * - GET /api/v1/protected/billing/trial-eligibility
 *
 * @module routes/billing/trial-eligibility
 */

import type { TrialEligibilityResponse } from '@repo/schemas';
import { TrialEligibilityQuerySchema, TrialEligibilityResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getQZPayBilling } from '../../middlewares/billing';
import { resolveTrialEligibility } from '../../services/billing/trial-eligibility.service';
import { createRouter } from '../../utils/create-app';
import { createCRUDRoute } from '../../utils/route-factory';

/**
 * Handler for the trial-eligibility endpoint.
 *
 * Extracted from the route definition for unit-testability, mirroring the
 * pattern used by `handleDowngradePreview` / `handleGetSubscriptionStatus`.
 *
 * @param c - Hono context (must carry `billingEnabled` + `billingCustomerId`,
 *   set by the parent billing router's middleware chain).
 * @param _params - Unused URL path params (none for this route).
 * @param _body - Unused request body (GET endpoint).
 * @param query - Validated query params (`{ planSlug?: string }`).
 * @returns `{ eligible, planSlug }` — see {@link TrialEligibilityResponseSchema}.
 * @throws HTTPException 503 when billing is not configured/available.
 * @throws HTTPException 400 when the caller has no billing customer on session.
 */
export const handleTrialEligibility = async (
    c: Context,
    _params: Record<string, unknown>,
    _body: Record<string, unknown>,
    query?: Record<string, unknown>
): Promise<TrialEligibilityResponse> => {
    const billingEnabled = c.get('billingEnabled');

    if (!billingEnabled) {
        throw new HTTPException(503, {
            message: 'Billing service is not configured'
        });
    }

    const billingCustomerId = c.get('billingCustomerId');

    if (!billingCustomerId) {
        throw new HTTPException(400, {
            message: 'No billing account found'
        });
    }

    const billing = getQZPayBilling();

    if (!billing) {
        throw new HTTPException(503, {
            message: 'Billing service is not available'
        });
    }

    const planSlug = (query?.planSlug as string | undefined) ?? null;

    const { eligible } = await resolveTrialEligibility({
        billing,
        customerId: billingCustomerId
    });

    return { eligible, planSlug };
};

/**
 * GET /api/v1/protected/billing/trial-eligibility
 *
 * Returns whether the authenticated user is still eligible for a free
 * trial (one trial per customer, for life). Read-only; no entitlement gate
 * beyond authentication — mirrors `GET /trial/status` and the
 * downgrade-preview route, which are informational in the same way.
 */
export const getTrialEligibilityRoute = createCRUDRoute({
    method: 'get',
    path: '/',
    summary: 'Get trial eligibility',
    description:
        'Returns whether the authenticated user is still eligible for a free trial (one trial per customer, for life, any status, any product domain). Read-only — never reserves or consumes a trial.',
    tags: ['Billing', 'Trial'],
    requestQuery: TrialEligibilityQuerySchema.shape,
    responseSchema: TrialEligibilityResponseSchema,
    handler: handleTrialEligibility
});

/**
 * Router that exposes the trial-eligibility endpoint.
 *
 * Mounted at the billing root as `/trial-eligibility`, sibling to `/trial`
 * (which owns the trial lifecycle) — this is a single read-only check, not
 * part of that lifecycle surface.
 */
const trialEligibilityRouter = createRouter();

trialEligibilityRouter.route('/', getTrialEligibilityRoute);

export { trialEligibilityRouter };
