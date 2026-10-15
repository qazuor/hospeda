/**
 * The Mercado Pago adapter (DEC-MP-005): the provider we use, behind the same
 * interface as the fake.
 *
 * It declares, gap by gap, what the provider offers of each capability
 * (`MERCADOPAGO_CAPABILITY_SUPPORT`). Authorization creation, authorization
 * reads, charge reads, listings, and order operations use native fetch. The
 * provider runs recurring charges itself, so an on-demand charge is rejected.
 * No SDK is imported here or elsewhere (GUARD:G12).
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { z } from 'zod';
import type { CapabilitySupportMap, PaymentCapability } from '../../provider/capabilities';
import { PaymentProviderError } from '../../provider/errors';
import type {
    AuthorizationRef,
    AuthorizationSearchInput,
    AuthorizationSearchResult,
    AuthorizationSnapshot,
    AuthorizeInput,
    AuthorizeResult,
    ChangeAmountInput,
    ChargeInput,
    ChargeListResult,
    ChargeRef,
    ChargeResult,
    ChargeSnapshot,
    MutationAcknowledgement,
    NoticeDelivery,
    OrderRef,
    OrderSearchInput,
    OrderSearchResult,
    OrderSnapshot,
    PaymentProvider,
    ProviderNotice,
    RefundInput,
    RefundResult
} from '../../provider/payment-provider';
import type { ProviderRead } from '../../provider/provider-read';
import { stampProviderRead } from '../../provider/provider-read';
import {
    AuthorizationRefSchema,
    AuthorizationSearchInputSchema,
    AuthorizeInputSchema,
    ChangeAmountInputSchema,
    ChargeInputSchema,
    ChargeRefSchema,
    NoticeDeliverySchema,
    OrderRefSchema,
    OrderSearchInputSchema,
    PaymentProviderOptionsSchema,
    parseProviderInput,
    RefundInputSchema
} from '../../provider/schemas';
import { MERCADOPAGO_CAPABILITY_SUPPORT } from './mercadopago-capability-support';
import { listMercadoPagoCharges } from './mercadopago-charges';
import { assertResponseOk, parseResponse, providerError } from './mercadopago-http';
import {
    changeMercadoPagoAmount,
    refundMercadoPagoPayment,
    setMercadoPagoStatus
} from './mercadopago-mutations';
import { decodeMercadoPagoNotice } from './mercadopago-notice';
import { readMercadoPagoOrder, searchMercadoPagoOrders } from './mercadopago-orders';
import { searchMercadoPagoAuthorizations } from './mercadopago-search';

const MercadoPagoOptionsSchema = z.strictObject({
    clock: z.custom<Clock>(
        (value) => typeof value === 'object' && value !== null && 'now' in value
    ),
    baseUrl: z.string().url().optional().default('https://api.mercadopago.com'),
    accessToken: z.string().min(1).optional(),
    timeoutMs: z.number().positive().finite().optional().default(5000),
    fetch: z.custom<typeof globalThis.fetch>((value) => typeof value === 'function').optional()
});

const AuthorizationResponseSchema = z.object({
    id: z.string().min(1),
    init_point: z.string().url()
});
const ReadResponseSchema = z.object({
    id: z.string().min(1),
    external_reference: z.string(),
    status: z.string(),
    auto_recurring: z.object({
        frequency: z.number(),
        frequency_type: z.string(),
        transaction_amount: z.number(),
        currency_id: z.string(),
        start_date: z.string().nullable().optional(),
        free_trial: z.object({ frequency: z.number() }).nullable().optional()
    }),
    summarized: z
        .object({
            charged_quantity: z.number().int().nonnegative().optional(),
            last_charged_date: z.string().nullable().optional()
        })
        .optional(),
    last_modified: z.string().nullable().optional()
});
const ReadChargeResponseSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    date_created: z.string().datetime({ offset: true }),
    expiration_date: z.string().datetime({ offset: true }).nullable().optional(),
    external_reference: z.string().nullable().optional(),
    preapproval_id: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .transform((value) => (value == null ? null : String(value))),
    status: z.enum(['pending', 'in_process', 'approved', 'rejected', 'refunded', 'charged_back']),
    status_detail: z.string().nullable().optional(),
    transaction_amount: z.number().nonnegative(),
    currency_id: z.string().min(1),
    amount_refunded: z.number().nonnegative().optional().default(0)
});

/**
 * A refunded or charged-back payment did collect, so it reads `approved`: the
 * refund travels in `refundedAmount` and the chargeback in `chargedBack` (RC-8).
 */
function toChargeStatus({
    status
}: {
    readonly status: z.infer<typeof ReadChargeResponseSchema>['status'];
}): ChargeSnapshot['status'] {
    if (status === 'in_process') return 'pending';
    if (status === 'refunded' || status === 'charged_back') return 'approved';
    return status;
}

/** The Mercado Pago payment provider adapter. */
export class MercadoPagoPaymentProvider implements PaymentProvider {
    readonly capabilitySupport: CapabilitySupportMap = MERCADOPAGO_CAPABILITY_SUPPORT;

