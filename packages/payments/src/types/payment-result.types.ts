/**
 * Payment result types for webhook and service responses
 * @module payments/types/payment-result
 */

import type { PaymentId, SubscriptionId } from '@repo/types';

/**
 * Result of processing a payment notification
 */
export interface PaymentProcessingResult {
    /** Whether the processing was successful */
    success: boolean;
    /** Payment ID that was processed */
    paymentId: string;
    /** Current payment status */
    status: string;
    /** Additional metadata from the payment */
    metadata?: Record<string, unknown>;
    /** Error message if processing failed */
    errorMessage?: string;
}

/**
 * Result of processing a subscription notification
 */
export interface SubscriptionProcessingResult {
    /** Whether the processing was successful */
    success: boolean;
    /** Subscription ID that was processed */
    subscriptionId: string;
    /** Current subscription status */
    status: string;
    /** Additional metadata from the subscription */
    metadata?: Record<string, unknown>;
    /** Error message if processing failed */
    errorMessage?: string;
}

/**
 * Context for creating payments
 */
export interface PaymentContext {
    /** User ID making the payment */
    userId: string;
    /** Payment plan ID being purchased */
    paymentPlanId: string;
    /** Additional metadata for the payment */
    metadata?: Record<string, unknown>;
}

/**
 * Payment preference data for Mercado Pago
 */
export interface PaymentPreference {
    /** Preference ID from Mercado Pago */
    id: string;
    /** Preference ID (alias for compatibility) */
    preferenceId?: string;
    /** Payment ID (alias for compatibility) */
    paymentId?: string;
    /** External reference */
    externalReference?: string;
    /** Payment initialization URL */
    init_point: string;
    /** Init point (alias for compatibility) */
    initPoint?: string;
    /** Sandbox initialization URL */
    sandbox_init_point?: string;
    /** Sandbox init point (alias for compatibility) */
    sandboxInitPoint?: string;
}

/**
 * Generic payment result
 */
export interface PaymentResult {
    /** Whether the operation was successful */
    success: boolean;
    /** Payment ID */
    paymentId?: string;
    /** Mercado Pago Payment ID */
    mercadoPagoPaymentId?: string;
    /** External reference */
    externalReference?: string;
    /** Payment status */
    status?: string;
    /** Payment amount */
    amount?: number;
    /** Payment currency */
    currency?: string;
    /** Result data */
    data?: unknown;
    /** Error message if failed */
    error?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Generic subscription result
 */
export interface SubscriptionResult {
    /** Whether the operation was successful */
    success: boolean;
    /** Subscription ID */
    subscriptionId?: string;
    /** User ID */
    userId?: string;
    /** Payment Plan ID */
    paymentPlanId?: string;
    /** Mercado Pago Subscription ID */
    mercadoPagoSubscriptionId?: string;
    /** Next billing date */
    nextBillingDate?: Date;
    /** Subscription status */
    status?: string;
    /** Result data */
    data?: unknown;
    /** Error message if failed */
    error?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Result of creating a payment preference
 */
export interface PaymentCreationResult {
    /** Whether the creation was successful */
    success: boolean;
    /** Created payment ID */
    paymentId?: PaymentId;
    /** Mercado Pago preference ID */
    preferenceId?: string;
    /** Payment initialization URL */
    initPoint?: string;
    /** Error message if creation failed */
    errorMessage?: string;
}

/**
 * Result of creating a subscription
 */
export interface SubscriptionCreationResult {
    /** Whether the creation was successful */
    success: boolean;
    /** Created subscription ID */
    subscriptionId?: SubscriptionId;
    /** Mercado Pago subscription ID */
    mercadoPagoSubscriptionId?: string;
    /** Error message if creation failed */
    errorMessage?: string;
}

/**
 * Input for webhook signature validation
 */
export interface WebhookValidationInput {
    /** Raw webhook payload */
    payload: string;
    /** Webhook signature header */
    signature?: string;
    /** Webhook secret for validation */
    secret?: string;
}

/**
 * Result of webhook processing
 */
export interface WebhookProcessingResult {
    /** Whether the processing was successful */
    success: boolean;
    /** Payment ID if this was a payment webhook */
    paymentId?: PaymentId;
    /** Subscription ID if this was a subscription webhook */
    subscriptionId?: SubscriptionId;
    /** Error message if processing failed */
    errorMessage?: string;
    /** Actions taken during processing */
    actions: string[];
}
