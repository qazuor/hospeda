import { z } from 'zod';

/**
 * Response body for `GET /api/v1/protected/billing/payer-email-known`
 * (HOS-1234).
 *
 * `hasKnownPayerEmail: true` means `billing_customers.mp_payer_email` is set
 * for the authenticated user's billing customer — MercadoPago already
 * accepted this address on a PRIOR own-preapproval checkout, so
 * `resolvePayerEmail` (`apps/api/src/services/billing/payer-email.ts`) will
 * fall back to it without the caller sending anything. `false` covers both
 * "never confirmed one" and "the account email changed since, invalidating
 * the cache" (see `clearMpPayerEmailBestEffort`).
 *
 * Deliberately a BOOLEAN, never the email itself: the client only needs to
 * decide whether to skip the pre-redirect payer-email confirm dialog
 * (`PayerEmailConfirmDialog.client.tsx`) — it never needs to DISPLAY or
 * PREFILL with the cached address, and shipping it to the browser would leak
 * a per-user value with no purpose. When `true`, the web island simply omits
 * `payerEmail` from the `/start-paid` request body so the server resolves it
 * server-side from the same cache this endpoint just read.
 *
 * This is why the field is NOT on the public, unauthenticated, cacheable
 * `GET /api/v1/public/billing/checkout-config` — a per-user answer has no
 * business on a response cached and shared across every visitor.
 */
export const PayerEmailKnownResponseSchema = z.object({
    hasKnownPayerEmail: z.boolean({
        message: 'zodError.billing.payerEmail.known.response.hasKnownPayerEmail.invalidType'
    })
});

/** TypeScript type inferred from PayerEmailKnownResponseSchema */
export type PayerEmailKnownResponse = z.infer<typeof PayerEmailKnownResponseSchema>;
