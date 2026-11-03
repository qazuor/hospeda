import { z } from 'zod';
import { PaymentProviderError } from '../../provider/errors';
import type { OrderRefundInput, OrderRefundResult } from '../../provider/payment-provider';
import type { MercadoPagoSend } from './mercadopago-http';
import { parseResponse } from './mercadopago-http';
import { nullAsAbsent } from './mercadopago-null-as-absent';

const RefundAmountSchema = z
    .union([z.string(), z.number()])
    .transform(Number)
    .pipe(z.number().finite().nonnegative());

/** Shared order refund parser for POST and read by id (MP:EX-58, AC:B6:8, TRANS:B:RF2/RF3). */
export const OrderRefundsSchema = nullAsAbsent({
    schema: z.array(
        z.object({
            id: z.union([z.string(), z.number()]).transform(String),
            amount: RefundAmountSchema,
            status: z.string()
        })
    )
});

/** Maps every refund returned by an order response (MP:EX-58, AC:B6:8, TRANS:B:RF3). */
export function mapOrderRefunds(refunds: z.output<typeof OrderRefundsSchema>): OrderRefundResult {
    return {
        refunds: (refunds ?? []).map((refund) => ({
            refundId: refund.id,
            amountMinor: Math.round(refund.amount * 100),
            accredited: refund.status === 'processed'
        }))
    };
}

const OrderRefundResponseSchema = z.object({
    transactions: z.object({ refunds: OrderRefundsSchema })
});

/** Sends one order refund with the caller's persisted key (MP:EX-58, AC:B6:8, TRANS:B:RF2). */
export async function refundMercadoPagoOrder(
    input: OrderRefundInput & { readonly send: MercadoPagoSend }
): Promise<OrderRefundResult> {
    const response = await input.send({
        capability: 'refund',
        path: `/v1/orders/${encodeURIComponent(input.orderId)}/refund`,
        method: 'POST',
        body:
            input.scope.kind === 'total'
                ? undefined
                : {
                      transactions: [
                          {
                              id: input.scope.transactionId,
                              amount: (input.scope.amount.amountMinor / 100).toFixed(2)
                          }
                      ]
                  },
        headers: { 'X-Idempotency-Key': input.reference }
    });
    if (!response.ok) {
        const code =
            response.status === 404
                ? 'NOT_FOUND'
                : response.status >= 400 && response.status < 500
                  ? 'REJECTED'
                  : 'UNAVAILABLE';
        throw new PaymentProviderError({
            code,
            capability: 'refund',
            message: `Mercado Pago order refund failed (${response.status})`,
            ...(response.status === 409 ? { refundRefusal: 'KEY_REUSED' as const } : {})
        });
    }
    if (response.status !== 201)
        throw new PaymentProviderError({
            code: 'UNAVAILABLE',
            capability: 'refund',
            message: `Mercado Pago order refund returned ${response.status}`
        });
    const parsed = await parseResponse(OrderRefundResponseSchema, response, 'refund');
    return mapOrderRefunds(parsed.transactions.refunds);
}
