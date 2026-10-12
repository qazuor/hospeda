import type {
    ActStart,
    AuthorizationSnapshot,
    PaymentProvider,
    ProviderRead
} from '@repo/payments';
import { actStartInstant, assertFreshForAct } from '@repo/payments';

export type PeriodChargesVerdict =
    | { readonly verdict: 'CHARGED'; readonly chargeId: string }
    | { readonly verdict: 'NOT_CHARGED'; readonly chargeId: string }
    | {
          readonly verdict: 'UNKNOWN';
          readonly reason: 'INCOMPLETE_INVENTORY' | 'PENDING_CHARGE' | 'READ_FAILED';
      }
    | { readonly verdict: 'NO_CURRENT_PERIOD' };

/**
 * Reads every listed charge by id and decides only from the current period's
 * charge status. `lastChargedAt` is deliberately never read: it describes the
 * last attempt, not the last successful charge (RP11). The record count only
 * checks that the id list is complete; it never proves that a charge succeeded
 * (RC-5).
 */
export async function readPeriodCharges(
    input: {
        readonly authorizationRead: ProviderRead<AuthorizationSnapshot>;
        readonly act: ActStart;
    },
    ports: { readonly provider: PaymentProvider }
): Promise<PeriodChargesVerdict> {
    try {
        const { snapshot: authorization } = assertFreshForAct({
            read: input.authorizationRead,
            act: input.act
        });
        const { chargeIds } = await ports.provider.listCharges({
            authorizationId: authorization.authorizationId
        });
        const charges = await Promise.all(
            chargeIds.map(async (chargeId) => {
                const read = await ports.provider.readCharge({ chargeId });
                return assertFreshForAct({ read, act: input.act }).snapshot;
            })
        );
        if (
            authorization.chargeRecordCount === null ||
            authorization.chargeRecordCount !== chargeIds.length
        ) {
            return { verdict: 'UNKNOWN', reason: 'INCOMPLETE_INVENTORY' };
        }
        const actStartedAt = actStartInstant({ act: input.act }).at.getTime();
        const latest = charges.sort(
            (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
        )[0];
        if (!latest) return { verdict: 'NO_CURRENT_PERIOD' };
        if (latest.expiresAt !== null && Date.parse(latest.expiresAt) <= actStartedAt)
            return { verdict: 'NO_CURRENT_PERIOD' };
        const current = latest;
        if (current.status === 'pending') return { verdict: 'UNKNOWN', reason: 'PENDING_CHARGE' };
        return current.status === 'approved'
            ? { verdict: 'CHARGED', chargeId: current.chargeId }
            : { verdict: 'NOT_CHARGED', chargeId: current.chargeId };
    } catch {
        return { verdict: 'UNKNOWN', reason: 'READ_FAILED' };
    }
}
