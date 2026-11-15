import { ChargeRefSchema, parseProviderInput } from '../provider/schemas';
import type { FakeLedger } from './fake-ledger';
import { rejected } from './fake-support';

/** Identifies one refund on a charge for the fake's test handle. */
export interface RejectInput {
    readonly chargeId: string;
    readonly refundId: string;
}

/** Parses the charge id before the fake catches up and changes a refund. */
export function parseFakeRefundRejectionInput(input: RejectInput): RejectInput {
    const ref = {
        schema: ChargeRefSchema,
        input: { chargeId: input.chargeId },
        capability: 'read'
    } as const;
    return { ...parseProviderInput(ref).value, refundId: input.refundId };
}

/**
 * Test-side: the provider rejects a refund it had accepted. Not measured (only
 * `approved` is, contexto §9); this is no lie and no rule of the fake, only
 * the surface a test needs (AC:B6:5, partial accredited and partial rejected).
 *
 * @throws PaymentProviderError with code `REJECTED` for an absent charge, foreign refund id, or already rejected refund
 */
export function applyFakeRefundRejection(args: {
    readonly ledger: FakeLedger;
    readonly chargeId: string;
    readonly refundId: string;
}): void {
    const stored = args.ledger.charges.get(args.chargeId);
    if (!stored) throw rejected({ capability: 'read', reason: 'charge does not exist' });
    const refund = stored.snapshot.refunds.find((r) => r.refundId === args.refundId);
    if (!refund) throw rejected({ capability: 'read', reason: 'refund does not belong to charge' });
    if (!refund.accredited)
        throw rejected({ capability: 'read', reason: 'refund was already rejected' });
    stored.snapshot = {
        ...stored.snapshot,
        refundedAmount: {
            amountMinor: stored.snapshot.refundedAmount.amountMinor - refund.amount.amountMinor,
            currency: stored.snapshot.refundedAmount.currency
        },
        refunds: stored.snapshot.refunds.map((r) =>
            r.refundId === args.refundId ? { ...r, accredited: false } : r
        )
    };
    args.ledger.bump({ stored, resourceKind: 'charge', resourceId: args.chargeId });
}
