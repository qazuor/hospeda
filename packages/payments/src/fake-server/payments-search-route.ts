import type { FakePaymentProvider } from '../fake/fake-payment-provider';
import { serializeCharge } from './serialize-charge';

/** Serves payments for a reference using the fake provider's listed charge snapshots. */
export async function handlePaymentsSearchRoute(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
}): Promise<{ readonly status: number; readonly body: unknown } | null> {
    if (args.method !== 'GET' || args.url.pathname !== '/v1/payments/search') return null;
    const authorizations = (await args.provider.searchAuthorizations({})).authorizations;
    const charges = (
        await Promise.all(
            authorizations.map(async ({ authorizationId }) => {
                const ids = (await args.provider.listCharges({ authorizationId })).chargeIds;
                return Promise.all(
                    ids.map(async (chargeId) => ({
                        chargeId,
                        snapshot: (await args.provider.readCharge({ chargeId })).snapshot
                    }))
                );
            })
        )
    ).flat(2);
    const reference = args.url.searchParams.get('external_reference');
    const filtered = charges.filter(
        ({ snapshot }) => reference === null || snapshot.reference === reference
    );
    filtered.sort(
        (left, right) =>
            left.snapshot.createdAt.localeCompare(right.snapshot.createdAt) ||
            left.chargeId.localeCompare(right.chargeId)
    );
    const results = filtered
        .slice(0, 50)
        .map(({ snapshot }) => ({ ...serializeCharge({ snapshot }), shipping_cost: 0 }));
    return {
        status: 200,
        body: { results, paging: { total: filtered.length, offset: 0, limit: 50 } }
    };
}
