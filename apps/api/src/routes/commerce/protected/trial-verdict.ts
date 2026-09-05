/**
 * Read-only commerce trial verdict (HOS-1184).
 *
 * ```
 * GET /api/v1/protected/commerce/subscriptions/{entityType}/trial-verdict
 * ```
 *
 * What publishing a listing in this commerce vertical would do for the caller
 * right now: start a free trial, attach to a subscription they already pay for,
 * or open a MercadoPago checkout.
 *
 * ## Why this endpoint exists at all
 *
 * Because the owner's button currently guesses, and after this issue it would
 * guess wrong in the new direction. `CommerceListingActions.client.tsx` renders
 * `hasVerticalSubscription ? 'Publicar' : 'Publicar y pagar'` — a boolean, fed
 * SSR-side by whether a usage reading resolves. Under that shape an owner about
 * to be granted thirty free days reads "Publicar y pagar" and is told they are
 * about to be charged.
 *
 * That is the same defect HOS-1183 is fixing on the accommodation side, which
 * resolves three verdicts server-side and flattens them into a boolean meaning
 * only `has_active_sub` — hiding the publish button from exactly the owner whose
 * trial is intact. Rather than inherit it, the verdict crosses the wire as three
 * named states, and a consumer that wants a boolean has to name which of the
 * three it is collapsing.
 *
 * ## Why a GET and not a field on an existing payload
 *
 * The same reason `downgrade-preview` sits next door as its own read: the owner
 * has to be told what publishing will do BEFORE they press the button, and the
 * only other place the answer exists is the POST that already did it.
 *
 * Read-only and idempotent in the strong sense — it reserves no trial, writes no
 * billing row, and deliberately does NOT create the billing customer that
 * `start-subscription` creates on demand. A GET that renders a button must not
 * mint billing records for anyone who merely opened the page.
 *
 * @module routes/commerce/protected/trial-verdict
 */

import type { CommerceVertical } from '@repo/billing';
import type { CommerceTrialVerdictResponse } from '@repo/schemas';
import { CommerceTrialVerdictResponseSchema, PermissionEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { protectedAuthMiddleware } from '../../../middlewares/authorization';
import { getQZPayBilling } from '../../../middlewares/billing';
import { resolveCommerceTrialVerdict } from '../../../services/commerce-trial-start.service';
import { createRouter } from '../../../utils/create-app';
import { createCRUDRoute } from '../../../utils/route-factory';

/** Mirrors the sibling routes' enum so an unknown vertical is a 400. */
const CommerceVerticalSchema = z.enum(['gastronomy', 'experience']);

/** Path params for the verdict endpoint. */
const VerdictParamsSchema = {
    entityType: CommerceVerticalSchema
};

/**
 * Handler for the commerce trial verdict.
 *
 * Exported standalone so it is unit-testable against a mocked `Context`,
 * matching `handleCommerceDowngradePreview` next door.
 *
 * Status contract, in the error contract's mandated order:
 *   - 401/403 — auth + `COMMERCE_EDIT_OWN`, by the router's middleware.
 *   - 400 — a vertical outside the enum, by the param schema.
 *   - 503 — billing unavailable.
 *
 * Note what is NOT in that list. There is no 404 for "caller has no billing
 * customer", the way the downgrade preview has one, and the difference is not an
 * oversight: a preview of a subscription that does not exist has nothing to
 * describe, whereas an owner with no billing history has a perfectly definite
 * verdict — they are the one owner guaranteed not to have spent their trial. A
 * 404 here would make the brand-new owner, the most common caller of all, render
 * as "Publicar y pagar".
 *
 * @param ctx - The Hono request context.
 * @param params - Path params (`entityType`).
 * @returns A {@link CommerceTrialVerdictResponse}.
 */
export async function handleCommerceTrialVerdict(
    ctx: Context,
    params: Record<string, unknown>
): Promise<CommerceTrialVerdictResponse> {
    const entityType = params.entityType as CommerceVertical;

    const billing = getQZPayBilling();
    if (!billing) {
        throw new HTTPException(503, { message: 'Billing service is not available' });
    }

    // `null` is passed through rather than rejected — the service treats "no
    // customer yet" as an answerable state. See the note above.
    const billingCustomerId = (ctx.get('billingCustomerId') as string | null) ?? null;

    const { verdict, trialDays } = await resolveCommerceTrialVerdict({
        billing,
        customerId: billingCustomerId,
        vertical: entityType
    });

    // `trialDays` is spread only when present: the schema types it optional
    // precisely so a `0` cannot reach a copy string that interpolates it and
    // render "0 días de prueba gratis".
    return { verdict, ...(trialDays === undefined ? {} : { trialDays }) };
}

/**
 * GET /api/v1/protected/commerce/subscriptions/{entityType}/trial-verdict
 */
export const protectedCommerceTrialVerdictRoute = createCRUDRoute({
    method: 'get',
    path: '/subscriptions/{entityType}/trial-verdict',
    summary: 'What publishing in this commerce vertical would do right now',
    description:
        "Read-only. Returns one of three states for the caller in one commerce vertical: `trial_available` (publishing starts a free trial, with `trialDays`), `has_active_sub` (publishing attaches the listing to a subscription they already pay for), or `payment_required` (publishing opens a checkout). Reserves nothing and writes nothing. Deliberately three states rather than a boolean — the first two both mean 'publishing costs nothing today' and differ only in whether a clock starts.",
    tags: ['Protected - Commerce', 'Billing', 'Trial'],
    requestParams: VerdictParamsSchema,
    responseSchema: CommerceTrialVerdictResponseSchema,
    handler: handleCommerceTrialVerdict
});

/**
 * Router exposing the verdict endpoint.
 *
 * Same permission as the sibling commerce subscription reads — what publishing
 * would cost the caller is their own listing's data. No idempotency middleware:
 * nothing is written.
 */
const commerceTrialVerdictRouter = createRouter();

commerceTrialVerdictRouter.use(
    '/subscriptions/:entityType/trial-verdict',
    protectedAuthMiddleware([PermissionEnum.COMMERCE_EDIT_OWN])
);

commerceTrialVerdictRouter.route('/', protectedCommerceTrialVerdictRoute);

export { commerceTrialVerdictRouter };
