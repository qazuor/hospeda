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
    /** The injected clock, for a throttled answer's `Retry-After`. */
    readonly now?: () => Date;
}): Promise<readonly MercadoPagoSearchedPayment[]> {
    const response = await input.send({
        capability: 'read',
        method: 'GET',
        path: `/v1/payments/search?external_reference=${encodeURIComponent(input.reference)}`
    });
    const parsed = await parseResponse(
        MercadoPagoPaymentSearchResponseSchema,
        response,
        'read',
        ...(input.now ? [input.now] : [])
    );
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
 * Only a result naming EXACTLY our reference is kept, like the fake: one naming none rescues
 * nothing (A2 requires the reference to match) and, on a day the provider's filter returns
 * everything, it would fake a duplicate charge or stall A3. Ids only (INV:D6).
 */
export async function searchMercadoPagoCharges(args: {
    readonly input: ChargeSearchInput;
    readonly send: MercadoPagoSend;
    readonly now: () => Date;
}): Promise<ChargeSearchResult> {
    const from = Date.parse(args.input.createdFrom);
    const to = Date.parse(args.input.createdTo);
    const payments = await searchMercadoPagoPaymentsByReference({
        reference: args.input.reference,
        send: args.send,
        now: args.now
    });
    const chargeIds = payments
        .filter((payment) => {
            const created = Date.parse(payment.date_created);
            return (
                created >= from &&
                created <= to &&
                payment.external_reference === args.input.reference
            );
        })
        .map((payment) => payment.id);
    return { chargeIds };
}
