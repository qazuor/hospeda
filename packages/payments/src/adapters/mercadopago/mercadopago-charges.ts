import { z } from 'zod';
import type { ChargeListResult } from '../../provider/payment-provider';
import { type MercadoPagoSend, parseResponse, providerError } from './mercadopago-http';

const ChargeSearchResponseSchema = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(
        z.object({
            id: z.union([z.string(), z.number()]),
            date_created: z.string().optional(),
            payment: z
                .object({ id: z.union([z.string(), z.number()]).optional() })
                .nullable()
                .optional()
        })
    )
});

type ChargeRecord = z.infer<typeof ChargeSearchResponseSchema>['results'][number];

/** Lists payment identifiers from every measured charge record for an authorization. */
export async function listMercadoPagoCharges(input: {
    readonly authorizationId: string;
    readonly send: MercadoPagoSend;
}): Promise<ChargeListResult> {
    const records: ChargeRecord[] = [];
    let total = 0;
    for (let page = 0; page < 50; page += 1) {
        const offset = page * 10;
        const response = await input.send({
            capability: 'read',
            path: `/authorized_payments/search?preapproval_id=${encodeURIComponent(input.authorizationId)}&limit=10&offset=${offset}`,
            method: 'GET'
        });
        const parsed = await parseResponse(ChargeSearchResponseSchema, response, 'read');
        if (page === 0) total = parsed.paging.total;
        if (parsed.results.length === 0 && records.length < total)
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Mercado Pago returned an incomplete charge list'
            );
        records.push(...parsed.results);
        if (records.length >= total) break;
        if (page === 49)
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Mercado Pago charge list exceeded the page limit'
            );
    }

    const withPayment = records.filter((record) => record.payment?.id !== undefined);
    if (
        withPayment.some(
            (record) =>
                record.date_created === undefined ||
                !Number.isFinite(Date.parse(record.date_created))
        )
    )
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago returned a charge without a valid creation date'
        );

    const ordered = withPayment
        .map((record, index) => ({ record, index }))
        .sort((left, right) => {
            return (
                Date.parse(left.record.date_created ?? '') -
                    Date.parse(right.record.date_created ?? '') || left.index - right.index
            );
        });
    return {
        chargeIds: ordered.flatMap(({ record }) =>
            record.payment?.id === undefined ? [] : [String(record.payment.id)]
        )
    };
}
