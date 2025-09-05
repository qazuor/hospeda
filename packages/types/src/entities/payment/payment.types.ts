import type { WithAudit, WithOptional, Writable } from '../../common/helpers.types.js';
import type { PaymentId, PaymentPlanId, UserId } from '../../common/id.types.js';
import type { PriceCurrencyEnum } from '../../enums/currency.enum.js';
import type { PaymentMethodEnum } from '../../enums/payment-method.enum.js';
import type { PaymentStatusEnum } from '../../enums/payment-status.enum.js';
import type { PaymentTypeEnum } from '../../enums/payment-type.enum.js';

/**
 * Represents a payment transaction
 */
export interface PaymentType extends WithAudit {
    id: PaymentId;
    /** User who made the payment */
    userId: UserId;
    /** Payment plan associated with this payment */
    paymentPlanId: PaymentPlanId;
    /** Type of payment */
    type: PaymentTypeEnum;
    /** Current status of the payment */
    status: PaymentStatusEnum;
    /** Payment method used */
    paymentMethod?: PaymentMethodEnum;
    /** Amount paid */
    amount: number;
    /** Currency of the payment */
    currency: PriceCurrencyEnum;
    /** Mercado Pago payment ID */
    mercadoPagoPaymentId?: string;
    /** Mercado Pago preference ID */
    mercadoPagoPreferenceId?: string;
    /** External reference for tracking */
    externalReference?: string;
    /** Payment description */
    description?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
    /** Date when payment was processed */
    processedAt?: Date;
    /** Date when payment expires (for pending payments) */
    expiresAt?: Date;
    /** Failure reason if payment was rejected */
    failureReason?: string;
    /** Raw response from Mercado Pago */
    mercadoPagoResponse?: Record<string, unknown>;
}

/**
 * Input structure used to create a new payment
 */
export type NewPaymentInputType = WithOptional<
    PaymentType,
    'id' | 'createdAt' | 'updatedAt' | 'createdById' | 'updatedById'
>;

/**
 * Input structure used to update an existing payment
 */
export type UpdatePaymentInputType = Partial<Writable<PaymentType>>;

/**
 * Summary type for displaying payments in lists
 */
export type PaymentSummaryType = Pick<
    PaymentType,
    | 'id'
    | 'userId'
    | 'paymentPlanId'
    | 'type'
    | 'status'
    | 'amount'
    | 'currency'
    | 'createdAt'
    | 'processedAt'
>;

/**
 * Payment with related entities
 */
export type PaymentWithRelationsType = PaymentType & {
    /** Associated payment plan */
    paymentPlan?: {
        id: PaymentPlanId;
        name: string;
        slug: string;
        type: PaymentTypeEnum;
    };
    /** User who made the payment */
    user?: {
        id: UserId;
        displayName?: string;
        firstName?: string;
        lastName?: string;
    };
};
