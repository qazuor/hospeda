/**
 * The in-memory fake payment provider (DEC-ARCH-004, condition B).
 *
 * It implements the WHOLE interface, every one of the eight capabilities, and
 * it is written without one provider concept: being writable that way is what
 * proves the interface does not leak one (AC:B1:1).
 *
 * This is the skeleton: a coherent, honest provider. The closed lists of what
 * the real one lies about (M1..M13) and of its own rules (RP1..RP12) are added
 * on top of it by their own unit (B1.4); nothing here pretends to reproduce
 * them yet.
 *
 * Every read by id carries its instant, taken from the injected clock (AC:B1:4):
 * the fake never reads the system time.
 *
 * Beyond the interface it exposes two test-side handles, both named for what a
 * test does with them: `approve` stands for the customer granting the
 * permission on the provider's page, and `takeDeliveries` hands over the
 * notices the fake sent, in the shape our receiver gets them.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import type { CapabilitySupportMap, PaymentCapability } from '../provider/capabilities';
import { PaymentProviderError } from '../provider/errors';
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
    Money,
    MutationAcknowledgement,
    NoticeDelivery,
    NoticeResourceKind,
    PaymentProvider,
    ProviderNotice,
    RefundInput,
    RefundResult
} from '../provider/payment-provider';
import { type ProviderRead, stampProviderRead } from '../provider/provider-read';
import {
    AuthorizationRefSchema,
    AuthorizeInputSchema,
    ChangeAmountInputSchema,
    ChargeInputSchema,
    ChargeRefSchema,
    NoticeDeliverySchema,
    PaymentProviderOptionsSchema,
    parseProviderInput,
    RefundInputSchema
} from '../provider/schemas';
import { decodeFakeNoticeBody, encodeFakeNoticeBody } from './fake-notice';

/** The fake offers every capability whole: it is the reference, not a provider. */
export const FAKE_CAPABILITY_SUPPORT: CapabilitySupportMap = Object.freeze({
    authorize: { level: 'full' },
    charge: { level: 'full' },
    changeAmount: { level: 'full' },
    pauseAndResume: { level: 'full' },
    cancel: { level: 'full' },
    refund: { level: 'full' },
    read: { level: 'full' },
    notify: { level: 'full' }
});

/** Where the fake sends a customer to approve; a reserved, never-resolving host. */
const APPROVAL_BASE_URL = 'https://payments-fake.invalid/approve/';

interface StoredAuthorization {
    snapshot: AuthorizationSnapshot;
    version: number;
}

interface StoredCharge {
    snapshot: ChargeSnapshot;
    version: number;
}

/** In-memory payment provider implementing all eight capabilities. */
export class FakePaymentProvider implements PaymentProvider {
    readonly capabilitySupport: CapabilitySupportMap = FAKE_CAPABILITY_SUPPORT;

    private readonly authorizations = new Map<string, StoredAuthorization>();
    private readonly charges = new Map<string, StoredCharge>();
    private readonly outbox: NoticeDelivery[] = [];
    private sequence = 0;
    private readonly clock: Clock;

    /**
     * @param options.clock - The clock every read by id is stamped with
     */
    constructor(options: { readonly clock: Clock }) {
        this.clock = PaymentProviderOptionsSchema.parse(options).clock;
    }

