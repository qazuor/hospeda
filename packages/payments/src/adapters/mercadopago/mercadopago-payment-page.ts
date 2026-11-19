/**
 * The one-time payment page on Mercado Pago (HOS-2179 §5.1, §7.2): a Checkout Pro
 * preference. Creating it moves no money; the customer pays on Mercado Pago's page
 * and Hospeda never sees card data.
 *
 * Measured in sandbox on 2026-11-18 (HOS-2179 comments): a preference takes a second
 * approved payment (each with its own merchant order and the same external_reference,
 * RP18); an expired one shows Mercado Pago's fatal page and creates no payment, and its
 * read carries no expired flag (RP19). Not measured yet: whether `X-Idempotency-Key`
 * is honoured on creation (EX-61), the exact payment types to exclude (EX-62) and
 * whether a `PUT` of the expiry closes the page (EX-66).
 */
import { z } from 'zod';
import { PaymentProviderError } from '../../provider/errors';
import type {
    MutationAcknowledgement,
    OneTimePaymentInput,
    OneTimePaymentResult,
    PaymentPageSnapshot
} from '../../provider/payment-provider';
import {
    assertResponseOk,
    type MercadoPagoSend,
    parseResponse,
    providerError
} from './mercadopago-http';

/**
 * Every payment type that is not a card nor account money (D-3, P-5): cash tickets,
 * ATM, bank transfer and Mercado Crédito. It is a constant, not an input, so no caller
 * can ask for a delayed method. The final list is EX-62's to fix.
 */
export const NON_INSTANT_PAYMENT_TYPES = [
    'ticket',
    'atm',
    'bank_transfer',
    'digital_currency'
] as const;

const CreatedPageSchema = z.object({
    id: z.string().min(1),
    init_point: z.string().url(),
    expiration_date_to: z.string().nullish()
});

const ReadPageSchema = z.object({
    id: z.string().min(1),
    external_reference: z.string().nullish(),
    expires: z.boolean().nullish(),
    expiration_date_to: z.string().nullish(),
    date_created: z.string().nullish()
});

function toIsoInstant(value: string | null | undefined): string | null {
    if (value == null || Number.isNaN(Date.parse(value))) return null;
    return new Date(value).toISOString();
}

/** Builds the exact preference body of HOS-2179 §5.1 (P-6 binary mode, P-8 no payer, P-10 one installment). */
export function buildMercadoPagoPaymentPageBody(args: {
    readonly input: OneTimePaymentInput;
    readonly now: Date;
}): Readonly<Record<string, unknown>> {
    const { input } = args;
    return {
        external_reference: input.reference,
        items: [
            {
                id: input.reference,
                title: input.reason,
                quantity: 1,
                unit_price: input.amount.amountMinor / 100,
                currency_id: input.amount.currency
            }
        ],
        back_urls: { success: input.returnUrl, pending: input.returnUrl, failure: input.returnUrl },
        auto_return: 'approved',
        binary_mode: true,
        payment_methods: {
            installments: 1,
            excluded_payment_types: NON_INSTANT_PAYMENT_TYPES.map((id) => ({ id }))
        },
        expires: true,
        expiration_date_from: args.now.toISOString(),
        expiration_date_to: input.expiresAt
    };
}

/** Creates the preference with the persisted key; fails closed when no expiry comes back. */
export async function createMercadoPagoPaymentPage(args: {
    readonly input: OneTimePaymentInput;
    readonly now: Date;
    readonly send: MercadoPagoSend;
}): Promise<OneTimePaymentResult> {
    const response = await args.send({
        capability: 'charge',
        path: '/checkout/preferences',
        method: 'POST',
        body: buildMercadoPagoPaymentPageBody(args),
        headers: { 'X-Idempotency-Key': args.input.idempotencyKey }
    });
    const created = await parseResponse(CreatedPageSchema, response, 'charge', () => args.now);
    const expiresAt = toIsoInstant(created.expiration_date_to);
    // A page without an expiry would take payments forever: refuse it (§5.6 makes a retry safe).
    if (expiresAt === null)
        throw providerError(
            'UNAVAILABLE',
            'charge',
            'Mercado Pago created a payment page without expiry'
        );
    return { paymentPageId: created.id, approvalUrl: created.init_point, expiresAt };
}

/** Reads a preference by id; one without our reference is foreign and UNSUPPORTED. */
export async function readMercadoPagoPaymentPage(args: {
    readonly paymentPageId: string;
    readonly send: MercadoPagoSend;
}): Promise<PaymentPageSnapshot> {
    const response = await args.send({
        capability: 'read',
        path: `/checkout/preferences/${encodeURIComponent(args.paymentPageId)}`,
        method: 'GET'
    });
    const parsed = await parseResponse(ReadPageSchema, response, 'read');
    const reference = parsed.external_reference?.trim() ?? '';
    if (reference === '')
        throw new PaymentProviderError({
            code: 'UNSUPPORTED',
            capability: 'read',
            message: 'Mercado Pago returned a payment page without external_reference'
        });
    const createdAt = toIsoInstant(parsed.date_created);
    if (createdAt === null)
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago payment page has no creation date'
        );
    return {
        paymentPageId: parsed.id,
        reference,
        expiresAt: parsed.expires === false ? null : toIsoInstant(parsed.expiration_date_to),
        createdAt
    };
}

/** Moves the preference's expiry to now (EX-66, unmeasured). Accepted is not applied: re-read. */
export async function closeMercadoPagoPaymentPage(args: {
    readonly paymentPageId: string;
    readonly now: Date;
    readonly send: MercadoPagoSend;
}): Promise<MutationAcknowledgement> {
    const response = await args.send({
        capability: 'cancel',
        path: `/checkout/preferences/${encodeURIComponent(args.paymentPageId)}`,
        method: 'PUT',
        body: { expires: true, expiration_date_to: args.now.toISOString() }
    });
    await assertResponseOk(response, 'cancel', () => args.now);
    return { accepted: true, resourceId: args.paymentPageId };
}
