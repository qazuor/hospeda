/**
 * The in-memory fake payment provider (DEC-ARCH-004, condition B).
 *
 * It implements the WHOLE interface, every one of the eight capabilities, and
 * it is written without one provider concept: being writable that way is what
 * proves the interface does not leak one (AC:B1:1).
 *
 * **It lies like the real one** (DEC-TEST-003, AC:B1:9, AC:B1:13): every lie of
 * the closed list (`fake-lists.json`) whose surface the interface carries is
 * told here, by default, each in ONE place, behind `this.lying({ lie })`. A
 * test turns a lie off only by naming it and saying why
 * (`honestAbout: [{ lie, why }]`); GUARD:G15 checks both rules statically. The
 * provider's own rules (RP) are kept always (`fake-rules.ts`, AC:B1:14). What it
 * simulates without having measured it is apart and off by default
 * (`simulate: [{ simulation, why }]`).
 *
 * Every read by id carries its instant, taken from the injected clock (AC:B1:4),
 * and every delay of the fake (a late charge, a late notice, an expiring link)
 * runs on that same clock: the fake never reads the system time.
 *
 * Beyond the interface it exposes two test-side handles: `approve` stands for
 * the customer granting the permission on the provider's page, and
 * `takeDeliveries` hands over the notices the fake sent and that are due.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import type { CapabilitySupportMap, PaymentCapability } from '../provider/capabilities';
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
} from '../provider/payment-provider';
import { type ProviderRead, stampProviderRead } from '../provider/provider-read';
import {
    AuthorizationRefSchema,
    AuthorizeInputSchema,
    ChangeAmountInputSchema,
    ChargeInputSchema,
    ChargeRefSchema,
    NoticeDeliverySchema,
    parseProviderInput,
    RefundInputSchema
} from '../provider/schemas';
import { FakeLedger } from './fake-ledger';
import type { FakeLieId } from './fake-lists';
import { decodeFakeNotice } from './fake-notice';
import { type FakePaymentProviderOptions, parseFakeOptions } from './fake-options';
import { FakeOutbox } from './fake-outbox';
import { assertChargeableAmount, assertUnusedPaymentToken, nextChargeBatch } from './fake-rules';
import {
    APPROVAL_BASE_URL,
    assertSameCurrency,
    FAKE_CAPABILITY_SUPPORT,
    FAKE_HONEST_LINK_LIFETIME_MS,
    NOT_REFUNDABLE_MESSAGE,
    rejected,
    throughNetwork
} from './fake-support';

export { FAKE_CAPABILITY_SUPPORT, FAKE_HONEST_LINK_LIFETIME_MS, NOT_REFUNDABLE_MESSAGE };

/** In-memory payment provider implementing all eight capabilities, lying as measured. */
export class FakePaymentProvider implements PaymentProvider {
    readonly capabilitySupport: CapabilitySupportMap = FAKE_CAPABILITY_SUPPORT;

    private readonly outbox: FakeOutbox;
    private readonly ledger: FakeLedger;
    private readonly clock: Clock;
    private readonly honest: ReadonlySet<string>;
    private readonly simulating: ReadonlySet<string>;
    private readonly usedPaymentTokens = new Set<string>();

    /**
     * @param options.clock - The clock every read and every delay runs on
     * @param options.honestAbout - The lies this test turns off, each with why
     * @param options.simulate - The simulations this test turns on, each with why
     */
    constructor(options: FakePaymentProviderOptions) {
        const parsed = parseFakeOptions({ options });
        this.clock = parsed.clock;
        this.honest = parsed.honest;
        this.simulating = parsed.simulating;
        this.outbox = new FakeOutbox({
            clock: this.clock,
            isHonestAbout: ({ lie }) => this.honest.has(lie),
            outOfOrder: this.simulating.has('noticesOutOfOrder')
        });
        this.ledger = new FakeLedger({ outbox: this.outbox });
    }

