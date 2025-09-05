import type { WithAudit, WithOptional, Writable } from '../../common/helpers.types.js';
import type { PaymentPlanId } from '../../common/id.types.js';
import type { PriceCurrencyEnum } from '../../enums/currency.enum.js';
import type { BillingCycleEnum, PaymentTypeEnum } from '../../enums/payment-type.enum.js';

/**
 * Represents a payment plan configuration
 * Defines pricing, features, and billing for different payment options
 */
export interface PaymentPlanType extends WithAudit {
    id: PaymentPlanId;
    /** Unique identifier for the plan (e.g., 'premium-monthly', 'pro-yearly') */
    slug: string;
    /** Display name for the plan */
    name: string;
    /** Detailed description of the plan */
    description?: string;
    /** Type of payment: one-time or subscription */
    type: PaymentTypeEnum;
    /** Billing cycle for subscriptions */
    billingCycle?: BillingCycleEnum;
    /** Price in the specified currency */
    price: number;
    /** Currency for the price */
    currency: PriceCurrencyEnum;
    /** Discount percentage for yearly plans */
    discountPercentage?: number;
    /** List of feature identifiers included in this plan */
    features: string[];
    /** Whether this plan is currently active and available for purchase */
    isActive: boolean;
    /** Display order for sorting plans */
    sortOrder: number;
    /** Mercado Pago specific configuration */
    mercadoPagoConfig?: {
        /** Mercado Pago plan ID for subscriptions */
        planId?: string;
        /** Additional metadata for Mercado Pago */
        metadata?: Record<string, string>;
    };
}

/**
 * Input structure used to create a new payment plan
 */
export type NewPaymentPlanInputType = WithOptional<
    PaymentPlanType,
    'id' | 'createdAt' | 'updatedAt' | 'createdById' | 'updatedById'
>;

/**
 * Input structure used to update an existing payment plan
 */
export type UpdatePaymentPlanInputType = Partial<Writable<PaymentPlanType>>;

/**
 * Summary type for displaying payment plans in lists
 */
export type PaymentPlanSummaryType = Pick<
    PaymentPlanType,
    | 'id'
    | 'slug'
    | 'name'
    | 'type'
    | 'billingCycle'
    | 'price'
    | 'currency'
    | 'discountPercentage'
    | 'isActive'
>;
