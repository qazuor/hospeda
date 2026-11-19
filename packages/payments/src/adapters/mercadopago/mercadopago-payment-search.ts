import { z } from 'zod';
import type { ChargeSearchInput, ChargeSearchResult } from '../../provider/payment-provider';
import { type MercadoPagoSend, parseResponse, providerError } from './mercadopago-http';
import { MercadoPagoPaymentLinkFieldsSchema } from './mercadopago-payment-link';

const MercadoPagoPaymentSearchResponseSchema = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(
        z.object({
            id: z.union([z.string(), z.number()]).transform(String),
            date_created: z.string().datetime({ offset: true }),
            external_reference: z.string().nullish(),
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

/**
 * Capability 7 · charge ids for one reference inside an inclusive creation range
 * (HOS-2179 §5.4, §5.10). It sends the same reference-only search the adapter already
 * uses and bounds the range on our side, from each result's validated creation date.
 * A result naming ANOTHER reference is dropped; one naming none is kept, because a
 * false negative here abandons a paid purchase while a false positive costs one re-read
 * by id. Ids only: never a source of truth (INV:D6).
 */
export async function searchMercadoPagoCharges(args: {
    readonly input: ChargeSearchInput;
    readonly send: MercadoPagoSend;
}): Promise<ChargeSearchResult> {
    const from = Date.parse(args.input.createdFrom);
    const to = Date.parse(args.input.createdTo);
    const payments = await searchMercadoPagoPaymentsByReference({
        reference: args.input.reference,
        send: args.send
    });
    const chargeIds = payments
        .filter((payment) => {
            const created = Date.parse(payment.date_created);
            const reference = payment.external_reference;
            return (
                created >= from &&
                created <= to &&
                (reference == null || reference === args.input.reference)
            );
        })
        .map((payment) => payment.id);
    return { chargeIds };
}
