/**
 * The Mercado Pago adapter (DEC-MP-005): the provider we use, behind the same
 * interface as the fake.
 *
 * SKELETON. It implements the interface's shape and declares, gap by gap, what
 * the provider offers of each capability (`MERCADOPAGO_CAPABILITY_SUPPORT`), but
 * it does not call the provider yet: every capability validates its input like
 * any adapter and then refuses with `NOT_IMPLEMENTED`. The calls arrive with the
 * units that own each capability. No SDK is imported here, nor anywhere else in
 * the repo: the SDK, when it comes, lives only in this folder (GUARD:G12).
 */
import type { CapabilitySupportMap, PaymentCapability } from '../../provider/capabilities';
import { PaymentProviderError } from '../../provider/errors';
import type {
    AuthorizationRef,
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
import {
    AuthorizationRefSchema,
    AuthorizeInputSchema,
    ChangeAmountInputSchema,
    ChargeInputSchema,
    ChargeRefSchema,
    NoticeDeliverySchema,
    parseProviderInput,
    RefundInputSchema
} from '../../provider/schemas';
import { MERCADOPAGO_CAPABILITY_SUPPORT } from './mercadopago-capability-support';

/** The Mercado Pago payment provider (skeleton: validates, then refuses). */
export class MercadoPagoPaymentProvider implements PaymentProvider {
    readonly capabilitySupport: CapabilitySupportMap = MERCADOPAGO_CAPABILITY_SUPPORT;

    /** Capability 1 · authorize. */
    async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
        parseProviderInput({ schema: AuthorizeInputSchema, input, capability: 'authorize' });
        throw notImplemented({ capability: 'authorize' });
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
        throw notImplemented({ capability: 'cancel' });
    }

    /** Capability 6 · refund. */
    async refund(input: RefundInput): Promise<RefundResult> {
        parseProviderInput({ schema: RefundInputSchema, input, capability: 'refund' });
        throw notImplemented({ capability: 'refund' });
    }

    /** Capability 7 · read an authorization by id. */
    async readAuthorization(input: AuthorizationRef): Promise<AuthorizationSnapshot> {
        parseProviderInput({ schema: AuthorizationRefSchema, input, capability: 'read' });
        throw notImplemented({ capability: 'read' });
    }

    /** Capability 7 · read a charge by id. */
    async readCharge(input: ChargeRef): Promise<ChargeSnapshot> {
        parseProviderInput({ schema: ChargeRefSchema, input, capability: 'read' });
        throw notImplemented({ capability: 'read' });
    }

    /** Capability 8 · decode a delivery into a notice. */
    async decodeNotice(input: NoticeDelivery): Promise<ProviderNotice> {
        parseProviderInput({ schema: NoticeDeliverySchema, input, capability: 'notify' });
        throw notImplemented({ capability: 'notify' });
    }
}

function notImplemented(args: { readonly capability: PaymentCapability }): PaymentProviderError {
    return new PaymentProviderError({
        code: 'NOT_IMPLEMENTED',
        capability: args.capability,
        message: `the Mercado Pago adapter does not implement ${args.capability} yet`
    });
}
