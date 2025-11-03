import type { ILogger } from '@repo/logger';
import type {
    PaymentPlan,
    PaymentPlanIdType,
    Subscription,
    SubscriptionCreateInput,
    SubscriptionIdType,
    SubscriptionStatusEnum,
    SubscriptionUpdateInput,
    UserIdType
} from '@repo/schemas';
import { BillingCycleEnum } from '@repo/schemas';
import type { MercadoPagoClient } from '../clients/mercado-pago.client.js';
import type { PaymentContext, SubscriptionResult } from '../types/index.js';
import {
    calculateNextBillingDate,
    calculateSubscriptionEndDate,
    calculateYearlyPrice,
    generateExternalReference,
    isValidPrice
} from '../utils/index.js';

/**
 * Subscription repository interface for database operations
 */
export interface SubscriptionRepository {
    create(subscription: SubscriptionCreateInput): Promise<Subscription>;
    update(id: SubscriptionIdType, updates: SubscriptionUpdateInput): Promise<Subscription>;
    findById(id: SubscriptionIdType): Promise<Subscription | null>;
    findByUserIdType(userId: UserIdType): Promise<Subscription[]>;
    findByExternalReference(reference: string): Promise<Subscription | null>;
    findActiveByUserIdType(userId: UserIdType): Promise<Subscription[]>;
    findExpiring(days: number): Promise<Subscription[]>;
}

/**
 * Payment plan repository interface for database operations
 */
export interface PaymentPlanRepository {
    findById(id: PaymentPlanIdType): Promise<PaymentPlan | null>;
    findBySlug(slug: string): Promise<PaymentPlan | null>;
    findActiveSubscriptionPlans(): Promise<PaymentPlan[]>;
}

/**
 * Service for handling subscription operations
 */
export class SubscriptionService {
    private mercadoPagoClient: MercadoPagoClient;
    private subscriptionRepository: SubscriptionRepository;
    private paymentPlanRepository: PaymentPlanRepository;
    private logger: ILogger;

    /**
     * Creates a new SubscriptionService instance
     * @param mercadoPagoClient - Mercado Pago client
     * @param subscriptionRepository - Subscription repository
     * @param paymentPlanRepository - Payment plan repository
     * @param logger - Logger instance
     */
    constructor(
        mercadoPagoClient: MercadoPagoClient,
        subscriptionRepository: SubscriptionRepository,
        paymentPlanRepository: PaymentPlanRepository,
        logger: ILogger
    ) {
        this.mercadoPagoClient = mercadoPagoClient;
        this.subscriptionRepository = subscriptionRepository;
        this.paymentPlanRepository = paymentPlanRepository;
        this.logger = logger;
    }

