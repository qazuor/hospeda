/**
 * Payer-Email Known Route (HOS-1234)
 *
 * Lightweight, read-only endpoint answering whether the CURRENT
 * authenticated user already has a known MercadoPago payer email on file
 * (`billing_customers.mp_payer_email`, populated by
 * `persistMpPayerEmailBestEffort` off a cleared charge — see
 * `apps/api/src/services/billing/payer-email.ts`).
 *
 * Exists so the pricing page's own-preapproval checkout
 * (`PlanPurchaseButton.client.tsx`) can skip the "Con qué email vas a poder
 * pagar" confirm dialog (`PayerEmailConfirmDialog.client.tsx`) once we
 * already know an email that worked. It answers with a BOOLEAN only, never
 * the email itself — the client does not need to display or prefill with the
 * cached address, only to decide whether to omit `payerEmail` from the
 * `/start-paid` request body and let the server resolve it via
 * `resolvePayerEmail`'s own precedence.
 *
 * Deliberately NOT on `GET /api/v1/public/billing/checkout-config`: that
 * route is public, unauthenticated, and cacheable — a per-user boolean would
 * leak between visitors sharing the cache. This route lives under
 * `/api/v1/protected/billing/`, same tier as `/trial-eligibility`, which it
 * mirrors structurally.
 *
 * Routes:
 * - GET /api/v1/protected/billing/payer-email-known
 *
 * @module routes/billing/payer-email-known
 */

import type { PayerEmailKnownResponse } from '@repo/schemas';
import { PayerEmailKnownResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getMpPayerEmail } from '../../services/billing/payer-email';
import { createRouter } from '../../utils/create-app';
import { createCRUDRoute } from '../../utils/route-factory';

/**
 * Handler for the payer-email-known endpoint.
 *
 * Extracted from the route definition for unit-testability, mirroring the
 * pattern used by `handleTrialEligibility` / `handleDowngradePreview`.
 *
 * @param c - Hono context (must carry `billingEnabled` + `billingCustomerId`,
 *   set by the parent billing router's middleware chain).
 * @param _params - Unused URL path params (none for this route).
 * @param _body - Unused request body (GET endpoint).
 * @param _query - Unused query params (none for this route).
 * @returns `{ hasKnownPayerEmail }` — see {@link PayerEmailKnownResponseSchema}.
 * @throws HTTPException 503 when billing is not configured/available.
 * @throws HTTPException 400 when the caller has no billing customer on session.
 */
export const handlePayerEmailKnown = async (
    c: Context,
    _params: Record<string, unknown>,
    _body: Record<string, unknown>,
    _query?: Record<string, unknown>
): Promise<PayerEmailKnownResponse> => {
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

    // `getMpPayerEmail` is best-effort (see its JSDoc): a read failure
    // degrades to `null`, never throws — so this route always answers
    // `hasKnownPayerEmail: false` rather than a 500 when the lookup fails,
    // matching the fail-open-to-showing-the-dialog contract the web client
    // relies on.
    const mpPayerEmail = await getMpPayerEmail(billingCustomerId);

    // Truthiness, NOT `!== null`. The column is a nullable varchar, so a row
    // can hold `''` — and an empty string is exactly the shape that started
    // HOS-1234: MercadoPago reports "no email" that way, and `''` is falsy
    // enough to slip through a careless guard while still being a `string`.
    // Answering `true` for one would skip the confirm dialog on the strength
    // of an address that is not an address. Today's persist refuses to write
    // one (both halves of the recording check), but this route answers for
    // every row ever written, including any that predates that check.
    return { hasKnownPayerEmail: Boolean(mpPayerEmail) };
};

/**
 * GET /api/v1/protected/billing/payer-email-known
 *
 * Returns whether the authenticated user already has a known MercadoPago
 * payer email on file. Read-only; no entitlement gate beyond authentication
 * — mirrors `GET /trial-eligibility` and `GET /trial/status`, which are
 * informational in the same way.
 */
export const getPayerEmailKnownRoute = createCRUDRoute({
    method: 'get',
    path: '/',
    summary: 'Get payer-email known status',
    description:
        'Returns whether the authenticated user already has a known MercadoPago payer email on file (billing_customers.mp_payer_email). Read-only — never resolves or exposes the email itself.',
    tags: ['Billing'],
    responseSchema: PayerEmailKnownResponseSchema,
    handler: handlePayerEmailKnown
});

/**
 * Router that exposes the payer-email-known endpoint.
 *
 * Mounted at the billing root as `/payer-email-known`, sibling to
 * `/trial-eligibility` — a single read-only check, not part of the checkout
 * lifecycle surface.
 */
const payerEmailKnownRouter = createRouter();

payerEmailKnownRouter.route('/', getPayerEmailKnownRoute);

export { payerEmailKnownRouter };
