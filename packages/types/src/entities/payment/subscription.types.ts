import type { WithAudit, WithOptional, Writable } from '../../common/helpers.types.js';
import type { PaymentPlanId, SubscriptionId, UserId } from '../../common/id.types.js';
import type { PriceCurrencyEnum } from '../../enums/currency.enum.js';
import type { BillingCycleEnum, SubscriptionStatusEnum } from '../../enums/payment-type.enum.js';

/**
 * Represents a subscription to a payment plan
 */
export interface SubscriptionType extends WithAudit {
    id: SubscriptionId;
    /** User who owns the subscription */
    userId: UserId;
    /** Payment plan for this subscription */
    paymentPlanId: PaymentPlanId;
    /** Current status of the subscription */
    status: SubscriptionStatusEnum;
    /** Billing cycle */
    billingCycle: BillingCycleEnum;
    /** Subscription amount per billing cycle */
    amount: number;
    /** Currency of the subscription */
    currency: PriceCurrencyEnum;
    /** Mercado Pago subscription ID */
    mercadoPagoSubscriptionId?: string;
    /** External reference for tracking */
    externalReference?: string;
    /** Date when subscription starts */
    startDate: Date;
    /** Date when subscription ends (if cancelled or expired) */
    endDate?: Date;
    /** Next billing date */
    nextBillingDate?: Date;
    /** Date when subscription was cancelled */
    cancelledAt?: Date;
    /** Reason for cancellation */
    cancellationReason?: string;
    /** Number of billing cycles completed */
    billingCyclesCompleted: number;
    /** Maximum number of billing cycles (null for unlimited) */
    maxBillingCycles?: number;
    /** Trial period end date */
    trialEndDate?: Date;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
    /** Raw response from Mercado Pago */
    mercadoPagoResponse?: Record<string, unknown>;
}

/**
 * Input structure used to create a new subscription
 */
export type NewSubscriptionInputType = WithOptional<
    SubscriptionType,
    'id' | 'createdAt' | 'updatedAt' | 'createdById' | 'updatedById'
>;

/**
 * Input structure used to update an existing subscription
 */
export type UpdateSubscriptionInputType = Partial<Writable<SubscriptionType>>;

/**
 * Summary type for displaying subscriptions in lists
 */
export type SubscriptionSummaryType = Pick<
    SubscriptionType,
    | 'id'
    | 'userId'
    | 'paymentPlanId'
    | 'status'
    | 'billingCycle'
    | 'amount'
    | 'currency'
    | 'startDate'
    | 'endDate'
    | 'nextBillingDate'
>;

/**
 * Subscription with related entities
 */
export type SubscriptionWithRelationsType = SubscriptionType & {
    /** Associated payment plan */
    paymentPlan?: {
        id: PaymentPlanId;
        name: string;
        slug: string;
        features: string[];
    };
    /** User who owns the subscription */
    user?: {
        id: UserId;
        displayName?: string;
        firstName?: string;
        lastName?: string;
    };
    /** Recent payments for this subscription */
    recentPayments?: Array<{
        id: string;
        amount: number;
        currency: PriceCurrencyEnum;
        status: string;
        createdAt: Date;
    }>;
};