    /**
     * Capability 1 · authorize: the authorization is born pending the customer's
     * approval. Each equal request creates another (M3), and the link comes
     * back broken (M10).
     */
    async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
        const { value } = parseProviderInput({
            schema: AuthorizeInputSchema,
            input,
            capability: 'authorize'
        });
        return throughNetwork({
            simulating: this.simulating,
            capability: 'authorize',
            run: () => {
                this.catchUp();
                assertChargeableAmount({ amount: value.amount, capability: 'authorize' });
                assertUnusedPaymentToken({
                    paymentToken: value.paymentToken,
                    usedTokens: this.usedPaymentTokens
                });
                const existing = [...this.ledger.authorizations.values()].find(
                    (stored) => stored.snapshot.reference === value.reference
                );
                if (existing && !this.lying({ lie: 'M3' })) {
                    const { authorizationId } = existing.snapshot;
                    return { authorizationId, approvalUrl: existing.approvalUrl };
                }
                const authorizationId = this.ledger.nextId({ prefix: 'auth' });
                const link = `${APPROVAL_BASE_URL}${authorizationId}`;
                const approvalUrl = this.lying({ lie: 'M10' }) ? `${link}?activation=true` : link;
                const dropsSentFields = this.dropsWhatWasSent();
                this.ledger.authorizations.set(authorizationId, {
                    snapshot: {
                        authorizationId,
                        reference: value.reference,
                        status: 'pending',
                        amount: { ...value.amount },
                        cadence: dropsSentFields ? { everyMonths: 1 } : { ...value.cadence },
                        firstChargeAt: dropsSentFields ? null : (value.firstChargeAt ?? null),
                        freePeriodDays: this.addedFreePeriodDays({
                            firstChargeAt: value.firstChargeAt
                        })
                    },
                    version: 1,
                    approvalUrl,
                    createdAt: this.now()
                });
                if (value.paymentToken !== undefined)
                    this.usedPaymentTokens.add(value.paymentToken);
                this.ledger.emit({
                    resourceKind: 'authorization',
                    resourceId: authorizationId,
                    version: 1
                });
                return { authorizationId, approvalUrl };
            }
        });
    }

    /**
     * Test handle: the customer grants the permission on the provider's page.
     * It is not a request of ours, so no network simulation touches it.
     *
     * @param input.authorizationId - The pending authorization
     * @returns The acknowledgement of the transition
     */
    async approve(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        return this.transition({
            input,
            capability: 'authorize',
            from: ['pending'],
            to: 'active',
            viaNetwork: false
        });
    }

    /**
     * Capability 2 · charge: only an active authorization is charged (RP9), in
     * its currency and within the amount range (RP3, RP4). The charge lands in
     * the first batch after the hour it was asked (M8): pending until then.
     */
    async charge(input: ChargeInput): Promise<ChargeResult> {
        const { value } = parseProviderInput({
            schema: ChargeInputSchema,
            input,
            capability: 'charge'
        });
        return throughNetwork({
            simulating: this.simulating,
            capability: 'charge',
            run: () => {
                this.catchUp();
                const stored = this.ledger.authorizationOrThrow({
                    id: value.authorizationId,
                    capability: 'charge'
                });
                if (stored.snapshot.status === 'paused') {
                    throw rejected({
                        capability: 'charge',
                        reason: 'a paused authorization is not charged'
                    });
                }
                if (stored.snapshot.status !== 'active') {
                    throw rejected({
                        capability: 'charge',
                        reason: `authorization is ${stored.snapshot.status}`
                    });
                }
                assertChargeableAmount({ amount: value.amount, capability: 'charge' });
                assertSameCurrency({
                    expected: stored.snapshot.amount,
                    actual: value.amount,
                    capability: 'charge'
                });
                const late = this.lying({ lie: 'M8' });
                const chargeId = this.ledger.nextId({ prefix: 'charge' });
                this.ledger.charges.set(chargeId, {
                    snapshot: {
                        chargeId,
                        authorizationId: value.authorizationId,
                        reference: value.reference,
                        status: late ? 'pending' : 'approved',
                        amount: { ...value.amount },
                        refundedAmount: { amountMinor: 0, currency: value.amount.currency }
                    },
                    version: 1,
                    settleAt: late ? nextChargeBatch({ at: this.now() }) : null,
                    refundAttempts: 0,
                    refundsByReference: new Map()
                });
                this.ledger.emit({ resourceKind: 'charge', resourceId: chargeId, version: 1 });
                return { chargeId };
            }
        });
    }

    /**
     * Capability 3 · change the amount of a live authorization. A paused one
     * refuses it (RP6); the new amount keeps the range (RP3, RP4). No notice
     * says it happened (M5).
     */
    async changeAmount(input: ChangeAmountInput): Promise<MutationAcknowledgement> {
        const { value } = parseProviderInput({
            schema: ChangeAmountInputSchema,
            input,
            capability: 'changeAmount'
        });
        return throughNetwork({
            simulating: this.simulating,
            capability: 'changeAmount',
            run: () => {
                this.catchUp();
                const stored = this.ledger.authorizationOrThrow({
                    id: value.authorizationId,
                    capability: 'changeAmount'
                });
                const { status } = stored.snapshot;
                if (status === 'cancelled' || status === 'paused') {
                    throw rejected({
                        capability: 'changeAmount',
                        reason: `a ${status} authorization accepts no change`
                    });
                }
                assertChargeableAmount({ amount: value.amount, capability: 'changeAmount' });
                assertSameCurrency({
                    expected: stored.snapshot.amount,
                    actual: value.amount,
                    capability: 'changeAmount'
                });
                stored.snapshot = { ...stored.snapshot, amount: { ...value.amount } };
                this.ledger.bump({
                    stored,
                    resourceKind: 'authorization',
                    resourceId: value.authorizationId,
                    notify: !this.lying({ lie: 'M5' })
                });
                return { accepted: true as const, resourceId: value.authorizationId };
            }
        });
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

    /** Capability 5 · cancel: irreversible, from any state but cancelled (RP6: paused too). */
    async cancel(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        return this.transition({
            input,
            capability: 'cancel',
            from: ['pending', 'active', 'paused'],
            to: 'cancelled'
        });
    }

    /**
     * Capability 6 · refund, total or partial, cumulative against what was
     * charged. The `reference` is the idempotency key: without it the request
     * fails before anything else (RP2), and repeated it moves nothing (RP5).
     * The first partial refund of a charge is refused as not refundable (M13).
     */
    async refund(input: RefundInput): Promise<RefundResult> {
        const { value } = parseProviderInput({
            schema: RefundInputSchema,
            input,
            capability: 'refund'
        });
        return throughNetwork({
            simulating: this.simulating,
            capability: 'refund',
            run: () => {
                this.catchUp();
                const stored = this.ledger.chargeOrThrow({
                    id: value.chargeId,
                    capability: 'refund'
                });
                const replayed = stored.refundsByReference.get(value.reference);
                if (replayed !== undefined) {
                    if (replayed !== value.amount.amountMinor) {
                        throw rejected({
                            capability: 'refund',
                            reason: 'the key was already used for another amount'
                        });
                    }
                    return { refundId: '' };
                }
                const { snapshot } = stored;
                if (snapshot.status !== 'approved') {
                    throw rejected({
                        capability: 'refund',
                        reason: `charge is ${snapshot.status}`
                    });
                }
                assertSameCurrency({
                    expected: snapshot.amount,
                    actual: value.amount,
                    capability: 'refund'
                });
                const refunded = snapshot.refundedAmount.amountMinor + value.amount.amountMinor;
                if (refunded > snapshot.amount.amountMinor) {
                    throw rejected({
                        capability: 'refund',
                        reason: 'refund exceeds the charged amount'
                    });
                }
                stored.refundAttempts += 1;
                const partial = refunded < snapshot.amount.amountMinor;
                if (stored.refundAttempts === 1 && partial && this.lying({ lie: 'M13' })) {
                    throw rejected({ capability: 'refund', reason: NOT_REFUNDABLE_MESSAGE });
                }
                stored.snapshot = {
                    ...snapshot,
                    refundedAmount: { amountMinor: refunded, currency: snapshot.amount.currency }
                };
                stored.refundsByReference.set(value.reference, value.amount.amountMinor);
                const refundId = this.ledger.nextId({ prefix: 'refund' });
                this.ledger.bump({ stored, resourceKind: 'charge', resourceId: value.chargeId });
                this.ledger.emit({ resourceKind: 'refund', resourceId: refundId, version: 1 });
                return { refundId };
            }
        });
    }

    /** Capability 7 · read an authorization by id. */
    async readAuthorization(input: AuthorizationRef): Promise<ProviderRead<AuthorizationSnapshot>> {
        const { value } = parseProviderInput({
            schema: AuthorizationRefSchema,
            input,
            capability: 'read'
        });
        this.catchUp();
        const snapshot = structuredClone(
            this.ledger.authorizationOrThrow({ id: value.authorizationId, capability: 'read' })
                .snapshot
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
        this.catchUp();
        const snapshot = structuredClone(
            this.ledger.chargeOrThrow({ id: value.chargeId, capability: 'read' }).snapshot
        );
        return stampProviderRead({ snapshot, clock: this.clock });
    }

    /** Capability 8 · decode one of the fake's own deliveries, in either format, into a notice. */
    async decodeNotice(input: NoticeDelivery): Promise<ProviderNotice> {
        const { value } = parseProviderInput({
            schema: NoticeDeliverySchema,
            input,
            capability: 'notify'
        });
        return decodeFakeNotice({ delivery: value }).notice;
    }

    /**
     * Test handle: hands over, and forgets, every delivery due by now.
     *
     * @returns The due deliveries, oldest first
     */
    takeDeliveries(): { readonly deliveries: readonly NoticeDelivery[] } {
        this.catchUp();
        return this.outbox.take();
    }

    private lying(args: { readonly lie: FakeLieId }): boolean {
        return !this.honest.has(args.lie);
    }

    /** EX-5 measured discarded `items` at creation; dropping cycle/date extends AC:B3:42.
     * M1 + M9: combinación no medida; comportamiento provisorio, Coord-33.
     * M1 descarta la fecha guardada y M9 calcula el período desde la fecha enviada.
     */
    private dropsWhatWasSent(): boolean {
        return this.lying({ lie: 'M1' });
    }

    /** A future first charge can carry a provider-added period; it is not our trial state. */
    private addedFreePeriodDays(args: {
        readonly firstChargeAt: string | undefined;
    }): number | null {
        const first = args.firstChargeAt ? Date.parse(args.firstChargeAt) : NaN;
        if (!(first > this.now()) || !this.lying({ lie: 'M9' })) return null;
        return Math.max(1, Math.ceil((first - this.now()) / 86_400_000));
    }

    /** Brings the time-driven state up to the clock: late charges land, open links expire. */
    private catchUp(): void {
        const now = this.now();
        for (const [chargeId, stored] of this.ledger.charges) {
            if (stored.settleAt === null || stored.settleAt > now) continue;
            const at = stored.settleAt;
            stored.settleAt = null;
            stored.snapshot = { ...stored.snapshot, status: 'approved' };
            this.ledger.bump({ stored, resourceKind: 'charge', resourceId: chargeId, at });
        }
        this.expireOpenLinks({ now });
    }

    /** With M11 off, a link nobody approved expires after a day. With it on, never. */
    private expireOpenLinks(args: { readonly now: number }): void {
        if (this.lying({ lie: 'M11' })) return;
        for (const [authorizationId, stored] of this.ledger.authorizations) {
            const expiresAt = stored.createdAt + FAKE_HONEST_LINK_LIFETIME_MS;
            if (stored.snapshot.status !== 'pending' || expiresAt > args.now) continue;
            stored.snapshot = { ...stored.snapshot, status: 'cancelled' };
            this.ledger.bump({
                stored,
                resourceKind: 'authorization',
                resourceId: authorizationId,
                at: expiresAt
            });
        }
    }

    private async transition(args: {
        readonly input: AuthorizationRef;
        readonly capability: PaymentCapability;
        readonly from: readonly AuthorizationSnapshot['status'][];
        readonly to: AuthorizationSnapshot['status'];
        readonly viaNetwork?: boolean;
    }): Promise<MutationAcknowledgement> {
        const { value } = parseProviderInput({
            schema: AuthorizationRefSchema,
            input: args.input,
            capability: args.capability
        });
        const run = (): MutationAcknowledgement => {
            this.catchUp();
            const stored = this.ledger.authorizationOrThrow({
                id: value.authorizationId,
                capability: args.capability
            });
            if (!args.from.includes(stored.snapshot.status)) {
                throw rejected({
                    capability: args.capability,
                    reason: `cannot go from ${stored.snapshot.status} to ${args.to}`
                });
            }
            stored.snapshot = { ...stored.snapshot, status: args.to };
            this.ledger.bump({
                stored,
                resourceKind: 'authorization',
                resourceId: value.authorizationId
            });
            return { accepted: true, resourceId: value.authorizationId };
        };
        return args.viaNetwork === false
            ? run()
            : throughNetwork({
                  simulating: this.simulating,
                  capability: args.capability,
                  run
              });
    }

    private now(): number {
        return this.clock.now().getTime();
    }
}
