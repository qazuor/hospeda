import type { IncomingHttpHeaders } from 'node:http';
import { z } from 'zod';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';

const RefundBodySchema = z.object({ amount: z.number().positive().finite().optional() });

/** Handles the fake provider's payment refund endpoint. */
export async function handleRefundsRoute(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
    readonly headers: IncomingHttpHeaders;
    readonly body: unknown;
    readonly refundAmounts: Map<string, number>;
}): Promise<{ readonly status: number; readonly body?: unknown } | null> {
    const match = /^\/v1\/payments\/([^/]+)\/refunds$/.exec(args.url.pathname);
    if (args.method !== 'POST' || !match) return null;
    const reference = args.headers['x-idempotency-key'];
    if (typeof reference !== 'string' || reference.length === 0)
        return {
            status: 400,
            body: {
                code: 4292,
                message: "Header X-Idempotency-Key can't be null",
                status: 400
            }
        };
    const chargeId = decodeURIComponent(match[1] ?? '');
    const replayKey = `${chargeId}\u0000${reference}`;
    const { snapshot } = await args.provider.readCharge({ chargeId });
    const parsedBody = RefundBodySchema.safeParse(args.body);
    if (!parsedBody.success)
        return { status: 400, body: { status: 'INVALID_INPUT', error: 'INVALID_INPUT' } };
    let amount = {
        amountMinor: snapshot.amount.amountMinor - snapshot.refundedAmount.amountMinor,
        currency: snapshot.amount.currency
    };
    if (parsedBody.data.amount !== undefined) {
        amount = {
            amountMinor: Math.round(parsedBody.data.amount * 100),
            currency: snapshot.amount.currency
        };
    } else if (args.refundAmounts.has(replayKey)) {
        amount = {
            amountMinor: args.refundAmounts.get(replayKey) ?? 0,
            currency: snapshot.amount.currency
        };
    }
    const result = await args.provider.refund({ chargeId, amount, reference });
    if (result.refundId === '') return { status: 200 };
    if (parsedBody.data.amount === undefined) args.refundAmounts.set(replayKey, amount.amountMinor);
    return {
        status: 201,
        body: { id: result.refundId, payment_id: chargeId, amount: amount.amountMinor / 100 }
    };
}
