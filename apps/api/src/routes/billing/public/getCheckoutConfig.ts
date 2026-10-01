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
 * `newPaidSignupsFrozen` is the second flag, and unlike the first it is NOT an
 * env var: it is the admin-editable `billing_settings.newPaidSignupsFrozen`
 * (no deploy needed). The web reads it to show a "signups are paused" notice
 * instead of a checkout button. It is a UX hint only — the authoritative
 * refusal is `assertNewPaidSignupsAllowed` inside each checkout route, so a
 * stale cached `false` costs a visitor one click, never a charge.
 *
 * @module routes/billing/public/getCheckoutConfig
 */

import { readNewPaidSignupsFreeze } from '../../../services/billing/new-paid-signups-freeze.js';
import { env } from '../../../utils/env.js';
import { createSimpleRoute } from '../../../utils/route-factory.js';
import { z } from '../../../utils/zod';

/**
 * Public response schema for checkout-config flags.
 *
 * Add fields here (not a second endpoint) if more checkout-behavior flags
 * ever need to reach the web frontend.
 */
const CheckoutConfigResponseSchema = z.object({
    ownPreapprovalEnabled: z.boolean().openapi({
        description:
            'Whether the own-preapproval checkout path (HOS-937) is active for all four checkouts (accommodation monthly/annual, commerce, partner). When false (the default), the payer-email confirm dialog must not be rendered — the legacy MercadoPago share-link checkout never binds payer_email server-side, so the dialog would be a no-op extra step.'
    }),
    newPaidSignupsFrozen: z.boolean().openapi({
        description:
            'Whether an admin paused new self-service paid signups (billing settings). When true, the web shows a "signups are paused" notice instead of the checkout buttons for new plans, owner commerce checkouts and add-on purchases. The checkout routes refuse with 409 NEW_PAID_SIGNUPS_FROZEN regardless of what the client renders.'
    })
});

/**
 * GET /api/v1/public/billing/checkout-config
 * Read-only checkout-behavior flags — Public endpoint.
 *
 * Cached for 60s (matches the feature-flags public routes' TTL) — cheap to
 * serve. `ownPreapprovalEnabled` changes only on a deliberate deploy;
 * `newPaidSignupsFrozen` changes when an admin flips it, so the web may show
 * the previous value for up to that TTL (plus any page cache in front of it).
 */
export const publicGetCheckoutConfigRoute = createSimpleRoute({
    method: 'get',
    path: '/',
    summary: 'Get public checkout config flags',
    description:
        'Returns read-only checkout-behavior flags the web frontend needs to render the correct pre-checkout UI: whether the own-preapproval checkout path (HOS-937) is enabled, and whether new self-service paid signups are paused by an admin.',
    tags: ['Billing'],
    responseSchema: CheckoutConfigResponseSchema,
    handler: async () => {
        const { frozen } = await readNewPaidSignupsFreeze();
        return {
            ownPreapprovalEnabled: env.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED,
            newPaidSignupsFrozen: frozen
        };
    },
    options: {
        skipAuth: true,
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
