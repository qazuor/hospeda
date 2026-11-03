import type { IncomingHttpHeaders } from 'node:http';
import { z } from 'zod';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';
import { PaymentProviderError } from '../provider/errors';

const PartialBodySchema = z.strictObject({
    transactions: z.array(z.strictObject({ id: z.string().min(1), amount: z.string() })).length(1)
});

function refundsOf(
    refunds: readonly {
        readonly refundId: string;
        readonly amountMinor: number;
        readonly accredited: boolean;
    }[]
) {
    return refunds.map((refund) => ({
        id: refund.refundId,
        amount: (refund.amountMinor / 100).toFixed(2),
        status: refund.accredited ? 'processed' : 'in_process'
    }));
}

/** Serves provider-shaped one-time order reads and exact-reference searches. */
export async function handleOrdersRoute(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
    readonly headers: IncomingHttpHeaders;
    readonly body: unknown;
}): Promise<{ readonly status: number; readonly body?: unknown } | null> {
    const refundMatch = /^\/v1\/orders\/([^/]+)\/refund$/.exec(args.url.pathname);
    if (args.method === 'POST' && refundMatch) {
        const reference = args.headers['x-idempotency-key'];
        if (typeof reference !== 'string' || reference.length === 0)
            return { status: 400, body: { code: 'empty_required_header' } };
        const orderId = decodeURIComponent(refundMatch[1] ?? '');
        const parsed = PartialBodySchema.safeParse(args.body);
        const emptyBody =
            typeof args.body === 'object' &&
            args.body !== null &&
            !Array.isArray(args.body) &&
            Object.keys(args.body).length === 0;
        if (!parsed.success && !emptyBody) return { status: 400, body: { code: 'invalid_body' } };
        const read = await args.provider.readOrder({ orderId });
        const transaction = parsed.success ? parsed.data.transactions[0] : undefined;
        try {
            const result = await args.provider.refundOrder({
                orderId,
                reference,
                scope: transaction
                    ? {
                          kind: 'partial',
                          transactionId: transaction.id,
                          amount: {
                              amountMinor: Math.round(Number(transaction.amount) * 100),
                              currency: 'ARS'
                          }
                      }
                    : { kind: 'total' }
            });
            return {
                status: 201,
                body: {
                    id: orderId,
                    status: read.snapshot.hasApprovedPayment ? 'processed' : 'failed',
                    status_detail: read.snapshot.hasApprovedPayment ? 'accredited' : 'failed',
                    transactions: { refunds: refundsOf(result.refunds) }
                }
            };
        } catch (error) {
            if (!(error instanceof PaymentProviderError)) throw error;
            if (error.refundRefusal === 'KEY_REUSED')
                return { status: 409, body: { code: 'idempotency_key_already_used' } };
            if (error.code === 'NOT_FOUND') return { status: 404, body: { code: 'not_found' } };
            if (error.code === 'REJECTED') return { status: 400, body: { code: 'rejected' } };
            throw error;
        }
    }
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
                        id: snapshot.paymentTransactionId,
                        status: paid ? 'approved' : 'rejected',
                        reference_id: snapshot.reference
                    }
                ],
                refunds: refundsOf(snapshot.refunds)
            }
        }
    };
}
