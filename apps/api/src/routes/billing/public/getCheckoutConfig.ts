/**
 * Public checkout-config endpoint
 *
 * Exposes read-only, non-secret checkout-behavior flags to unauthenticated
 * clients (the web pricing pages).
 *
 * Why this exists (HOS-937 review fix): the payer-email confirm dialog
 * (`PayerEmailConfirmDialog`, apps/web) only has an effect on the
 * own-preapproval accommodation-monthly checkout path, gated server-side by
 * `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` (api-only env var — see
 * `subscription-checkout.service.ts`). On every OTHER checkout (the flag
 * off, which is production today; annual; commerce; partner) MercadoPago's
 * hosted share-link checkout silently discards `payer_email`, so showing
 * the dialog there is pure friction with zero effect.
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
    ownPreapprovalMonthlyEnabled: z.boolean().openapi({
        description:
            'Whether the own-preapproval accommodation-monthly checkout path (HOS-937) is active. When false (the default), the payer-email confirm dialog must not be rendered — the legacy MercadoPago share-link checkout never binds payer_email server-side, so the dialog would be a no-op extra step.'
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
        'Returns read-only checkout-behavior flags the web frontend needs to render the correct pre-checkout UI. Currently a single flag: whether the own-preapproval accommodation-monthly checkout path (HOS-937) is enabled.',
    tags: ['Billing'],
    responseSchema: CheckoutConfigResponseSchema,
    handler: async () => ({
        ownPreapprovalMonthlyEnabled: env.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED
    }),
    options: {
        skipAuth: true,
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
