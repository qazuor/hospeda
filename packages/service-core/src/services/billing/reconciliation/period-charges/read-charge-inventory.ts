import type { ActStart, ChargeSnapshot, PaymentProvider, ProviderRead } from '@repo/payments';
import { assertFreshForAct } from '@repo/payments';
import type {
    ClosedChargeSnapshot,
    ClosedChargeSnapshots
} from '../charge-snapshots/closed-charge-snapshot';
import { readChargeForAct } from './read-charge-for-act';

/** Read live charges while using closed snapshots only for historical inventory. */
export async function readChargeInventory(input: {
    readonly provider: PaymentProvider;
    readonly chargeIds: readonly string[];
    readonly act: ActStart;
    readonly closedChargeSnapshots?: ClosedChargeSnapshots;
}): Promise<{
    readonly closed: readonly ClosedChargeSnapshot[];
    readonly live: readonly ProviderRead<ChargeSnapshot>[];
}> {
    const liveAll = async (ids: readonly string[]) =>
        Promise.all(
            ids.map((chargeId) =>
                readChargeForAct({ provider: input.provider, chargeId, act: input.act })
            )
        );
    if (!input.closedChargeSnapshots) return { closed: [], live: await liveAll(input.chargeIds) };
    let closed: readonly ClosedChargeSnapshot[];
    try {
        const allowed = new Set(input.chargeIds);
        closed = (await input.closedChargeSnapshots.find({ chargeIds: input.chargeIds })).filter(
            (item) => allowed.has(item.chargeId)
        );
    } catch {
        return { closed: [], live: await liveAll(input.chargeIds) };
    }
    const closedIds = new Set(closed.map((item) => item.chargeId));
    let live = await liveAll(input.chargeIds.filter((id) => !closedIds.has(id)));
    const latestClosed = [...closed].sort(
        (a, b) => Date.parse(b.providerCreatedAt) - Date.parse(a.providerCreatedAt)
    )[0];
    const createdAtOf = (read: ProviderRead<ChargeSnapshot>): number =>
        Date.parse(assertFreshForAct({ read, act: input.act }).snapshot.createdAt);
    const latestLive = [...live].sort((a, b) => createdAtOf(b) - createdAtOf(a))[0];
    if (
        latestClosed &&
        (!latestLive || Date.parse(latestClosed.providerCreatedAt) > createdAtOf(latestLive))
    ) {
        const refreshed = await readChargeForAct({
            provider: input.provider,
            chargeId: latestClosed.chargeId,
            act: input.act
        });
        live = [...live, refreshed];
        closed = closed.filter((item) => item.chargeId !== latestClosed.chargeId);
        assertFreshForAct({ read: refreshed, act: input.act });
    }
    return { closed, live };
}
