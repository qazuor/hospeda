/**
 * The fake's one-time payment pages (HOS-2179 §7.3): a page the customer pays once,
 * with no card data passing through us. Two provider RULES, measured in sandbox on
 * 2026-11-18, hold here and never switch off:
 *
 * - RP18: a page takes more than one approved payment until it expires; each payment is
 *   its own charge carrying the page's reference.
 * - RP19: an expired page takes no payment (nothing is created), and a read of the page
 *   carries no expired flag: only its dates.
 *
 * Not measured (EX-61): whether the provider honours the creation key. The fake does
 * NOT deduplicate by key, the harder case the domain must survive (§5.6): a repeated
 * request opens another page with the same reference.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import type {
    ChargeSearchInput,
    ChargeSearchResult,
    ChargeStatus,
    Money,
    MutationAcknowledgement,
    OneTimePaymentInput,
    OneTimePaymentResult,
    PaymentPageSnapshot
} from '../provider/payment-provider';
import type { FakeLedger } from './fake-ledger';
import { notFound, rejected } from './fake-support';

/** Where the fake sends a customer to pay a page; a reserved, never-resolving host. */
export const PAYMENT_PAGE_BASE_URL = 'https://payments-fake.invalid/pay/';

/** Why a payment made and rejected on a page was rejected, in a domain string. */
export const PAGE_DECLINE_REASON = 'declined on the payment page';

/** A payment page as the fake keeps it. */
interface StoredPaymentPage {
    snapshot: PaymentPageSnapshot;
    readonly amount: Money;
    readonly reason: string;
    readonly returnUrl: string;
    readonly approvalUrl: string;
}

/** The outcome of the customer paying a page, for the test. */
export interface PagePaymentOutcome {
    readonly chargeId: string;
    readonly status: ChargeStatus;
    readonly reference: string;
    readonly returnUrl: string;
}

/** The fake's one-time payment pages and the payments made on them. */
export class FakePaymentPages {
    private readonly pages = new Map<string, StoredPaymentPage>();

    constructor(private readonly args: { readonly ledger: FakeLedger; readonly clock: Clock }) {}

    /** Opens a page. Moves no money and does not deduplicate by key (EX-61 unmeasured). */
    create(input: OneTimePaymentInput): OneTimePaymentResult {
        const paymentPageId = this.args.ledger.nextId({ prefix: 'page' });
        const approvalUrl = `${PAYMENT_PAGE_BASE_URL}${paymentPageId}`;
        const expiresAt = new Date(input.expiresAt).toISOString();
        this.pages.set(paymentPageId, {
            snapshot: {
                paymentPageId,
                reference: input.reference,
                expiresAt,
                createdAt: this.args.clock.now().toISOString()
            },
            amount: { ...input.amount },
            reason: input.reason,
            returnUrl: input.returnUrl,
            approvalUrl
        });
        return { paymentPageId, approvalUrl, expiresAt };
    }

    /** One page by id, or `NOT_FOUND`. No expired flag: RP19. */
    read(input: { readonly paymentPageId: string }): PaymentPageSnapshot {
        return structuredClone(this.pageOrThrow({ ...input, capability: 'read' }).snapshot);
    }

    /** Moves the expiry to now; an already earlier expiry is kept. */
    close(input: { readonly paymentPageId: string }): MutationAcknowledgement {
        const page = this.pageOrThrow({ ...input, capability: 'cancel' });
        const now = this.args.clock.now().getTime();
        const current =
            page.snapshot.expiresAt === null ? Infinity : Date.parse(page.snapshot.expiresAt);
        if (current > now)
            page.snapshot = { ...page.snapshot, expiresAt: new Date(now).toISOString() };
        return { accepted: true, resourceId: input.paymentPageId };
    }

    /**
     * The customer pays on the page. RP19: an expired page refuses and creates nothing.
     * RP18: an open page takes every payment, approved or not, each its own charge.
     *
     * @throws PaymentProviderError `REJECTED` when the page expired, `NOT_FOUND` when unknown
     */
    pay(input: {
        readonly paymentPageId: string;
        readonly outcome: 'approved' | 'rejected';
    }): PagePaymentOutcome {
        const page = this.pageOrThrow({ ...input, capability: 'charge' });
        const now = this.args.clock.now();
        const { expiresAt, reference } = page.snapshot;
        if (expiresAt !== null && Date.parse(expiresAt) <= now.getTime())
            throw rejected({
                capability: 'charge',
                reason: 'an expired payment page takes no payment (RP19)'
            });
        const chargeId = this.args.ledger.nextId({ prefix: 'charge' });
        const status: ChargeStatus = input.outcome;
        this.args.ledger.charges.set(chargeId, {
            snapshot: {
                chargeId,
                createdAt: now.toISOString(),
                expiresAt: null,
                purpose: 'charge',
                authorizationId: null,
                reference,
                status,
                declineReason: status === 'rejected' ? PAGE_DECLINE_REASON : null,
                amount: { ...page.amount },
                refundedAmount: { amountMinor: 0, currency: page.amount.currency },
                chargedBack: false,
                refunds: []
            },
            version: 1,
            settleAt: null,
            refundAttempts: 0,
            refundsByReference: new Map()
        });
        this.args.ledger.emit({ resourceKind: 'charge', resourceId: chargeId, version: 1 });
        return { chargeId, status, reference, returnUrl: page.returnUrl };
    }

    /** Charge ids with exactly this reference created inside the inclusive range, oldest first. */
    searchCharges(input: ChargeSearchInput): ChargeSearchResult {
        const from = Date.parse(input.createdFrom);
        const to = Date.parse(input.createdTo);
        const chargeIds = [...this.args.ledger.charges.values()]
            .map(({ snapshot }) => snapshot)
            .filter((charge) => {
                const created = Date.parse(charge.createdAt);
                return charge.reference === input.reference && created >= from && created <= to;
            })
            .sort(
                (a, b) =>
                    a.createdAt.localeCompare(b.createdAt) || a.chargeId.localeCompare(b.chargeId)
            )
            .map((charge) => charge.chargeId);
        return { chargeIds };
    }

    private pageOrThrow(args: {
        readonly paymentPageId: string;
        readonly capability: 'read' | 'cancel' | 'charge';
    }): StoredPaymentPage {
        const page = this.pages.get(args.paymentPageId);
        if (!page) throw notFound({ capability: args.capability, id: args.paymentPageId });
        return page;
    }
}
