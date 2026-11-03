import {
    type ActStart,
    type ChargeSnapshot,
    memoizeInProviderReadScope,
    type PaymentProvider,
    type ProviderRead
} from '@repo/payments';

const actIds = new WeakMap<ActStart, string>();
let nextActId = 0;

/**
 * Reads a charge by id for `act`, sharing ONE live read among readers of the
 * same act object inside a provider read scope. A different act object (even
 * with the same instant) never receives it, so a nested act always reads live
 * (INV:D17, AC-26). Outside a scope: live. This is the one place a stamped
 * read is shared; it is a deliberate deviation from §6.2's literal text,
 * needed to reach the §11 PR-2 request target safely.
 */
export async function readChargeForAct(input: {
    readonly provider: PaymentProvider;
    readonly chargeId: string;
    readonly act: ActStart;
}): Promise<ProviderRead<ChargeSnapshot>> {
    let actId = actIds.get(input.act);
    if (!actId) {
        nextActId += 1;
        actId = String(nextActId);
        actIds.set(input.act, actId);
    }
    return await memoizeInProviderReadScope({
        key: `charge-for-act:${actId}:${input.chargeId}`,
        load: async () => await input.provider.readCharge({ chargeId: input.chargeId })
    });
}
