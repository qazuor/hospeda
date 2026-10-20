import type { ChargeSnapshot } from '../provider/payment-provider';

/** Serializes a domain charge read into the Mercado Pago payments API shape. */
export function serializeCharge({
    snapshot
}: {
    readonly snapshot: ChargeSnapshot;
}): Readonly<Record<string, unknown>> {
    return {
        id: snapshot.chargeId,
        date_created: snapshot.createdAt,
        external_reference: snapshot.reference,
        status: wireStatus({ snapshot }),
        status_detail: snapshot.declineReason,
        transaction_amount: snapshot.amount.amountMinor / 100,
        currency_id: snapshot.amount.currency,
        transaction_amount_refunded: snapshot.refundedAmount.amountMinor / 100,
        metadata: {},
        point_of_interaction:
            snapshot.authorizationId === null
                ? { type: 'UNSPECIFIED' }
                : {
                      type: 'SUBSCRIPTIONS',
                      transaction_data: { subscription_id: snapshot.authorizationId }
                  }
    };
}

/** A disputed charge reads `charged_back`, a wholly refunded one `refunded` (RC-8, branch 1). */
function wireStatus({ snapshot }: { readonly snapshot: ChargeSnapshot }): string {
    if (snapshot.chargedBack) return 'charged_back';
    const { amountMinor } = snapshot.amount;
    if (
        snapshot.status === 'approved' &&
        amountMinor > 0 &&
        snapshot.refundedAmount.amountMinor === amountMinor
    ) {
        return 'refunded';
    }
    return snapshot.status;
}
