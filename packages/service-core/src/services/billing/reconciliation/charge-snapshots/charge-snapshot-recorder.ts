import { providerChargeSnapshotModel } from '@repo/db';
import type { ChargeSnapshot, ProviderRead } from '@repo/payments';
import { assertFreshForAct } from '@repo/payments';

/** Provider key shared by Mercado Pago payment and provider-link rows. */
export const CHARGE_SNAPSHOT_PROVIDER = 'MERCADO_PAGO';

/**
 * Records live charge reads without changing their outcome. It receives the
 * `ProviderRead` itself (never a bare snapshot, GUARD:G17), so the observation
 * instant is the read's own instant.
 */
export interface ChargeSnapshotRecorder {
    record(input: { readonly read: ProviderRead<ChargeSnapshot> }): Promise<void>;
}

/** Create a database-backed recorder for one provider. */
export function createDbChargeSnapshotRecorder(input: {
    readonly provider: string;
}): ChargeSnapshotRecorder {
    return {
        async record({ read }) {
            // A recording is not a decision, so the read is unwrapped at its own instant: the same
            // door every decision uses (INV:D17), which keeps a hand-built read out of the table.
            const { snapshot, readAt: observedAt } = assertFreshForAct({
                read,
                act: { kind: 'decision', startedAt: read.readAt }
            });
            await providerChargeSnapshotModel.upsertOrdered({
                row: {
                    provider: input.provider,
                    chargeId: snapshot.chargeId,
                    authorizationId: snapshot.authorizationId,
                    providerCreatedAt: new Date(snapshot.createdAt),
                    expiresAt: snapshot.expiresAt ? new Date(snapshot.expiresAt) : null,
                    status: snapshot.status,
                    purpose: snapshot.purpose,
                    reference: snapshot.reference,
                    declineReason: snapshot.declineReason,
                    amountMinor: snapshot.amount.amountMinor,
                    refundedAmountMinor: snapshot.refundedAmount.amountMinor,
                    currency: snapshot.amount.currency,
                    chargedBack: snapshot.chargedBack,
                    observedAt
                }
            });
        }
    };
}
