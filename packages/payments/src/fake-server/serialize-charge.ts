import type { ChargeSnapshot } from '../provider/payment-provider';

/** Serializes a domain charge read into the Mercado Pago payments API shape. */
export function serializeCharge(snapshot: ChargeSnapshot): Readonly<Record<string, unknown>> {
    return {
        id: snapshot.chargeId,
        date_created: snapshot.createdAt,
        expiration_date: snapshot.expiresAt,
        external_reference: snapshot.reference,
        preapproval_id: snapshot.authorizationId,
        status: snapshot.status,
        status_detail: snapshot.declineReason,
        transaction_amount: snapshot.amount.amountMinor / 100,
        currency_id: snapshot.amount.currency,
        amount_refunded: snapshot.refundedAmount.amountMinor / 100
    };
}
