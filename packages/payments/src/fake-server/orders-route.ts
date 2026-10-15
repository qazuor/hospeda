import type { IncomingHttpHeaders } from 'node:http';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';

/** Serves provider-shaped one-time order reads and exact-reference searches. */
export async function handleOrdersRoute(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
    readonly headers: IncomingHttpHeaders;
}): Promise<{ readonly status: number; readonly body?: unknown } | null> {
    if (args.method !== 'GET' || !args.url.pathname.startsWith('/v1/orders')) return null;
    if (args.url.pathname === '/v1/orders') {
        const begin = args.url.searchParams.get('begin_date');
        const end = args.url.searchParams.get('end_date');
        if (!begin || !end) return { status: 400, body: { code: 'missing_required_params' } };
        const reference = args.url.searchParams.get('external_reference') ?? '';
        const found = await args.provider.searchOrders({
            createdFrom: begin,
            createdTo: end,
            reference
        });
        const data = await Promise.all(
            found.orders.map(async ({ orderId }) => {
                const { snapshot } = await args.provider.readOrder({ orderId });
                return {
                    id: snapshot.orderId,
                    external_reference: snapshot.reference,
                    created_date: snapshot.createdAt,
                    status: snapshot.hasApprovedPayment ? 'processed' : 'failed'
                };
            })
        );
        return { status: 200, body: { data, paging: { total: data.length } } };
    }
    const match = /^\/v1\/orders\/([^/]+)$/.exec(args.url.pathname);
    if (!match) return null;
    const { snapshot } = await args.provider.readOrder({
        orderId: decodeURIComponent(match[1] ?? '')
    });
    const paid = snapshot.hasApprovedPayment;
    return {
        status: 200,
        body: {
            id: snapshot.orderId,
            status: paid ? 'processed' : 'failed',
            status_detail: paid ? 'accredited' : 'failed',
            external_reference: snapshot.reference,
            created_date: snapshot.createdAt,
            transactions: {
                payments: [
                    {
                        id: `payment-${snapshot.orderId}`,
                        status: paid ? 'approved' : 'rejected',
                        reference_id: snapshot.reference
                    }
                ]
            }
        }
    };
}
