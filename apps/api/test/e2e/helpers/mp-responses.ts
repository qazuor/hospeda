/**
 * MercadoPago API response fixtures for E2E tests (SPEC-143 T-143-06).
 *
 * What the stub adapter (see `./mp-stub`) returns when Hospeda handlers fetch
 * the full object after receiving a lightweight IPN webhook event. Program
 * via `mpStub.config.setSuccess('<operation>', fixture)`.
 *
 * Shapes mirror real MercadoPago API responses captured from production
 * webhooks and `@qazuor/qzpay-mercadopago` adapter calls. Only the fields
 * downstream Hospeda code reads are populated; unrelated fields are omitted to
 * keep fixtures focused.
 *
 * @module test/e2e/helpers/mp-responses
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * MP preference object (returned by `preferences.create` and `preferences.get`).
 */
export interface McPreferenceResponse {
    readonly id: string;
    readonly init_point: string;
    readonly sandbox_init_point: string;
    readonly external_reference?: string;
    readonly items: ReadonlyArray<{
        readonly id?: string;
        readonly title: string;
        readonly quantity: number;
        readonly unit_price: number;
        readonly currency_id: string;
    }>;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * MP preapproval object (returned by `preapproval.create/get/update`).
 */
export interface McPreapprovalResponse {
    readonly id: string;
    readonly status: 'pending' | 'authorized' | 'paused' | 'cancelled';
    readonly payer_email: string;
    readonly external_reference?: string;
    readonly reason: string;
    readonly auto_recurring: {
        readonly frequency: number;
        readonly frequency_type: 'months' | 'days';
        readonly transaction_amount: number;
        readonly currency_id: string;
        readonly start_date?: string;
        readonly end_date?: string;
    };
    readonly back_url?: string;
    readonly init_point?: string;
    readonly date_created?: string;
    readonly last_modified?: string;
}

/**
 * MP payment object (returned by `payments.get/list/search`).
 */
export interface McPaymentResponse {
    readonly id: number;
    readonly status:
        | 'pending'
        | 'approved'
        | 'authorized'
        | 'in_process'
        | 'in_mediation'
        | 'rejected'
        | 'cancelled'
        | 'refunded'
        | 'charged_back';
    readonly status_detail: string;
    readonly transaction_amount: number;
    readonly currency_id: string;
    readonly external_reference?: string;
    readonly payment_method_id?: string;
    readonly payment_type_id?: string;
    readonly payer?: { readonly id?: string; readonly email?: string };
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly refunds?: ReadonlyArray<{ readonly id: number; readonly amount: number }>;
    readonly date_approved?: string | null;
    readonly date_created?: string;
}

/**
 * MP customer object (returned by `customers.create/get/update`).
 */
export interface McCustomerResponse {
    readonly id: string;
    readonly email: string;
    readonly external_reference?: string;
    readonly first_name?: string;
    readonly last_name?: string;
    readonly date_created?: string;
}

/**
 * MP authorized_payment object (returned by D4 recurring-charge flows).
 * Distinct from `payment`: this is the scheduled execution of a preapproval.
 */
export interface McAuthorizedPaymentResponse {
    readonly id: string;
    readonly preapproval_id: string;
    readonly status: 'scheduled' | 'processed' | 'recycling' | 'cancelled';
    readonly transaction_amount: number;
    readonly currency_id: string;
    readonly payment?: { readonly id: number; readonly status: string };
    readonly debit_date?: string;
}

/**
 * MP chargeback object (returned when a dispute is opened).
 */
export interface McChargebackResponse {
    readonly id: string;
    readonly payment_id: number;
    readonly status: 'opened' | 'under_review' | 'closed';
    readonly amount: number;
    readonly currency_id: string;
    readonly reason?: string;
    readonly date_created?: string;
}

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

interface PreferenceFixtureInput {
    readonly id?: string;
    readonly externalReference?: string;
    readonly amount?: number;
    readonly title?: string;
    readonly currencyId?: string;
}

interface PreapprovalFixtureInput {
    readonly id?: string;
    readonly status?: McPreapprovalResponse['status'];
    readonly payerEmail?: string;
    readonly externalReference?: string;
    readonly amount?: number;
    readonly currencyId?: string;
    readonly reason?: string;
}

interface PaymentFixtureInput {
    readonly id?: number;
    readonly status?: McPaymentResponse['status'];
    readonly statusDetail?: string;
    readonly amount?: number;
    readonly currencyId?: string;
    readonly externalReference?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

interface RefundedPaymentFixtureInput {
    readonly paymentId: number;
    readonly refundId?: number;
    readonly amount?: number;
    readonly currencyId?: string;
}

interface CustomerFixtureInput {
    readonly id?: string;
    readonly email?: string;
    readonly externalReference?: string;
}

interface AuthorizedPaymentFixtureInput {
    readonly id?: string;
    readonly preapprovalId: string;
    readonly status?: McAuthorizedPaymentResponse['status'];
    readonly amount?: number;
    readonly currencyId?: string;
}

interface ChargebackFixtureInput {
    readonly id?: string;
    readonly paymentId: number;
    readonly status?: McChargebackResponse['status'];
    readonly amount?: number;
    readonly currencyId?: string;
    readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function randomNumericId(): number {
    return Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Builders for stubbed MP API responses. Each returns a typed object suitable
 * for `mpStub.config.setSuccess('<operation>', fixture)`.
 */
export const mpApiResponseFixtures = {
    preference(input: PreferenceFixtureInput = {}): McPreferenceResponse {
        const id = input.id ?? `pref_test_${randomUUID()}`;
        return {
            id,
            init_point: `https://stub.example/checkout/${id}`,
            sandbox_init_point: `https://stub.example/sandbox/checkout/${id}`,
            external_reference: input.externalReference,
            items: [
                {
                    id: 'item-test-1',
                    title: input.title ?? 'Test subscription plan',
                    quantity: 1,
                    unit_price: input.amount ?? 1000,
                    currency_id: input.currencyId ?? 'ARS'
                }
            ]
        };
    },
    preapproval(input: PreapprovalFixtureInput = {}): McPreapprovalResponse {
        const id = input.id ?? `preapproval_test_${randomUUID()}`;
        const now = new Date().toISOString();
        return {
            id,
            status: input.status ?? 'authorized',
            payer_email: input.payerEmail ?? 'test-payer@example.com',
            external_reference: input.externalReference,
            reason: input.reason ?? 'Test monthly subscription',
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: input.amount ?? 1000,
                currency_id: input.currencyId ?? 'ARS',
                start_date: now
            },
            init_point: `https://stub.example/preapproval/${id}`,
            date_created: now,
            last_modified: now
        };
    },
    payment(input: PaymentFixtureInput = {}): McPaymentResponse {
        const id = input.id ?? randomNumericId();
        const status = input.status ?? 'approved';
        const now = new Date().toISOString();
        return {
            id,
            status,
            status_detail: input.statusDetail ?? (status === 'approved' ? 'accredited' : 'pending'),
            transaction_amount: input.amount ?? 1000,
            currency_id: input.currencyId ?? 'ARS',
            external_reference: input.externalReference,
            payment_method_id: 'visa',
            payment_type_id: 'credit_card',
            payer: { email: 'test-payer@example.com' },
            metadata: input.metadata,
            date_approved: status === 'approved' ? now : null,
            date_created: now
        };
    },
    /**
     * Convenience: a payment row in the `refunded` terminal state with the
     * refund record attached. Use for refund-flow assertions.
     */
    paymentRefunded(input: RefundedPaymentFixtureInput): McPaymentResponse {
        const amount = input.amount ?? 1000;
        return {
            id: input.paymentId,
            status: 'refunded',
            status_detail: 'refunded',
            transaction_amount: amount,
            currency_id: input.currencyId ?? 'ARS',
            payment_method_id: 'visa',
            payment_type_id: 'credit_card',
            refunds: [{ id: input.refundId ?? randomNumericId(), amount }],
            date_approved: null,
            date_created: new Date().toISOString()
        };
    },
    customer(input: CustomerFixtureInput = {}): McCustomerResponse {
        return {
            id: input.id ?? `customer_test_${randomUUID()}`,
            email: input.email ?? 'test-customer@example.com',
            external_reference: input.externalReference,
            first_name: 'Test',
            last_name: 'Customer',
            date_created: new Date().toISOString()
        };
    },
    authorizedPayment(input: AuthorizedPaymentFixtureInput): McAuthorizedPaymentResponse {
        return {
            id: input.id ?? `authorized_payment_test_${randomUUID()}`,
            preapproval_id: input.preapprovalId,
            status: input.status ?? 'processed',
            transaction_amount: input.amount ?? 1000,
            currency_id: input.currencyId ?? 'ARS',
            debit_date: new Date().toISOString()
        };
    },
    chargeback(input: ChargebackFixtureInput): McChargebackResponse {
        return {
            id: input.id ?? `chargeback_test_${randomUUID()}`,
            payment_id: input.paymentId,
            status: input.status ?? 'opened',
            amount: input.amount ?? 1000,
            currency_id: input.currencyId ?? 'ARS',
            reason: input.reason ?? 'fraud',
            date_created: new Date().toISOString()
        };
    }
} as const;
