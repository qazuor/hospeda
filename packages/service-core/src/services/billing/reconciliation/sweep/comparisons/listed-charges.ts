import type {
    ActStart,
    AuthorizationSnapshot,
    ChargeSnapshot,
    PaymentProvider,
    ProviderRead
} from '@repo/payments';
import { assertFreshForAct, CAPABILITY_METHODS } from '@repo/payments';
import type {
    ClosedChargeSnapshot,
    ClosedChargeSnapshots
} from '../../charge-snapshots/closed-charge-snapshot';
import { readChargeInventory } from '../../period-charges/read-charge-inventory';

/** Lists every charge and re-reads each listed id within the same act. */
export async function readListedCharges(
    input: {
        readonly authorizationRead: ProviderRead<AuthorizationSnapshot>;
        readonly act: ActStart;
    },
    ports: {
        readonly provider: PaymentProvider;
        readonly closedChargeSnapshots?: ClosedChargeSnapshots;
    }
): Promise<{
    readonly complete: boolean;
    readonly charges: readonly ProviderRead<ChargeSnapshot>[];
    readonly closed: readonly ClosedChargeSnapshot[];
}> {
    const { snapshot: authorization } = assertFreshForAct({
        read: input.authorizationRead,
        act: input.act
    });
    // The third read-capability entry is the by-authorization charge listing, not a search.
    const { chargeIds } = await ports.provider[CAPABILITY_METHODS.read[2]]({
        authorizationId: authorization.authorizationId
    });
    const inventory = await readChargeInventory({
        provider: ports.provider,
        chargeIds,
        act: input.act,
        ...(ports.closedChargeSnapshots
            ? { closedChargeSnapshots: ports.closedChargeSnapshots }
            : {})
    });
    for (const read of inventory.live) assertFreshForAct({ read, act: input.act });
    return {
        complete:
            authorization.chargeRecordCount !== null &&
            authorization.chargeRecordCount === chargeIds.length,
        charges: inventory.live,
        closed: inventory.closed
    };
}
