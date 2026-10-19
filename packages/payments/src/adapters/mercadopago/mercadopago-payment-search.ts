import { z } from 'zod';
import { type MercadoPagoSend, parseResponse, providerError } from './mercadopago-http';
import { MercadoPagoPaymentLinkFieldsSchema } from './mercadopago-payment-link';

const MercadoPagoPaymentSearchResponseSchema = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(
        z.object({
            id: z.union([z.string(), z.number()]).transform(String),
            date_created: z.string().datetime({ offset: true }),
            ...MercadoPagoPaymentLinkFieldsSchema.shape
        })
    )
});

/** A payment returned by the reference search with a validated creation date. */
export type MercadoPagoSearchedPayment = z.infer<
    typeof MercadoPagoPaymentSearchResponseSchema
>['results'][number];

/** Searches all payments for one reference and rejects a truncated result page. */
export async function searchMercadoPagoPaymentsByReference(input: {
    readonly reference: string;
    readonly send: MercadoPagoSend;
}): Promise<readonly MercadoPagoSearchedPayment[]> {
    const response = await input.send({
        capability: 'read',
        method: 'GET',
        path: `/v1/payments/search?external_reference=${encodeURIComponent(input.reference)}`
    });
    const parsed = await parseResponse(MercadoPagoPaymentSearchResponseSchema, response, 'read');
    if (parsed.results.length < parsed.paging.total)
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago returned an incomplete payment search'
        );
    return parsed.results;
}
