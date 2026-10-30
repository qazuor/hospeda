import { z } from 'zod';
import type {
    AuthorizationSearchInput,
    AuthorizationSearchResult,
    AuthorizationStatus
} from '../../provider/payment-provider';
import { type MercadoPagoSend, parseResponse, providerError } from './mercadopago-http';

const SearchResponseSchema = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(
        z.object({
            id: z.union([z.string(), z.number()]).transform(String),
            date_created: z.string(),
            external_reference: z.string().nullish(),
            status: z.string()
        })
    )
});

const TO_PROVIDER_STATUS: Record<AuthorizationStatus, string> = {
    pending: 'pending',
    active: 'authorized',
    paused: 'paused',
    cancelled: 'cancelled'
};
const FROM_PROVIDER_STATUS: Record<string, AuthorizationStatus> = {
    pending: 'pending',
    authorized: 'active',
    paused: 'paused',
    cancelled: 'cancelled'
};

/** Searches Mercado Pago authorizations, filtering the unsupported reference criterion locally. */
export async function searchMercadoPagoAuthorizations(args: {
    readonly input: AuthorizationSearchInput;
    readonly send: MercadoPagoSend;
}): Promise<AuthorizationSearchResult> {
    const results: z.infer<typeof SearchResponseSchema>['results'] = [];
    let total = 0;
    for (let page = 0; page < 50; page += 1) {
        const params = new URLSearchParams();
        if (args.input.payerEmail !== undefined) params.set('payer_email', args.input.payerEmail);
        if (args.input.status !== undefined)
            params.set('status', TO_PROVIDER_STATUS[args.input.status]);
        params.set('limit', '20');
        params.set('offset', String(page * 20));
        const response = await args.send({
            capability: 'read',
            path: `/preapproval/search?${params}`,
            method: 'GET'
        });
        const parsed = await parseResponse(SearchResponseSchema, response, 'read');
        if (page === 0) total = parsed.paging.total;
        if (parsed.results.length === 0 && results.length < total)
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Mercado Pago returned an incomplete authorization list'
            );
        results.push(...parsed.results);
        if (results.length >= total) break;
        if (page === 49)
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Mercado Pago authorization list exceeded the page limit'
            );
    }
    return {
        authorizations: results.flatMap((item) => {
            const status = FROM_PROVIDER_STATUS[item.status];
            if (status === undefined)
                throw providerError(
                    'UNAVAILABLE',
                    'read',
                    'Mercado Pago returned an unsupported authorization status'
                );
            const summary = {
                authorizationId: item.id,
                createdAt: item.date_created,
                reference: item.external_reference ?? '',
                status
            };
            return args.input.reference === undefined || summary.reference === args.input.reference
                ? [summary]
                : [];
        })
    };
}
