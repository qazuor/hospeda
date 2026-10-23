import { z } from 'zod';
import type { ChargeSnapshot } from '../../provider/payment-provider';
import { readMercadoPagoChargeWindow } from './mercadopago-charge-window';
import { type MercadoPagoSend, parseResponse, providerError } from './mercadopago-http';
import { nullAsAbsent } from './mercadopago-null-as-absent';
import {
    MercadoPagoPaymentLinkFieldsSchema,
    readMercadoPagoAuthorizationLink
} from './mercadopago-payment-link';

const ReadChargeResponseSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    date_created: z.string().datetime({ offset: true }),
    external_reference: z.string().nullable().optional(),
    ...MercadoPagoPaymentLinkFieldsSchema.shape,
    // Every documented Mercado Pago payment status; anything else still fails closed.
    status: z.enum([
        'pending',
        'in_process',
        'authorized',
        'in_mediation',
        'cancelled',
        'approved',
        'rejected',
        'refunded',
        'charged_back'
    ]),
    status_detail: z.string().nullable().optional(),
    transaction_amount: z.number().nonnegative(),
    currency_id: z.string().min(1),
    // null is read as absent, so an approved payment without it still fails closed below.
    transaction_amount_refunded: nullAsAbsent({ schema: z.number().nonnegative() })
});

/**
 * Maps a Mercado Pago payment status to the domain. `authorized` (reserved,
 * not captured), `in_mediation` (disputed, money held) and `cancelled`
 * (closed before collection) are neither a collection we may count nor a
 * decline we may act on (grace, expiry), so they read as `pending` (HOS-1724).
 */
function toChargeStatus({
    status
}: {
    readonly status: z.infer<typeof ReadChargeResponseSchema>['status'];
}): ChargeSnapshot['status'] {
    if (
        status === 'in_process' ||
        status === 'authorized' ||
        status === 'in_mediation' ||
        status === 'cancelled'
    )
        return 'pending';
    if (status === 'refunded' || status === 'charged_back') return 'approved';
    return status;
}

/** Reads a Mercado Pago payment by id into the domain charge snapshot. */
export async function readMercadoPagoCharge(args: {
    readonly chargeId: string;
    readonly send: MercadoPagoSend;
    readonly sleep?: (ms: number) => Promise<void>;
}): Promise<ChargeSnapshot> {
    const response = await args.send({
        capability: 'read',
        path: `/v1/payments/${encodeURIComponent(args.chargeId)}`,
        method: 'GET'
    });
    const parsed = await parseResponse(ReadChargeResponseSchema, response, 'read');
    const authorizationId = readMercadoPagoAuthorizationLink(parsed);
    const status = toChargeStatus({ status: parsed.status });
    const refundedAmount = parsed.transaction_amount_refunded;
    if (
        refundedAmount === undefined &&
        ['approved', 'refunded', 'charged_back'].includes(parsed.status)
    )
        throw providerError('UNAVAILABLE', 'read', 'Mercado Pago payment has no refunded amount');
    return {
        chargeId: parsed.id,
        createdAt: parsed.date_created,
        expiresAt:
            authorizationId === null
                ? null
                : await readMercadoPagoChargeWindow({
                      authorizationId,
                      payment: { id: parsed.id, createdAt: parsed.date_created },
                      send: args.send,
                      ...(args.sleep ? { sleep: args.sleep } : {})
                  }),
        purpose:
            authorizationId === null &&
            parsed.external_reference == null &&
            parsed.transaction_amount === 0
                ? 'cardValidation'
                : 'charge',
        authorizationId,
        reference: parsed.external_reference ?? null,
        status,
        declineReason: status === 'rejected' ? (parsed.status_detail ?? null) : null,
        amount: {
            amountMinor: Math.round(parsed.transaction_amount * 100),
            currency: parsed.currency_id
        },
        refundedAmount: {
            amountMinor: Math.round((refundedAmount ?? 0) * 100),
            currency: parsed.currency_id
        },
        chargedBack: parsed.status === 'charged_back'
    };
}
