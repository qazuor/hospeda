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

/**
 * Payment methods excluded one by one, a second layer under the type blacklist (P-5):
 * Mercado Crédito (`consumer_credits`) stays out even if Mercado Pago files it under a type
 * we do not exclude.
 *
 * TODO(HOS-2179 EX-62): inventory `/v1/payment_methods` and make the provider watch battery
 * fail on any payment type that is neither excluded here nor allowed (card, account money).
 * Follow-up, not implemented in T-1.
 */
export const EXCLUDED_PAYMENT_METHODS = ['consumer_credits'] as const;

/** How much later than requested the provider may echo the expiry before the page is refused. */
export const PAGE_EXPIRY_TOLERANCE_MS = 5_000;

const CreatedPageSchema = z.object({
    id: z.string().min(1),
    init_point: z.string().url(),
    expires: z.boolean().nullish(),
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
            excluded_payment_types: NON_INSTANT_PAYMENT_TYPES.map((id) => ({ id })),
            excluded_payment_methods: EXCLUDED_PAYMENT_METHODS.map((id) => ({ id }))
        },
        expires: true,
        expiration_date_from: args.now.toISOString(),
        expiration_date_to: input.expiresAt
    };
}

/**
 * Why a created page is refused: it must expire, after now, and no later than we asked
 * (plus `PAGE_EXPIRY_TOLERANCE_MS`). A page that does not expire would take payments
 * forever; one already expired can never be paid.
 */
function checkExpiry(args: {
    readonly created: z.infer<typeof CreatedPageSchema>;
    readonly requested: string;
    readonly now: Date;
}): { readonly expiresAt: string } | { readonly refusal: string } {
    if (args.created.expires !== true) return { refusal: 'a payment page that does not expire' };
    const expiresAt = toIsoInstant(args.created.expiration_date_to);
    if (expiresAt === null) return { refusal: 'a payment page without expiry' };
    if (Date.parse(expiresAt) <= args.now.getTime())
        return { refusal: 'a payment page that has already expired' };
    if (Date.parse(expiresAt) > Date.parse(args.requested) + PAGE_EXPIRY_TOLERANCE_MS)
        return { refusal: 'a payment page that expires later than requested' };
    return { expiresAt };
}

/**
 * Creates the preference with the persisted key. A page whose expiry is refused is closed
 * (best effort) before the call fails, so nobody can pay it; §5.6 makes the retry safe.
 */
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
    const expiry = checkExpiry({
        created,
        requested: args.input.expiresAt,
        now: args.now
    });
    if ('refusal' in expiry) {
        const error = providerError(
            'UNAVAILABLE',
            'charge',
            `Mercado Pago created ${expiry.refusal}`
        );
        try {
            await closeMercadoPagoPaymentPage({
                paymentPageId: created.id,
                now: args.now,
                send: args.send
            });
        } catch {
            // The original refusal is what the caller must see; the close was best effort.
        }
        throw error;
    }
    return {
        paymentPageId: created.id,
        approvalUrl: created.init_point,
        expiresAt: expiry.expiresAt
    };
}

/** Reads a preference by id; one without our reference is foreign and UNSUPPORTED. */
export async function readMercadoPagoPaymentPage(args: {
    readonly paymentPageId: string;
    readonly send: MercadoPagoSend;
    readonly now: () => Date;
}): Promise<PaymentPageSnapshot> {
    const response = await args.send({
        capability: 'read',
        path: `/checkout/preferences/${encodeURIComponent(args.paymentPageId)}`,
        method: 'GET'
    });
    const parsed = await parseResponse(ReadPageSchema, response, 'read', args.now);
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
