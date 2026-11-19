/** Capability 7 · the Mercado Pago preapproval read by id, moved out of the adapter class to keep it under 500 lines. */
import { z } from 'zod';
import { PaymentProviderError } from '../../provider/errors';
import type { AuthorizationSnapshot } from '../../provider/payment-provider';
import { type MercadoPagoSend, parseResponse } from './mercadopago-http';

const ReadResponseSchema = z.object({
    id: z.string().min(1),
    // Our creation ALWAYS sends the reference (see `authorize` below), so a
    // preapproval without one belongs to a third party (or to the legacy
    // system). It is classified as unsupported below, never parsed as ours.
    external_reference: z.string().nullish(),
    status: z.string(),
    auto_recurring: z.object({
        frequency: z.number(),
        frequency_type: z.string(),
        transaction_amount: z.number(),
        currency_id: z.string(),
        start_date: z.string().nullish(),
        free_trial: z.object({ frequency: z.number() }).nullish()
    }),
    // A never-charged preapproval answers every `summarized` field as null
    // (HOS-1724); null means "not reported", mapped below to a null count.
    summarized: z
        .object({
            charged_quantity: z.number().int().nonnegative().nullish(),
            last_charged_date: z.string().nullish()
        })
        .nullish(),
    last_modified: z.string().nullish(),
    next_payment_date: z.string().nullish(),
    // Not validated as a URL here: a malformed link must not fail the whole read.
    // Its consumer sanitizes it and refuses what is not a usable https link (HOS-1725).
    init_point: z.string().nullish()
});

/** Convert a provider date to an ISO UTC instant, tolerating invalid values. */
function toIsoInstant({ value }: { readonly value: string | null | undefined }): string | null {
    if (value == null || Number.isNaN(Date.parse(value))) return null;
    return new Date(value).toISOString();
}

/** Reads a preapproval by id into the domain snapshot; a foreign or unsupported one is UNSUPPORTED. */
export async function readMercadoPagoAuthorization(args: {
    readonly authorizationId: string;
    readonly send: MercadoPagoSend;
    readonly now: () => Date;
}): Promise<AuthorizationSnapshot> {
    const response = await args.send({
        capability: 'read',
        path: `/preapproval/${encodeURIComponent(args.authorizationId)}`,
        method: 'GET'
    });
    const parsed = await parseResponse(ReadResponseSchema, response, 'read', args.now);
    // A preapproval with no reference is foreign by construction: we always
    // send ours on creation. Classifying it as UNSUPPORTED makes the notice
    // service ignore it (HOS-1777) instead of writing a receipt tombstone,
    // which would CANCEL a third party's authorization (AC:B11:3).
    const reference = parsed.external_reference?.trim() ?? '';
    if (reference === '') {
        throw new PaymentProviderError({
            code: 'UNSUPPORTED',
            capability: 'read',
            message: `Mercado Pago returned an unsupported authorization without external_reference (status: ${parsed.status})`,
            providerStatus: parsed.status,
            providerCadence: parsed.auto_recurring.frequency_type
        });
    }
    const statuses = {
        pending: 'pending',
        authorized: 'active',
        paused: 'paused',
        cancelled: 'cancelled'
    } as const;
    if (!(parsed.status in statuses) || parsed.auto_recurring.frequency_type !== 'months') {
        throw new PaymentProviderError({
            code: 'UNSUPPORTED',
            capability: 'read',
            message: `Mercado Pago returned an unsupported authorization (status: ${parsed.status}, frequency_type: ${parsed.auto_recurring.frequency_type})`,
            providerStatus: parsed.status,
            providerCadence: parsed.auto_recurring.frequency_type
        });
    }
    const status = statuses[parsed.status as keyof typeof statuses];
    return {
        authorizationId: parsed.id,
        reference,
        status,
        amount: {
            amountMinor: Math.round(parsed.auto_recurring.transaction_amount * 100),
            currency: parsed.auto_recurring.currency_id
        },
        cadence: { everyMonths: parsed.auto_recurring.frequency },
        // Mercado Pago echoes start_date in its own offset; normalize like nextChargeAt.
        firstChargeAt: toIsoInstant({ value: parsed.auto_recurring.start_date }),
        nextChargeAt: toIsoInstant({ value: parsed.next_payment_date }),
        freePeriodDays: parsed.auto_recurring.free_trial?.frequency ?? null,
        chargeRecordCount: parsed.summarized?.charged_quantity ?? null,
        lastChargedAt: parsed.summarized?.last_charged_date ?? null,
        lastModifiedAt: parsed.last_modified ?? null,
        approvalUrl: parsed.init_point ?? null
    };
}
