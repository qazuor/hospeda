import type {
    ActStart,
    AuthorizationSnapshot,
    ChargeSnapshot,
    PaymentProvider,
    ProviderRead
} from '@repo/payments';
import { assertFreshForAct, CAPABILITY_METHODS } from '@repo/payments';

/** Lists every charge and re-reads each listed id within the same act. */
export async function readListedCharges(
    input: {
        readonly authorizationRead: ProviderRead<AuthorizationSnapshot>;
        readonly act: ActStart;
    },
    ports: { readonly provider: PaymentProvider }
): Promise<{
    readonly complete: boolean;
    readonly charges: readonly ProviderRead<ChargeSnapshot>[];
}> {
    const { snapshot: authorization } = assertFreshForAct({
        read: input.authorizationRead,
        act: input.act
    });
    // The third read-capability entry is the by-authorization charge listing, not a search.
    const { chargeIds } = await ports.provider[CAPABILITY_METHODS.read[2]]({
        authorizationId: authorization.authorizationId
    });
    const charges = await Promise.all(
        chargeIds.map(async (chargeId) => {
            const read = await ports.provider.readCharge({ chargeId });
            assertFreshForAct({ read, act: input.act });
            return read;
        })
    );
    return {
        complete:
            authorization.chargeRecordCount !== null &&
            authorization.chargeRecordCount === chargeIds.length,
        charges
    };
}