    /**
     * The injected clock used to stamp every read by id (`stampProviderRead`).
     */
    private readonly clock: Clock;
    private readonly baseUrl: string;
    private readonly accessToken: string | undefined;
    private readonly timeoutMs: number;
    private readonly request: typeof globalThis.fetch;

    private async send(args: {
        readonly capability: PaymentCapability;
        readonly path: string;
        readonly method: 'GET' | 'POST' | 'PUT';
        readonly body?: unknown;
        readonly headers?: Readonly<Record<string, string>>;
    }): Promise<Response> {
        if (!this.accessToken)
            throw providerError(
                'UNAVAILABLE',
                args.capability,
                'Mercado Pago access token is not configured'
            );
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await this.request(`${this.baseUrl}${args.path}`, {
                method: args.method,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    ...(args.body ? { 'Content-Type': 'application/json' } : {}),
                    ...args.headers
                },
                ...(args.body ? { body: JSON.stringify(args.body) } : {}),
                signal: controller.signal
            });
        } catch (cause) {
            throw providerError(
                'UNAVAILABLE',
                args.capability,
                'Mercado Pago is unavailable',
                cause
            );
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * @param options.clock - The injected clock (AC:B1:17)
     */
    constructor(options: {
        readonly clock: Clock;
        readonly baseUrl?: string;
        readonly accessToken?: string;
        readonly timeoutMs?: number;
        readonly fetch?: typeof globalThis.fetch;
    }) {
        const parsed = MercadoPagoOptionsSchema.parse(options);
        this.clock = PaymentProviderOptionsSchema.parse({ clock: parsed.clock }).clock;
        this.baseUrl = parsed.baseUrl.replace(/\/$/, '');
        this.accessToken = parsed.accessToken;
        this.timeoutMs = parsed.timeoutMs;
        this.request = parsed.fetch ?? globalThis.fetch;
    }

    /** Capability 1 · authorize. */
    async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
        parseProviderInput({ schema: AuthorizeInputSchema, input, capability: 'authorize' });
        const response = await this.send({
            capability: 'authorize',
            path: '/preapproval',
            method: 'POST',
            body: {
                reason: input.reason,
                external_reference: input.reference,
                ...(input.payerEmail ? { payer_email: input.payerEmail } : {}),
                ...(input.paymentToken ? { card_token_id: input.paymentToken } : {}),
                back_url: input.returnUrl,
                auto_recurring: {
                    frequency: input.cadence.everyMonths,
                    frequency_type: 'months',
                    transaction_amount: input.amount.amountMinor / 100,
                    currency_id: input.amount.currency,
                    ...(input.firstChargeAt ? { start_date: input.firstChargeAt } : {})
                }
            },
            headers: { 'X-Idempotency-Key': input.reference }
        });
        const parsed = await parseResponse(AuthorizationResponseSchema, response, 'authorize');
        return { authorizationId: parsed.id, approvalUrl: parsed.init_point };
    }

    /**
     * Capability 2 · charge. EX-31 and MERCADOPAGO_CAPABILITY_SUPPORT.charge
     * establish that recurring charges are provider-run, with no on-demand endpoint.
     */
    async charge(input: ChargeInput): Promise<ChargeResult> {
        parseProviderInput({ schema: ChargeInputSchema, input, capability: 'charge' });
        throw new PaymentProviderError({
            code: 'REJECTED',
            capability: 'charge',
            message: 'Mercado Pago charges every cycle on its own: there is no on-demand charge'
        });
    }

    /** Capability 3 · change the amount. */
    async changeAmount(input: ChangeAmountInput): Promise<MutationAcknowledgement> {
        parseProviderInput({ schema: ChangeAmountInputSchema, input, capability: 'changeAmount' });
        return changeMercadoPagoAmount({ ...input, send: (args) => this.send(args) });
    }

    /** Capability 4 · pause. */
    async pause(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        parseProviderInput({ schema: AuthorizationRefSchema, input, capability: 'pauseAndResume' });
        return setMercadoPagoStatus({
            authorizationId: input.authorizationId,
            status: 'paused',
            send: (args) => this.send(args)
        });
    }

    /** Capability 4 · resume. */
    async resume(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        parseProviderInput({ schema: AuthorizationRefSchema, input, capability: 'pauseAndResume' });
        return setMercadoPagoStatus({
            authorizationId: input.authorizationId,
            status: 'authorized',
            send: (args) => this.send(args)
        });
    }

    /** Capability 5 · cancel. */
    async cancel(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        parseProviderInput({ schema: AuthorizationRefSchema, input, capability: 'cancel' });
        const response = await this.send({
            capability: 'cancel',
            path: `/preapproval/${encodeURIComponent(input.authorizationId)}`,
            method: 'PUT',
            body: { status: 'cancelled' }
        });
        assertResponseOk(response, 'cancel');
        return { accepted: true, resourceId: input.authorizationId };
    }

    /** Capability 6 · refund. */
    async refund(input: RefundInput): Promise<RefundResult> {
        parseProviderInput({ schema: RefundInputSchema, input, capability: 'refund' });
        return refundMercadoPagoPayment({ ...input, send: (args) => this.send(args) });
    }

    /** Capability 7 · read an authorization by id. */
    async readAuthorization(input: AuthorizationRef): Promise<ProviderRead<AuthorizationSnapshot>> {
        parseProviderInput({ schema: AuthorizationRefSchema, input, capability: 'read' });
        const response = await this.send({
            capability: 'read',
            path: `/preapproval/${encodeURIComponent(input.authorizationId)}`,
            method: 'GET'
        });
        const parsed = await parseResponse(ReadResponseSchema, response, 'read');
        const statuses = {
            pending: 'pending',
            authorized: 'active',
            paused: 'paused',
            cancelled: 'cancelled'
        } as const;
        if (!(parsed.status in statuses) || parsed.auto_recurring.frequency_type !== 'months') {
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Mercado Pago returned an unsupported authorization'
            );
        }
        const status = statuses[parsed.status as keyof typeof statuses];
        return stampProviderRead({
            clock: this.clock,
            snapshot: {
                authorizationId: parsed.id,
                reference: parsed.external_reference,
                status,
                amount: {
                    amountMinor: Math.round(parsed.auto_recurring.transaction_amount * 100),
                    currency: parsed.auto_recurring.currency_id
                },
                cadence: { everyMonths: parsed.auto_recurring.frequency },
                firstChargeAt: parsed.auto_recurring.start_date ?? null,
                freePeriodDays: parsed.auto_recurring.free_trial?.frequency ?? null,
                chargeRecordCount: parsed.summarized?.charged_quantity ?? null,
                lastChargedAt: parsed.summarized?.last_charged_date ?? null,
                lastModifiedAt: parsed.last_modified ?? null
            }
        });
    }

    /** Capability 7 · search authorizations. */
    async searchAuthorizations(
        input: AuthorizationSearchInput
    ): Promise<AuthorizationSearchResult> {
        parseProviderInput({ schema: AuthorizationSearchInputSchema, input, capability: 'read' });
        return searchMercadoPagoAuthorizations({ input, send: (args) => this.send(args) });
    }

    /** Capability 7 · read a charge by id. */
    async readCharge(input: ChargeRef): Promise<ProviderRead<ChargeSnapshot>> {
        parseProviderInput({ schema: ChargeRefSchema, input, capability: 'read' });
        const response = await this.send({
            capability: 'read',
            path: `/v1/payments/${encodeURIComponent(input.chargeId)}`,
            method: 'GET'
        });
        const parsed = await parseResponse(ReadChargeResponseSchema, response, 'read');
        const status = toChargeStatus({ status: parsed.status });
        return stampProviderRead({
            clock: this.clock,
            snapshot: {
                chargeId: parsed.id,
                createdAt: parsed.date_created,
                expiresAt: parsed.expiration_date ?? null,
                purpose:
                    parsed.preapproval_id === null &&
                    parsed.external_reference == null &&
                    parsed.transaction_amount === 0
                        ? 'cardValidation'
                        : 'charge',
                authorizationId: parsed.preapproval_id ?? null,
                reference: parsed.external_reference ?? null,
                status,
                declineReason: status === 'rejected' ? (parsed.status_detail ?? null) : null,
                amount: {
                    amountMinor: Math.round(parsed.transaction_amount * 100),
                    currency: parsed.currency_id
                },
                refundedAmount: {
                    amountMinor: Math.round(parsed.amount_refunded * 100),
                    currency: parsed.currency_id
                },
                chargedBack: parsed.status === 'charged_back'
            }
        });
    }

    async listCharges(input: AuthorizationRef): Promise<ChargeListResult> {
        parseProviderInput({ schema: AuthorizationRefSchema, input, capability: 'read' });
        return listMercadoPagoCharges({
            authorizationId: input.authorizationId,
            send: (args) => this.send(args)
        });
    }

    /** Capability 7 · read an order by id. */
    async readOrder(input: OrderRef): Promise<ProviderRead<OrderSnapshot>> {
        parseProviderInput({ schema: OrderRefSchema, input, capability: 'read' });
        const snapshot = await readMercadoPagoOrder({
            orderId: input.orderId,
            send: (args) => this.send(args)
        });
        return stampProviderRead({ clock: this.clock, snapshot });
    }

    /** Capability 7 · search orders (EX-57). */
    async searchOrders(input: OrderSearchInput): Promise<OrderSearchResult> {
        parseProviderInput({ schema: OrderSearchInputSchema, input, capability: 'read' });
        return searchMercadoPagoOrders({ input, send: (args) => this.send(args) });
    }

    /** Capability 8 · decode a delivery into a notice. */
    async decodeNotice(input: NoticeDelivery): Promise<ProviderNotice> {
        parseProviderInput({ schema: NoticeDeliverySchema, input, capability: 'notify' });
        return decodeMercadoPagoNotice({ body: input.body });
    }
}
