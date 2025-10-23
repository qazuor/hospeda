import { faker } from '@faker-js/faker';
import type {
    BillingCycleEnum,
    PaymentMethodEnum,
    PaymentStatusEnum,
    PaymentTypeEnum,
    SubscriptionStatusEnum
} from '../../src/enums/index.js';
import { createBaseAuditFields, createBaseIdFields } from './common.fixtures.js';

/**
 * Payment fixtures for testing
 */

/**
 * Create payment-specific entity fields
 */
const createPaymentEntityFields = () => ({
    amount: faker.number.float({ min: 1, max: 10000, fractionDigits: 2 }),
    currency: faker.helpers.arrayElement(['USD', 'ARS']),
    paymentMethod: faker.helpers.arrayElement([
        'credit_card',
        'debit_card',
        'bank_transfer',
        'ticket',
        'account_money'
    ] as PaymentMethodEnum[]),
    status: faker.helpers.arrayElement(['pending', 'approved', 'rejected'] as PaymentStatusEnum[]),
    type: faker.helpers.arrayElement(['one_time', 'subscription'] as PaymentTypeEnum[]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.7 }),
    externalReference: faker.helpers.maybe(() => faker.string.alphanumeric(20), {
        probability: 0.8
    }),
    userId: faker.string.uuid(),
    paymentPlanId: faker.string.uuid()
});

export const createValidPayment = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createPaymentEntityFields()
});

export const createMinimalPayment = () => ({
    id: faker.string.uuid(),
    amount: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
    currency: 'USD',
    paymentMethod: 'credit_card' as PaymentMethodEnum,
    status: 'pending' as PaymentStatusEnum,
    type: 'one_time' as PaymentTypeEnum,
    userId: faker.string.uuid(),
    paymentPlanId: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

export const createComplexPayment = () => ({
    ...createValidPayment(),
    description: faker.lorem.sentence(),
    externalReference: faker.string.alphanumeric(25),
    metadata: {
        gateway: 'stripe',
        transactionId: faker.string.alphanumeric(30),
        customerIp: faker.internet.ip(),
        userAgent: faker.internet.userAgent()
    },
    mercadoPagoResponse: {
        id: faker.number.int({ min: 1000000, max: 9999999 }),
        status: 'approved',
        payment_method_id: 'visa',
        transaction_amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 })
    }
});

/**
 * Payment Plan fixtures
 */
const createPaymentPlanEntityFields = () => ({
    name: faker.lorem.words({ min: 2, max: 4 }),
    description: faker.lorem.paragraph(),
    amount: faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    currency: faker.helpers.arrayElement(['USD', 'ARS']),
    billingCycle: faker.helpers.arrayElement(['monthly', 'yearly'] as BillingCycleEnum[]),
    isActive: faker.datatype.boolean(),
    trialPeriodDays: faker.helpers.maybe(() => faker.number.int({ min: 7, max: 30 }), {
        probability: 0.4
    }),
    features: faker.helpers.multiple(() => faker.lorem.word(), { count: { min: 3, max: 8 } })
});

export const createValidPaymentPlan = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createPaymentPlanEntityFields()
});

export const createMinimalPaymentPlan = () => ({
    id: faker.string.uuid(),
    name: faker.lorem.words({ min: 2, max: 3 }),
    amount: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
    currency: 'USD',
    billingCycle: 'monthly' as BillingCycleEnum,
    isActive: true,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

/**
 * Subscription fixtures
 */
const createSubscriptionEntityFields = () => ({
    userId: faker.string.uuid(),
    paymentPlanId: faker.string.uuid(),
    status: faker.helpers.arrayElement([
        'active',
        'cancelled',
        'expired',
        'paused',
        'pending'
    ] as SubscriptionStatusEnum[]),
    startDate: faker.date.past(),
    endDate: faker.helpers.maybe(() => faker.date.future(), { probability: 0.6 }),
    nextBillingDate: faker.date.future(),
    cancelledAt: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.2 }),
    pausedAt: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.1 }),
    trialEndsAt: faker.helpers.maybe(() => faker.date.future(), { probability: 0.3 })
});

export const createValidSubscription = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createSubscriptionEntityFields()
});

export const createMinimalSubscription = () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    paymentPlanId: faker.string.uuid(),
    status: 'ACTIVE' as SubscriptionStatusEnum,
    startDate: faker.date.past(),
    nextBillingDate: faker.date.future(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

export const createPaymentEdgeCases = () => [
    // Minimum amount
    {
        ...createMinimalPayment(),
        amount: 0.01
    },
    // Maximum amount
    {
        ...createMinimalPayment(),
        amount: 999999.99
    },
    // All optional fields present
    {
        ...createComplexPayment(),
        description: faker.lorem.sentences(2),
        externalReference: faker.string.alphanumeric(50)
    }
];

export const createInvalidPayment = () => ({
    // Missing required fields
    amount: 'not-number',
    currency: 'INVALID_CURRENCY',
    paymentMethod: 'INVALID_METHOD',
    status: 'INVALID_STATUS',
    type: 'INVALID_TYPE',
    // Invalid formats
    id: 'not-uuid',
    userId: 'not-uuid',
    paymentPlanId: 'not-uuid',
    createdAt: 'not-date',
    updatedAt: 'not-date',
    createdById: 'not-uuid',
    updatedById: 'not-uuid'
});

export const createPaymentWithInvalidFields = () => [
    // Negative amount
    {
        ...createMinimalPayment(),
        amount: -10.5
    },
    // Invalid currency
    {
        ...createMinimalPayment(),
        currency: 'INVALID'
    },
    // Invalid method
    {
        ...createMinimalPayment(),
        paymentMethod: 'BITCOIN'
    },
    // Invalid status
    {
        ...createMinimalPayment(),
        status: 'UNKNOWN'
    }
];

/**
 * Create multiple payments for testing arrays
 */
export const createMultiplePayments = (count = 3) =>
    Array.from({ length: count }, () => createValidPayment());

/**
 * Create payments by status for testing grouping
 */
export const createPaymentsByStatus = () => ({
    APPROVED: [
        { ...createValidPayment(), status: 'approved' as PaymentStatusEnum },
        { ...createValidPayment(), status: 'approved' as PaymentStatusEnum }
    ],
    PENDING: [{ ...createValidPayment(), status: 'pending' as PaymentStatusEnum }],
    REJECTED: [
        { ...createValidPayment(), status: 'rejected' as PaymentStatusEnum },
        { ...createValidPayment(), status: 'rejected' as PaymentStatusEnum }
    ]
});

/**
 * Create payments by method for testing filtering
 */
export const createPaymentsByMethod = () => ({
    CREDIT_CARD: [
        { ...createValidPayment(), method: 'CREDIT_CARD' as PaymentMethodEnum },
        { ...createValidPayment(), method: 'CREDIT_CARD' as PaymentMethodEnum }
    ],
    PAYPAL: [{ ...createValidPayment(), method: 'PAYPAL' as PaymentMethodEnum }],
    MERCADO_PAGO: [{ ...createValidPayment(), method: 'MERCADO_PAGO' as PaymentMethodEnum }]
});
