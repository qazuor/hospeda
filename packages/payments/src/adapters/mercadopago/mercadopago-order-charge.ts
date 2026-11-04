import { z } from 'zod';
import { PaymentProviderError } from '../../provider/errors';
import type { OneTimeChargeInput, OneTimeChargeResult } from '../../provider/payment-provider';
import type { MercadoPagoSend } from './mercadopago-http';
import { parseResponse } from './mercadopago-http';

const OrderCreatedSchema = z.object({ id: z.string().min(1), status: z.string() });
const DeclinedOrderSchema = z.object({ data: z.object({ id: z.string().min(1) }) });

/** Creates an order with the caller's stable key (AC:B6:12, MP:EX-41/EX-30). */
export async function chargeMercadoPagoOrder(args: {
    readonly input: OneTimeChargeInput;
    readonly send: MercadoPagoSend;
}): Promise<OneTimeChargeResult> {
    const { input } = args;
    const amount = (input.amount.amountMinor / 100).toFixed(2);
    const response = await args.send({
        capability: 'charge',
        path: '/v1/orders',
        method: 'POST',
        headers: { 'X-Idempotency-Key': input.idempotencyKey },
        body: {
            type: 'online',
            external_reference: input.reference,
            total_amount: amount,
            processing_mode: 'automatic',
            payer: { email: input.payerEmail },
            transactions: {
                payments: [
                    {
                        amount,
                        payment_method: {
                            id: input.paymentBrand,
                            type: input.paymentKind === 'credit' ? 'credit_card' : 'debit_card',
                            token: input.paymentToken,
                            installments: 1
                        }
                    }
                ]
            }
        }
    });
    if (response.status === 201) {
        const order = await parseResponse(OrderCreatedSchema, response, 'charge');
        return { orderId: order.id, declined: order.status === 'failed' };
    }
    if (response.status === 402) {
        const body: unknown = await response.json().catch(() => null);
        const order = DeclinedOrderSchema.safeParse(body);
        if (order.success) return { orderId: order.data.data.id, declined: true };
    }
    throw new PaymentProviderError({
        code:
            response.status === 409 ||
            (response.status >= 400 && response.status < 500 && response.status !== 402)
                ? 'REJECTED'
                : 'UNAVAILABLE',
        capability: 'charge',
        message: `Mercado Pago order creation failed (${response.status})`,
        ...(response.status === 409 ? { refundRefusal: 'KEY_REUSED' as const } : {})
    });
}
