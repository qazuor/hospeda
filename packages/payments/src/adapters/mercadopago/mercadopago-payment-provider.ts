/**
 * The Mercado Pago adapter (DEC-MP-005): the provider we use, behind the same
 * interface as the fake.
 *
 * It declares, gap by gap, what the provider offers of each capability
 * (`MERCADOPAGO_CAPABILITY_SUPPORT`). Authorization creation and authorization
 * reads use native fetch; the remaining capabilities still refuse with
 * `NOT_IMPLEMENTED`. No SDK is imported here or elsewhere (GUARD:G12).
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
    ChargeRef,
    ChargeResult,
    ChargeSnapshot,
    MutationAcknowledgement,
    NoticeDelivery,
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
    PaymentProviderOptionsSchema,
    parseProviderInput,
    RefundInputSchema
} from '../../provider/schemas';
import { MERCADOPAGO_CAPABILITY_SUPPORT } from './mercadopago-capability-support';
import { decodeMercadoPagoNotice } from './mercadopago-notice';

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
    last_modified: z.string().nullable().optional()
});

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
        readonly capability: 'authorize' | 'read' | 'cancel';
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

    /** Capability 2 · charge. */
    async charge(input: ChargeInput): Promise<ChargeResult> {
        parseProviderInput({ schema: ChargeInputSchema, input, capability: 'charge' });
        throw notImplemented({ capability: 'charge' });
    }

    /** Capability 3 · change the amount. */
    async changeAmount(input: ChangeAmountInput): Promise<MutationAcknowledgement> {
        parseProviderInput({ schema: ChangeAmountInputSchema, input, capability: 'changeAmount' });
        throw notImplemented({ capability: 'changeAmount' });
    }

    /** Capability 4 · pause. */
    async pause(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        parseProviderInput({ schema: AuthorizationRefSchema, input, capability: 'pauseAndResume' });
        throw notImplemented({ capability: 'pauseAndResume' });
    }

    /** Capability 4 · resume. */
    async resume(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        parseProviderInput({ schema: AuthorizationRefSchema, input, capability: 'pauseAndResume' });
        throw notImplemented({ capability: 'pauseAndResume' });
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
        throw notImplemented({ capability: 'refund' });
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
                lastModifiedAt: parsed.last_modified ?? null
            }
        });
    }

    /** Capability 7 · search authorizations. */
    async searchAuthorizations(
        input: AuthorizationSearchInput
    ): Promise<AuthorizationSearchResult> {
        parseProviderInput({ schema: AuthorizationSearchInputSchema, input, capability: 'read' });
        throw notImplemented({ capability: 'read' });
    }

    /** Capability 7 · read a charge by id. */
    async readCharge(input: ChargeRef): Promise<ProviderRead<ChargeSnapshot>> {
        parseProviderInput({ schema: ChargeRefSchema, input, capability: 'read' });
        throw notImplemented({ capability: 'read' });
    }

    /** Capability 8 · decode a delivery into a notice. */
    async decodeNotice(input: NoticeDelivery): Promise<ProviderNotice> {
        parseProviderInput({ schema: NoticeDeliverySchema, input, capability: 'notify' });
        return decodeMercadoPagoNotice({ body: input.body });
    }
}

async function parseResponse<T>(
    schema: z.ZodType<T>,
    response: Response,
    capability: 'authorize' | 'read' | 'cancel'
): Promise<T> {
    assertResponseOk(response, capability);
    let body: unknown;
    try {
        body = await response.json();
    } catch (cause) {
        throw providerError('UNAVAILABLE', capability, 'Mercado Pago returned invalid JSON', cause);
    }
    const result = schema.safeParse(body);
    if (!result.success)
        throw providerError(
            'UNAVAILABLE',
            capability,
            'Mercado Pago returned an invalid response',
            result.error
        );
    return result.data;
}

function assertResponseOk(response: Response, capability: 'authorize' | 'read' | 'cancel'): void {
    if (response.ok) return;
    const code =
        response.status === 404
            ? 'NOT_FOUND'
            : response.status === 400 || response.status === 422
              ? 'REJECTED'
              : 'UNAVAILABLE';
    throw providerError(code, capability, `Mercado Pago request failed (${response.status})`);
}

function providerError(
    code: 'UNAVAILABLE' | 'NOT_FOUND' | 'REJECTED',
    capability: 'authorize' | 'read' | 'cancel',
    message: string,
    cause?: unknown
): PaymentProviderError {
    return new PaymentProviderError({
        code,
        capability,
        message,
        ...(cause === undefined ? {} : { cause })
    });
}

function notImplemented(args: { readonly capability: PaymentCapability }): PaymentProviderError {
    return new PaymentProviderError({
        code: 'NOT_IMPLEMENTED',
        capability: args.capability,
        message: `the Mercado Pago adapter does not implement ${args.capability} yet`
    });
}
