/**
 * Public checkout-config endpoint
 *
 * Exposes read-only, non-secret checkout-behavior flags to unauthenticated
 * clients (the web pricing pages).
 *
 * Why this exists (HOS-937 review fix): the payer-email confirm dialog
 * (`PayerEmailConfirmDialog`, apps/web) only has an effect on the
 * own-preapproval checkout path, gated server-side by
 * `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` (api-only env var — see
 * `subscription-checkout.service.ts`). With that flag on, ALL FOUR checkouts
 * (accommodation monthly and annual, commerce, partner) create their own
 * `POST /preapproval` and bind `payer_email` server-side (HOS-937 step 4);
 * with it off (the default) every path still falls back to MercadoPago's
 * hosted share-link checkout, which silently discards `payer_email`, so
 * showing the dialog there is pure friction with zero effect.
 *
 * Field name history: this flag was originally named
 * `ownPreapprovalMonthlyEnabled` back when the own-preapproval path existed
 * for accommodation-monthly only. HOS-937 step 4 extended the SAME env var
 * to gate all four checkouts, which left that name lying about scope — an
 * annual/commerce/partner checkout with the flag on created a binding
 * preapproval with no way for the payer to see or edit the email it would
 * bind. Renamed to `ownPreapprovalEnabled` to describe what it actually
 * gates. This is a brand-new public endpoint with no consumers outside this
 * monorepo yet, so the rename is a same-PR, no-migration change.
 *
 * The web app cannot read an api-only env var directly — `PUBLIC_*`
 * variables live in a separate registry scope (see CLAUDE.md's "Adding a
 * new environment variable" workflow) and would require a second, drift-prone
 * copy of the same flag kept in sync across two Coolify apps. This endpoint
 * is the alternative: the API reads its own env once and hands the resolved
 * boolean over HTTP, so there is exactly one source of truth.
 *
 * @module routes/billing/public/getCheckoutConfig
 */

import { env } from '../../../utils/env.js';
import { createSimpleRoute } from '../../../utils/route-factory.js';
import { z } from '../../../utils/zod';

/**
 * Public response schema for checkout-config flags.
 *
 * A single boolean today; add fields here (not a second endpoint) if more
 * checkout-behavior flags ever need to reach the web frontend.
 */
const CheckoutConfigResponseSchema = z.object({
    ownPreapprovalEnabled: z.boolean().openapi({
        description:
            'Whether the own-preapproval checkout path (HOS-937) is active for all four checkouts (accommodation monthly/annual, commerce, partner). When false (the default), the payer-email confirm dialog must not be rendered — the legacy MercadoPago share-link checkout never binds payer_email server-side, so the dialog would be a no-op extra step.'
    })
});

/**
 * GET /api/v1/public/billing/checkout-config
 * Read-only checkout-behavior flags — Public endpoint.
 *
 * Cached for 60s (matches the feature-flags public routes' TTL) — cheap to
 * serve and changes only on a deliberate deploy, never per-request.
 */
export const publicGetCheckoutConfigRoute = createSimpleRoute({
    method: 'get',
    path: '/',
    summary: 'Get public checkout config flags',
    description:
        'Returns read-only checkout-behavior flags the web frontend needs to render the correct pre-checkout UI. Currently a single flag: whether the own-preapproval checkout path (HOS-937) is enabled.',
    tags: ['Billing'],
    responseSchema: CheckoutConfigResponseSchema,
    handler: async () => ({
        ownPreapprovalEnabled: env.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED
    }),
    options: {
        skipAuth: true,
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
