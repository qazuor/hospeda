import { z } from 'zod';
import type {
    ChangeAmountInput,
    MutationAcknowledgement,
    RefundInput,
    RefundResult
} from '../../provider/payment-provider';
import type { MercadoPagoSend } from './mercadopago-http';
import { assertResponseOk, providerError, refundErrorCause } from './mercadopago-http';

const RefundResponseSchema = z.object({ id: z.union([z.string(), z.number()]) });

/** Sends one amount change, leaving confirmation to the caller's read path. */
export async function changeMercadoPagoAmount(
    input: ChangeAmountInput & { readonly send: MercadoPagoSend }
): Promise<MutationAcknowledgement> {
    const response = await input.send({
        capability: 'changeAmount',
        path: `/preapproval/${encodeURIComponent(input.authorizationId)}`,
        method: 'PUT',
        body: {
            auto_recurring: {
                transaction_amount: input.amount.amountMinor / 100,
                currency_id: input.amount.currency
            }
        }
    });
    assertResponseOk(response, 'changeAmount');
    return { accepted: true, resourceId: input.authorizationId };
}

/** Sends a pause or resume status transition over HTTP. */
export async function setMercadoPagoStatus(input: {
    readonly authorizationId: string;
    readonly status: 'paused' | 'authorized';
    readonly send: MercadoPagoSend;
}): Promise<MutationAcknowledgement> {
    const response = await input.send({
        capability: 'pauseAndResume',
        path: `/preapproval/${encodeURIComponent(input.authorizationId)}`,
        method: 'PUT',
        body: { status: input.status }
    });
    assertResponseOk(response, 'pauseAndResume');
    return { accepted: true, resourceId: input.authorizationId };
}

/** Requests a total or partial refund with the caller's stable idempotency key. */
export async function refundMercadoPagoPayment(
    input: RefundInput & {
        readonly send: MercadoPagoSend;
    }
): Promise<RefundResult> {
    const response = await input.send({
        capability: 'refund',
        path: `/v1/payments/${encodeURIComponent(input.chargeId)}/refunds`,
        method: 'POST',
        body: { amount: input.amount.amountMinor / 100 },
        headers: { 'X-Idempotency-Key': input.reference }
    });
    if (response.ok && response.status === 200) {
        const body = await response.text();
        if (body.length === 0) return { refundId: '' };
        throw providerError(
            'UNAVAILABLE',
            'refund',
            'Mercado Pago returned an invalid refund replay'
        );
    }
    if (!response.ok) {
        const cause = await refundErrorCause(response);
        const code =
            response.status === 404
                ? 'NOT_FOUND'
                : response.status >= 400 && response.status < 500
                  ? 'REJECTED'
                  : 'UNAVAILABLE';
        throw providerError(
            code,
            'refund',
            `Mercado Pago request failed (${response.status})`,
            cause
        );
    }
    if (response.status !== 201)
        throw providerError(
            'UNAVAILABLE',
            'refund',
            `Mercado Pago request failed (${response.status})`
        );
    let body: unknown;
    try {
        body = await response.json();
    } catch (cause) {
        throw providerError('UNAVAILABLE', 'refund', 'Mercado Pago returned invalid JSON', cause);
    }
    const parsed = RefundResponseSchema.safeParse(body);
    if (!parsed.success)
        throw providerError(
            'UNAVAILABLE',
            'refund',
            'Mercado Pago returned an invalid response',
            parsed.error
        );
    return { refundId: String(parsed.data.id) };
}
