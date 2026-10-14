import type { FakeLedger } from './fake-ledger';
import { rejected } from './fake-support';

/**
 * Test-side: the payer disputes an approved charge with their bank and the
 * money goes back (AC:B11:27). The charge stays `approved`, because it did
 * collect, keeps what was refunded so far, and reads `chargedBack: true`; its
 * version moves and its charge notice is sent. Documented, not measured (RC-8):
 * this is no lie and no rule of the fake, only the surface a test needs.
 *
 * @param args.ledger - The fake's records
 * @param args.chargeId - The approved charge the payer disputes
 * @throws PaymentProviderError with code `REJECTED` when the charge is not approved or was already disputed
 */
export function applyFakeChargeback(args: {
    readonly ledger: FakeLedger;
    readonly chargeId: string;
}): void {
    const stored = args.ledger.chargeOrThrow({ id: args.chargeId, capability: 'read' });
    if (stored.snapshot.status !== 'approved') {
        throw rejected({
            capability: 'read',
            reason: `a ${stored.snapshot.status} charge cannot be disputed`
        });
    }
    if (stored.snapshot.chargedBack) {
        throw rejected({ capability: 'read', reason: 'the charge was already disputed' });
    }
    stored.snapshot = { ...stored.snapshot, chargedBack: true };
    args.ledger.bump({ stored, resourceKind: 'charge', resourceId: args.chargeId });
}