    /**
     * Creates a new subscription
     * @param context - Payment context
     * @returns Subscription result
     */
    async createSubscription(context: PaymentContext): Promise<SubscriptionResult> {
        try {
            this.logger.info(
                {
                    userId: context.userId,
                    paymentPlanId: context.paymentPlanId
                },
                'Creating subscription'
            );

            // Get payment plan
            const paymentPlan = await this.paymentPlanRepository.findById(
                context.paymentPlanId as PaymentPlanIdType
            );
            if (!paymentPlan) {
                throw new Error(`Payment plan not found: ${context.paymentPlanId}`);
            }

            if (!paymentPlan.isActive) {
                throw new Error(`Payment plan is not active: ${context.paymentPlanId}`);
            }

            if (paymentPlan.type !== 'subscription') {
                throw new Error(`Payment plan is not for subscriptions: ${context.paymentPlanId}`);
            }

            if (!paymentPlan.billingCycle) {
                throw new Error(`Payment plan missing billing cycle: ${context.paymentPlanId}`);
            }

            // Calculate subscription amount based on billing cycle
            let subscriptionAmount = paymentPlan.price;
            if (paymentPlan.billingCycle === 'yearly' && paymentPlan.discountPercentage) {
                subscriptionAmount = calculateYearlyPrice(
                    paymentPlan.price,
                    paymentPlan.discountPercentage
                );
            }

            // Validate price
            if (!isValidPrice(subscriptionAmount)) {
                throw new Error(
                    `Invalid subscription amount: ${subscriptionAmount} ${paymentPlan.currency}`
                );
            }

            // Check for existing active subscription
            const existingSubscriptions = await this.subscriptionRepository.findActiveByUserIdType(
                context.userId as UserIdType
            );
            const existingPlanSubscription = existingSubscriptions.find(
                (sub) => sub.paymentPlanId === context.paymentPlanId
            );

            if (existingPlanSubscription) {
                throw new Error(
                    `User already has an active subscription to this plan: ${context.paymentPlanId}`
                );
            }

            // Generate external reference
            const externalReference = generateExternalReference('subscription');

            // Calculate dates
            const startDate = new Date();
            const nextBillingDate = calculateNextBillingDate(startDate, paymentPlan.billingCycle);
            const endDate = calculateSubscriptionEndDate(startDate, paymentPlan.billingCycle);

            // Create subscription record
            const subscription = await this.subscriptionRepository.create({
                userId: context.userId as UserIdType,
                paymentPlanId: context.paymentPlanId as PaymentPlanIdType,
                status: 'pending' as SubscriptionStatusEnum,
                billingCycle: paymentPlan.billingCycle,
                amount: subscriptionAmount,
                currency: paymentPlan.currency,
                externalReference,
                startDate,
                endDate: endDate || undefined,
                nextBillingDate,
                billingCyclesCompleted: 0,
                metadata: context.metadata
            });

            // TODO: Create Mercado Pago subscription/preapproval
            // This would involve creating a preapproval plan with Mercado Pago
            // For now, we'll mark the subscription as active
            const updatedSubscription = await this.subscriptionRepository.update(subscription.id, {
                status: 'active' as SubscriptionStatusEnum
            });

            this.logger.info(
                {
                    subscriptionId: subscription.id,
                    userId: context.userId,
                    paymentPlanId: context.paymentPlanId,
                    amount: subscriptionAmount,
                    billingCycle: paymentPlan.billingCycle
                },
                'Subscription created successfully'
            );

            return {
                success: true,
                subscriptionId: updatedSubscription.id,
                userId: updatedSubscription.userId,
                paymentPlanId: updatedSubscription.paymentPlanId,
                status: updatedSubscription.status,
                nextBillingDate: updatedSubscription.nextBillingDate,
                mercadoPagoSubscriptionIdType: updatedSubscription.mercadoPagoSubscriptionId
            };
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    context
                },
                'Failed to create subscription'
            );
            throw error;
        }
    }

    /**
     * Cancels a subscription
     * @param subscriptionId - Subscription ID
     * @param reason - Cancellation reason
     * @returns Updated subscription
     */
    async cancelSubscription(
        subscriptionId: SubscriptionIdType,
        reason?: string
    ): Promise<Subscription> {
        try {
            this.logger.info({ subscriptionId, reason }, 'Cancelling subscription');

            const subscription = await this.subscriptionRepository.findById(subscriptionId);
            if (!subscription) {
                throw new Error(`Subscription not found: ${subscriptionId}`);
            }

            if (subscription.status === 'cancelled') {
                throw new Error(`Subscription is already cancelled: ${subscriptionId}`);
            }

            // TODO: Cancel Mercado Pago subscription/preapproval if exists
            // if (subscription.mercadoPagoSubscriptionId) {
            //     await this.mercadoPagoClient.cancelSubscription(subscription.mercadoPagoSubscriptionId);
            // }

            const updatedSubscription = await this.subscriptionRepository.update(subscriptionId, {
                status: 'cancelled' as SubscriptionStatusEnum,
                cancelledAt: new Date(),
                cancellationReason: reason,
                endDate: new Date() // End subscription immediately
            });

            this.logger.info(
                {
                    subscriptionId,
                    reason
                },
                'Subscription cancelled successfully'
            );

            return updatedSubscription;
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    subscriptionId,
                    reason
                },
                'Failed to cancel subscription'
            );
            throw error;
        }
    }

    /**
     * Updates a subscription to a new plan
     * @param subscriptionId - Subscription ID
     * @param newPaymentPlanIdType - New payment plan ID
     * @returns Updated subscription
     */
    async updateSubscription(
        subscriptionId: SubscriptionIdType,
        newPaymentPlanIdType: PaymentPlanIdType
    ): Promise<Subscription> {
        try {
            this.logger.info({ subscriptionId, newPaymentPlanIdType }, 'Updating subscription');

            const subscription = await this.subscriptionRepository.findById(subscriptionId);
            if (!subscription) {
                throw new Error(`Subscription not found: ${subscriptionId}`);
            }

            if (subscription.status !== 'active') {
                throw new Error(`Cannot update inactive subscription: ${subscriptionId}`);
            }

            const newPaymentPlan = await this.paymentPlanRepository.findById(newPaymentPlanIdType);
            if (!newPaymentPlan) {
                throw new Error(`Payment plan not found: ${newPaymentPlanIdType}`);
            }

            if (!newPaymentPlan.isActive || newPaymentPlan.type !== 'subscription') {
                throw new Error(`Invalid payment plan for subscription: ${newPaymentPlanIdType}`);
            }

            // Calculate new subscription amount
            let newAmount = newPaymentPlan.price;
            if (newPaymentPlan.billingCycle === 'yearly' && newPaymentPlan.discountPercentage) {
                newAmount = calculateYearlyPrice(
                    newPaymentPlan.price,
                    newPaymentPlan.discountPercentage
                );
            }

            const updatedSubscription = await this.subscriptionRepository.update(subscriptionId, {
                paymentPlanId: newPaymentPlanIdType,
                billingCycle: newPaymentPlan.billingCycle || BillingCycleEnum.MONTHLY,
                amount: newAmount,
                currency: newPaymentPlan.currency
            });

            this.logger.info(
                {
                    subscriptionId,
                    newPaymentPlanIdType,
                    newAmount,
                    newBillingCycle: newPaymentPlan.billingCycle
                },
                'Subscription updated successfully'
            );

            return updatedSubscription;
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    subscriptionId,
                    newPaymentPlanIdType
                },
                'Failed to update subscription'
            );
            throw error;
        }
    }

    /**
     * Gets subscription by ID
     * @param subscriptionId - Subscription ID
     * @returns Subscription or null if not found
     */
    async getSubscription(subscriptionId: SubscriptionIdType): Promise<Subscription | null> {
        return this.subscriptionRepository.findById(subscriptionId);
    }

    /**
     * Gets all subscriptions for a user
     * @param userId - User ID
     * @returns List of user subscriptions
     */
    async getUserSubscriptions(userId: UserIdType): Promise<Subscription[]> {
        return this.subscriptionRepository.findByUserIdType(userId);
    }

    /**
     * Gets active subscriptions for a user
     * @param userId - User ID
     * @returns List of active user subscriptions
     */
    async getActiveUserSubscriptions(userId: UserIdType): Promise<Subscription[]> {
        return this.subscriptionRepository.findActiveByUserIdType(userId);
    }

    /**
     * Gets all available subscription plans
     * @returns List of subscription payment plans
     */
    async getSubscriptionPlans(): Promise<PaymentPlan[]> {
        return this.paymentPlanRepository.findActiveSubscriptionPlans();
    }

    /**
     * Processes subscription billing cycle
     * @param subscriptionId - Subscription ID
     * @returns Updated subscription
     */
    async processBillingCycle(subscriptionId: SubscriptionIdType): Promise<Subscription> {
        try {
            this.logger.info({ subscriptionId }, 'Processing billing cycle');

            const subscription = await this.subscriptionRepository.findById(subscriptionId);
            if (!subscription) {
                throw new Error(`Subscription not found: ${subscriptionId}`);
            }

            if (subscription.status !== 'active') {
                throw new Error(
                    `Cannot process billing for inactive subscription: ${subscriptionId}`
                );
            }

            // Calculate next billing date
            const nextBillingDate = calculateNextBillingDate(
                subscription.nextBillingDate || new Date(),
                subscription.billingCycle
            );

            // Check if subscription should end
            let shouldEnd = false;
            if (
                subscription.maxBillingCycles &&
                subscription.billingCyclesCompleted >= subscription.maxBillingCycles
            ) {
                shouldEnd = true;
            }

            const updates: SubscriptionUpdateInput = {
                billingCyclesCompleted: subscription.billingCyclesCompleted + 1,
                nextBillingDate: shouldEnd ? undefined : nextBillingDate
            };

            if (shouldEnd) {
                updates.status = 'expired' as SubscriptionStatusEnum;
                updates.endDate = new Date();
            }

            const updatedSubscription = await this.subscriptionRepository.update(
                subscriptionId,
                updates
            );

            this.logger.info(
                {
                    subscriptionId,
                    cyclesCompleted: updatedSubscription.billingCyclesCompleted,
                    nextBillingDate: updatedSubscription.nextBillingDate,
                    status: updatedSubscription.status
                },
                'Billing cycle processed successfully'
            );

            return updatedSubscription;
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    subscriptionId
                },
                'Failed to process billing cycle'
            );
            throw error;
        }
    }

    /**
     * Gets subscriptions expiring within specified days
     * @param days - Number of days to look ahead
     * @returns List of expiring subscriptions
     */
    async getExpiringSubscriptions(days = 7): Promise<Subscription[]> {
        return this.subscriptionRepository.findExpiring(days);
    }
}
