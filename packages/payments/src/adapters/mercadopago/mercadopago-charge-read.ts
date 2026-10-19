import { z } from 'zod';
import type { ChargeSnapshot } from '../../provider/payment-provider';
import { readMercadoPagoChargeWindow } from './mercadopago-charge-window';
import { type MercadoPagoSend, parseResponse, providerError } from './mercadopago-http';

const ReadChargeResponseSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    date_created: z.string().datetime({ offset: true }),
    external_reference: z.string().nullable().optional(),
    metadata: z.object({ preapproval_id: z.unknown().optional() }).nullable().optional(),
    point_of_interaction: z
        .object({
            transaction_data: z
                .object({ subscription_id: z.unknown().optional() })
                .nullable()
                .optional()
        })
        .nullable()
        .optional(),
    status: z.enum(['pending', 'in_process', 'approved', 'rejected', 'refunded', 'charged_back']),
    status_detail: z.string().nullable().optional(),
    transaction_amount: z.number().nonnegative(),
    currency_id: z.string().min(1),
    transaction_amount_refunded: z.number().nonnegative().optional()
});

function toChargeStatus({
    status
}: {
    readonly status: z.infer<typeof ReadChargeResponseSchema>['status'];
}): ChargeSnapshot['status'] {
    if (status === 'in_process') return 'pending';
    if (status === 'refunded' || status === 'charged_back') return 'approved';
    return status;
}

function nonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function readAuthorizationLink(parsed: z.infer<typeof ReadChargeResponseSchema>): string | null {
    const metadataId = nonEmptyString(parsed.metadata?.preapproval_id);
    const interactionId = nonEmptyString(
        parsed.point_of_interaction?.transaction_data?.subscription_id
    );
    if (metadataId !== null && interactionId !== null && metadataId !== interactionId)
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago returned conflicting authorization links'
        );
    return metadataId ?? interactionId;
}

/** Reads a Mercado Pago payment by id into the domain charge snapshot. */
export async function readMercadoPagoCharge(args: {
    readonly chargeId: string;
    readonly send: MercadoPagoSend;
}): Promise<ChargeSnapshot> {
    const response = await args.send({
        capability: 'read',
        path: `/v1/payments/${encodeURIComponent(args.chargeId)}`,
        method: 'GET'
    });
    const parsed = await parseResponse(ReadChargeResponseSchema, response, 'read');
    const authorizationId = readAuthorizationLink(parsed);
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
                      send: args.send
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