    /** Capability 1 · authorize: the authorization is born pending the customer's approval. */
    async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
        const { value } = parseProviderInput({
            schema: AuthorizeInputSchema,
            input,
            capability: 'authorize'
        });
        const authorizationId = this.nextId({ prefix: 'auth' });
        this.authorizations.set(authorizationId, {
            snapshot: {
                authorizationId,
                reference: value.reference,
                status: 'pending',
                amount: { ...value.amount },
                cadence: { ...value.cadence }
            },
            version: 1
        });
        this.emit({ resourceKind: 'authorization', resourceId: authorizationId, version: 1 });
        return { authorizationId, approvalUrl: `${APPROVAL_BASE_URL}${authorizationId}` };
    }

    /**
     * Test handle: the customer grants the permission on the provider's page.
     *
     * @param input.authorizationId - The pending authorization
     * @returns The acknowledgement of the transition
     */
    async approve(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        return this.transition({ input, capability: 'authorize', from: ['pending'], to: 'active' });
    }

    /** Capability 2 · charge: only an active authorization is charged, in its own currency. */
    async charge(input: ChargeInput): Promise<ChargeResult> {
        const { value } = parseProviderInput({
            schema: ChargeInputSchema,
            input,
            capability: 'charge'
        });
        const stored = this.authorizationOrThrow({
            id: value.authorizationId,
            capability: 'charge'
        });
        if (stored.snapshot.status !== 'active') {
            throw this.rejected({
                capability: 'charge',
                reason: `authorization is ${stored.snapshot.status}`
            });
        }
        this.assertSameCurrency({
            expected: stored.snapshot.amount,
            actual: value.amount,
            capability: 'charge'
        });
        const chargeId = this.nextId({ prefix: 'charge' });
        this.charges.set(chargeId, {
            snapshot: {
                chargeId,
                authorizationId: value.authorizationId,
                reference: value.reference,
                status: 'approved',
                amount: { ...value.amount },
                refundedAmount: { amountMinor: 0, currency: value.amount.currency }
            },
            version: 1
        });
        this.emit({ resourceKind: 'charge', resourceId: chargeId, version: 1 });
        return { chargeId };
    }

    /** Capability 3 · change the amount of a live authorization. */
    async changeAmount(input: ChangeAmountInput): Promise<MutationAcknowledgement> {
        const { value } = parseProviderInput({
            schema: ChangeAmountInputSchema,
            input,
            capability: 'changeAmount'
        });
        const stored = this.authorizationOrThrow({
            id: value.authorizationId,
            capability: 'changeAmount'
        });
        if (stored.snapshot.status === 'cancelled') {
            throw this.rejected({
                capability: 'changeAmount',
                reason: 'authorization is cancelled'
            });
        }
        this.assertSameCurrency({
            expected: stored.snapshot.amount,
            actual: value.amount,
            capability: 'changeAmount'
        });
        stored.snapshot = { ...stored.snapshot, amount: { ...value.amount } };
        this.bump({ stored, resourceKind: 'authorization', resourceId: value.authorizationId });
        return { accepted: true, resourceId: value.authorizationId };
    }

    /** Capability 4 · pause an active authorization. */
    async pause(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        return this.transition({
            input,
            capability: 'pauseAndResume',
            from: ['active'],
            to: 'paused'
        });
    }

    /** Capability 4 · resume a paused authorization. */
    async resume(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        return this.transition({
            input,
            capability: 'pauseAndResume',
            from: ['paused'],
            to: 'active'
        });
    }

    /** Capability 5 · cancel: irreversible, from any state but cancelled. */
    async cancel(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        return this.transition({
            input,
            capability: 'cancel',
            from: ['pending', 'active', 'paused'],
            to: 'cancelled'
        });
    }

    /** Capability 6 · refund, total or partial, cumulative against what was charged. */
    async refund(input: RefundInput): Promise<RefundResult> {
        const { value } = parseProviderInput({
            schema: RefundInputSchema,
            input,
            capability: 'refund'
        });
        const stored = this.chargeOrThrow({ id: value.chargeId, capability: 'refund' });
        const { snapshot } = stored;
        if (snapshot.status !== 'approved') {
            throw this.rejected({ capability: 'refund', reason: `charge is ${snapshot.status}` });
        }
        this.assertSameCurrency({
            expected: snapshot.amount,
            actual: value.amount,
            capability: 'refund'
        });
        const refunded = snapshot.refundedAmount.amountMinor + value.amount.amountMinor;
        if (refunded > snapshot.amount.amountMinor) {
            throw this.rejected({
                capability: 'refund',
                reason: 'refund exceeds the charged amount'
            });
        }
        stored.snapshot = {
            ...snapshot,
            refundedAmount: { amountMinor: refunded, currency: snapshot.amount.currency }
        };
        const refundId = this.nextId({ prefix: 'refund' });
        this.bump({ stored, resourceKind: 'charge', resourceId: value.chargeId });
        this.emit({ resourceKind: 'refund', resourceId: refundId, version: 1 });
        return { refundId };
    }

    /** Capability 7 · read an authorization by id. */
    async readAuthorization(input: AuthorizationRef): Promise<ProviderRead<AuthorizationSnapshot>> {
        const { value } = parseProviderInput({
            schema: AuthorizationRefSchema,
            input,
            capability: 'read'
        });
        const snapshot = structuredClone(
            this.authorizationOrThrow({ id: value.authorizationId, capability: 'read' }).snapshot
        );
        return stampProviderRead({ snapshot, clock: this.clock });
    }

    /** Capability 7 · read a charge by id. */
    async readCharge(input: ChargeRef): Promise<ProviderRead<ChargeSnapshot>> {
        const { value } = parseProviderInput({
            schema: ChargeRefSchema,
            input,
            capability: 'read'
        });
        const snapshot = structuredClone(
            this.chargeOrThrow({ id: value.chargeId, capability: 'read' }).snapshot
        );
        return stampProviderRead({ snapshot, clock: this.clock });
    }

    /** Capability 8 · decode one of the fake's own deliveries into a notice. */
    async decodeNotice(input: NoticeDelivery): Promise<ProviderNotice> {
        const { value } = parseProviderInput({
            schema: NoticeDeliverySchema,
            input,
            capability: 'notify'
        });
        return decodeFakeNoticeBody({ body: value.body }).notice;
    }

    /**
     * Test handle: hands over, and forgets, every delivery sent since the last call.
     *
     * @returns The deliveries, oldest first
     */
    takeDeliveries(): { readonly deliveries: readonly NoticeDelivery[] } {
        return { deliveries: this.outbox.splice(0) };
    }

    private async transition(args: {
        readonly input: AuthorizationRef;
        readonly capability: PaymentCapability;
        readonly from: readonly AuthorizationSnapshot['status'][];
        readonly to: AuthorizationSnapshot['status'];
    }): Promise<MutationAcknowledgement> {
        const { value } = parseProviderInput({
            schema: AuthorizationRefSchema,
            input: args.input,
            capability: args.capability
        });
        const stored = this.authorizationOrThrow({
            id: value.authorizationId,
            capability: args.capability
        });
        if (!args.from.includes(stored.snapshot.status)) {
            throw this.rejected({
                capability: args.capability,
                reason: `cannot go from ${stored.snapshot.status} to ${args.to}`
            });
        }
        stored.snapshot = { ...stored.snapshot, status: args.to };
        this.bump({ stored, resourceKind: 'authorization', resourceId: value.authorizationId });
        return { accepted: true, resourceId: value.authorizationId };
    }

    private authorizationOrThrow(args: {
        readonly id: string;
        readonly capability: PaymentCapability;
    }): StoredAuthorization {
        const stored = this.authorizations.get(args.id);
        if (!stored) throw this.notFound({ capability: args.capability, id: args.id });
        return stored;
    }

    private chargeOrThrow(args: {
        readonly id: string;
        readonly capability: PaymentCapability;
    }): StoredCharge {
        const stored = this.charges.get(args.id);
        if (!stored) throw this.notFound({ capability: args.capability, id: args.id });
        return stored;
    }

    private assertSameCurrency(args: {
        readonly expected: Money;
        readonly actual: Money;
        readonly capability: PaymentCapability;
    }): void {
        if (args.expected.currency !== args.actual.currency) {
            throw this.rejected({
                capability: args.capability,
                reason: `currency ${args.actual.currency} differs from ${args.expected.currency}`
            });
        }
    }

    private bump(args: {
        readonly stored: StoredAuthorization | StoredCharge;
        readonly resourceKind: NoticeResourceKind;
        readonly resourceId: string;
    }): void {
        args.stored.version += 1;
        this.emit({
            resourceKind: args.resourceKind,
            resourceId: args.resourceId,
            version: args.stored.version
        });
    }

    private emit(args: {
        readonly resourceKind: NoticeResourceKind;
        readonly resourceId: string;
        readonly version: number;
    }): void {
        this.outbox.push({
            headers: { 'content-type': 'application/json' },
            body: encodeFakeNoticeBody({
                notice: {
                    resourceKind: args.resourceKind,
                    resourceId: args.resourceId,
                    version: String(args.version)
                }
            }).body
        });
    }

    private nextId(args: { readonly prefix: string }): string {
        this.sequence += 1;
        return `fake-${args.prefix}-${this.sequence}`;
    }

    private notFound(args: {
        readonly capability: PaymentCapability;
        readonly id: string;
    }): PaymentProviderError {
        return new PaymentProviderError({
            code: 'NOT_FOUND',
            capability: args.capability,
            message: `no resource with id ${args.id}`
        });
    }

    private rejected(args: {
        readonly capability: PaymentCapability;
        readonly reason: string;
    }): PaymentProviderError {
        return new PaymentProviderError({
            code: 'REJECTED',
            capability: args.capability,
            message: args.reason
        });
    }
}
