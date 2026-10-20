import { z } from 'zod';
import { providerError } from './mercadopago-http';

/** Shared Mercado Pago payment fields that can identify its authorization. */
export const MercadoPagoPaymentLinkFieldsSchema = z.object({
    metadata: z.object({ preapproval_id: z.unknown().optional() }).nullable().optional(),
    point_of_interaction: z
        .object({
            transaction_data: z
                .object({ subscription_id: z.unknown().optional() })
                .nullable()
                .optional()
        })
        .nullable()
        .optional()
});

function nonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Reads the payment authorization link and fails closed when its two sources conflict. */
export function readMercadoPagoAuthorizationLink(input: {
    readonly metadata?: { readonly preapproval_id?: unknown } | null;
    readonly point_of_interaction?: {
        readonly transaction_data?: { readonly subscription_id?: unknown } | null;
    } | null;
}): string | null {
    const metadataId = nonEmptyString(input.metadata?.preapproval_id);
    const interactionId = nonEmptyString(
        input.point_of_interaction?.transaction_data?.subscription_id
    );
    if (metadataId !== null && interactionId !== null && metadataId !== interactionId)
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago returned conflicting authorization links'
        );
    return metadataId ?? interactionId;
}
