/**
 * MercadoPago authorized-payment status → QZPay payment status.
 *
 * ## Why this is a module of its own
 *
 * It used to be a private function inside
 * `routes/webhooks/mercadopago/subscription-payment-handler.ts`. HOS-847 PR 5
 * added a SECOND consumer — the add-on renewal handler, which is routed AHEAD
 * of that file and therefore cannot import from it without closing a cycle.
 *
 * The obvious next home, `utils/mp-authorized-payment.ts` (where
 * `MPAuthorizedPaymentDetails` lives), does not work either, for a reason worth
 * writing down: `subscription-payment-handler.test.ts` replaces that module
 * WHOLESALE with `vi.mock`, exposing only `fetchAuthorizedPaymentDetails`. A
 * function moved there arrives at the handler as `undefined`, and the failure
 * surfaces as an unrelated-looking mock error rather than as a wrong status.
 *
 * So it lives here: a leaf module with a value import from nothing, which no
 * test has a reason to mock, reachable from both handlers.
 *
 * @module utils/mp-payment-status
 */

import type { QZPayPaymentStatus } from '@qazuor/qzpay-core';
import type { MPAuthorizedPaymentDetails } from './mp-authorized-payment.js';

/**
 * Map a MercadoPago authorized-payment status to a `QZPayPaymentStatus`.
 *
 * Prefers the inner `payment.status` (reflects the actual gateway
 * disposition) and falls back to the outer authorization-lifecycle
 * `status` when the inner block is absent.
 *
 * @param details - The parsed authorized payment.
 * @returns The QZPay-vocabulary payment status.
 */
export function mapMpStatusToQZPayStatus(details: MPAuthorizedPaymentDetails): QZPayPaymentStatus {
    const source = details.paymentStatus ?? details.status;
    switch (source) {
        case 'approved':
        case 'processed':
            return 'succeeded';
        case 'rejected':
            return 'failed';
        case 'cancelled':
        case 'canceled':
            return 'canceled';
        case 'refunded':
            return 'refunded';
        case 'in_process':
        case 'in_mediation':
            return 'processing';
        default:
            return 'pending';
    }
}
