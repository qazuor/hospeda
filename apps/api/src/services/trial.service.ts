/**
 * Trial Service
 *
 * Manages 14-day trial lifecycle for owner and complex users.
 * Handles trial creation, status checks, expiry detection, and reactivation.
 *
 * Features:
 * - Auto-start trial on registration (owner/complex only)
 * - 14-day countdown tracking
 * - Auto-block on expiry (dashboard blocked, listings hidden, data preserved)
 * - Trial to paid subscription conversion
 * - Batch expiry checking
 * - Trial expiry and reminder notifications
 *
 * @module services/trial
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { COMPLEX_TRIAL_DAYS, OWNER_TRIAL_DAYS } from '@repo/billing';
import { NotificationType, type TrialEventPayload } from '@repo/notifications';
import { apiLogger } from '../utils/logger';

/**
 * Trial status information
 */
export interface TrialStatus {
    /** Whether user is currently on trial */
    isOnTrial: boolean;
    /** Whether trial has expired */
    isExpired: boolean;
    /** Trial start date (ISO string) */
    startedAt: string | null;
    /** Trial expiry date (ISO string) */
    expiresAt: string | null;
    /** Days remaining in trial (0 if expired) */
    daysRemaining: number;
    /** Current plan slug */
    planSlug: string | null;
}

/**
 * Input for starting a trial
 */
export interface StartTrialInput {
    /** Billing customer ID */
    customerId: string;
    /** User type (determines which plan to use) */
    userType: 'owner' | 'complex';
}

/**
 * Input for reactivating from trial
 */
export interface ReactivateFromTrialInput {
    /** Billing customer ID */
    customerId: string;
    /** New plan ID to subscribe to */
    planId: string;
}

/**
 * Trial ending subscription (for notifications)
 */
export interface TrialEndingSubscription {
    /** Subscription ID */
    id: string;
    /** Customer ID */
    customerId: string;
    /** User email */
    userEmail: string;
    /** User name */
    userName: string;
    /** User ID */
    userId: string;
    /** Plan slug */
    planSlug: string;
    /** Trial end date */
    trialEnd: Date;
    /** Days remaining */
    daysRemaining: number;
}

/**
 * Service for managing trial lifecycle
 */
export class TrialService {
    constructor(
        private readonly billing: QZPayBilling | null,
        private readonly sendNotification?: (payload: TrialEventPayload) => void
    ) {}

    /**
     * Start a trial for a new user
     * Creates a trial subscription with appropriate plan (Basico)
     *
     * @param input - Trial start parameters
     * @returns Trial subscription ID or null if billing disabled
     */
    async startTrial(input: StartTrialInput): Promise<string | null> {
        if (!this.billing) {
            apiLogger.debug('Billing not enabled, skipping trial creation');
            return null;
        }

        const { customerId, userType } = input;

        try {
            // Determine plan based on user type
            const planSlug = userType === 'owner' ? 'owner-basico' : 'complex-basico';
            const trialDays = userType === 'owner' ? OWNER_TRIAL_DAYS : COMPLEX_TRIAL_DAYS;

            apiLogger.info(
                {
                    customerId,
                    userType,
                    planSlug,
                    trialDays
                },
                'Starting trial for user'
            );

            // Get plan by slug
            const plansResult = await this.billing.plans.list();
            const plan = plansResult.data.find((p: { name: string }) => p.name === planSlug);

            if (!plan) {
                apiLogger.error({ planSlug }, 'Trial plan not found');
                throw new Error(`Trial plan not found: ${planSlug}`);
            }

            // Check if user already has a subscription
            const existingSubscriptions =
                await this.billing.subscriptions.getByCustomerId(customerId);

            if (existingSubscriptions && existingSubscriptions.length > 0) {
                apiLogger.warn(
                    {
                        customerId,
                        existingSubscriptions: existingSubscriptions.length
                    },
                    'User already has subscriptions, skipping trial creation'
                );
                return null;
            }

            // Create trial subscription
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + trialDays);

            const subscription = await this.billing.subscriptions.create({
                customerId,
                planId: plan.id,
                trialDays,
                metadata: {
                    userType,
                    autoStarted: true,
                    createdBy: 'trial-service'
                }
            });

            apiLogger.info(
                {
                    customerId,
                    subscriptionId: subscription.id,
                    planSlug,
                    trialEnd: trialEnd.toISOString()
                },
                'Trial subscription created successfully'
            );

            return subscription.id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId,
                    userType,
                    error: errorMessage
                },
                'Failed to start trial'
            );

            throw error;
        }
    }

    /**
     * Get trial status for a customer
     * Returns information about current trial state
     *
     * @param customerId - Billing customer ID
     * @returns Trial status information
     */
    async getTrialStatus(input: { customerId: string }): Promise<TrialStatus> {
        if (!this.billing) {
            return {
                isOnTrial: false,
                isExpired: false,
                startedAt: null,
                expiresAt: null,
                daysRemaining: 0,
                planSlug: null
            };
        }

        const { customerId } = input;

        try {
            // Get customer's subscriptions
            const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);

            if (!subscriptions || subscriptions.length === 0) {
                return {
                    isOnTrial: false,
                    isExpired: false,
                    startedAt: null,
                    expiresAt: null,
                    daysRemaining: 0,
                    planSlug: null
                };
            }

            // Find active or trial subscription
            const activeSubscription = subscriptions.find(
                (sub) => sub.status === 'trialing' || sub.status === 'active'
            );

            if (!activeSubscription) {
                return {
                    isOnTrial: false,
                    isExpired: false,
                    startedAt: null,
                    expiresAt: null,
                    daysRemaining: 0,
                    planSlug: null
                };
            }

            // Get plan information
            const plan = await this.billing.plans.get(activeSubscription.planId);

            const isOnTrial = activeSubscription.status === 'trialing';
            const now = new Date();
            const trialEnd = activeSubscription.trialEnd
                ? new Date(activeSubscription.trialEnd)
                : null;
            const isExpired = trialEnd ? now > trialEnd : false;

            // Calculate days remaining
            let daysRemaining = 0;
            if (trialEnd && !isExpired) {
                const msRemaining = trialEnd.getTime() - now.getTime();
                daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
            }

            return {
                isOnTrial,
                isExpired,
                startedAt: activeSubscription.trialStart
                    ? new Date(activeSubscription.trialStart).toISOString()
                    : null,
                expiresAt: trialEnd ? trialEnd.toISOString() : null,
                daysRemaining,
                planSlug: plan?.name || null
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId,
                    error: errorMessage
                },
                'Failed to get trial status'
            );

            // Return safe default on error
            return {
                isOnTrial: false,
                isExpired: false,
                startedAt: null,
                expiresAt: null,
                daysRemaining: 0,
                planSlug: null
            };
        }
    }

    /**
     * Check if a trial has expired
     * Returns expiry status without throwing errors
     *
     * @param customerId - Billing customer ID
     * @returns Whether trial is expired
     */
    async checkTrialExpiry(input: { customerId: string }): Promise<boolean> {
        const status = await this.getTrialStatus(input);
        return status.isExpired;
    }

    /**
     * Block expired trials (batch operation)
     * Finds all expired trials and updates their status
     * This is typically called by a cron job
     *
     * @returns Number of trials blocked
     */
    async blockExpiredTrials(): Promise<number> {
        if (!this.billing) {
            apiLogger.debug('Billing not enabled, skipping expired trial blocking');
            return 0;
        }

        try {
            apiLogger.info('Starting expired trial blocking batch job');

            // Get all trialing subscriptions
            const allSubscriptionsResult = await this.billing.subscriptions.list({
                filters: { status: 'trialing' }
            });

            if (!allSubscriptionsResult || allSubscriptionsResult.data.length === 0) {
                apiLogger.info('No trialing subscriptions found');
                return 0;
            }

            const now = new Date();
            let blockedCount = 0;

            // Check each trial subscription
            for (const subscription of allSubscriptionsResult.data) {
                const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;

                // Skip if no trial end date
                if (!trialEnd) {
                    continue;
                }

                // Check if expired
                if (now > trialEnd) {
                    try {
                        // Get customer details for notification
                        const customer = await this.billing.customers.get(subscription.customerId);
                        const plan = await this.billing.plans.get(subscription.planId);

                        // Update subscription to cancel (QZPay doesn't support 'expired' status)
                        await this.billing.subscriptions.cancel(subscription.id);

                        blockedCount++;

                        apiLogger.info(
                            {
                                subscriptionId: subscription.id,
                                customerId: subscription.customerId,
                                trialEnd: trialEnd.toISOString()
                            },
                            'Blocked expired trial subscription'
                        );

                        // Send TRIAL_EXPIRED notification (fire-and-forget)
                        if (this.sendNotification && customer && plan) {
                            this.sendNotification({
                                type: NotificationType.TRIAL_EXPIRED,
                                recipientEmail: customer.email,
                                recipientName: String(customer.metadata?.name || customer.email),
                                userId: String(customer.metadata?.userId || null),
                                customerId: customer.id,
                                planName: plan.name,
                                trialEndDate: trialEnd.toISOString(),
                                upgradeUrl: `${process.env.WEB_URL || 'https://hospeda.com'}/mi-cuenta/suscripcion`
                            });

                            apiLogger.debug(
                                { customerId: customer.id, email: customer.email },
                                'Trial expired notification queued'
                            );
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);

                        apiLogger.error(
                            {
                                subscriptionId: subscription.id,
                                error: errorMessage
                            },
                            'Failed to block expired trial subscription'
                        );
                    }
                }
            }

            apiLogger.info({ blockedCount }, 'Expired trial blocking batch job completed');

            return blockedCount;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage
                },
                'Failed to run expired trial blocking batch job'
            );

            return 0;
        }
    }

    /**
     * Extend an active trial by additional days
     * Only works for subscriptions with status 'trialing'
     *
     * @param input - Extension parameters
     * @returns New trial end date
     */
    async extendTrial(input: {
        subscriptionId: string;
        additionalDays: number;
    }): Promise<{ newTrialEnd: string }> {
        if (!this.billing) {
            throw new Error('Billing not enabled');
        }

        const { subscriptionId, additionalDays } = input;

        try {
            apiLogger.info({ subscriptionId, additionalDays }, 'Extending trial period');

            // Get the subscription
            const subscription = await this.billing.subscriptions.get(subscriptionId);

            if (!subscription) {
                throw new Error(`Subscription not found: ${subscriptionId}`);
            }

            if (subscription.status !== 'trialing') {
                throw new Error(
                    `Cannot extend trial: subscription status is '${subscription.status}', expected 'trialing'`
                );
            }

            // Calculate new trial end date
            const currentTrialEnd = subscription.trialEnd
                ? new Date(subscription.trialEnd)
                : new Date();
            const newTrialEnd = new Date(currentTrialEnd);
            newTrialEnd.setDate(newTrialEnd.getDate() + additionalDays);

            // Update the subscription metadata to track extension
            // QZPay service input only supports planId, metadata, etc.
            // We store extension info in metadata for audit trail
            await this.billing.subscriptions.update(subscriptionId, {
                metadata: {
                    ...((subscription.metadata as Record<string, string>) || {}),
                    trialExtendedAt: new Date().toISOString(),
                    trialExtendedBy: `${additionalDays} days`,
                    originalTrialEnd: currentTrialEnd.toISOString(),
                    newTrialEnd: newTrialEnd.toISOString()
                }
            });

            apiLogger.info(
                {
                    subscriptionId,
                    previousTrialEnd: currentTrialEnd.toISOString(),
                    newTrialEnd: newTrialEnd.toISOString(),
                    additionalDays
                },
                'Trial period extended successfully'
            );

            return { newTrialEnd: newTrialEnd.toISOString() };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    subscriptionId,
                    additionalDays,
                    error: errorMessage
                },
                'Failed to extend trial'
            );

            throw error;
        }
    }

    /**
     * Reactivate from trial to paid subscription
     * Converts an expired or active trial to a paid plan
     *
     * @param input - Reactivation parameters
     * @returns New subscription ID
     */
    async reactivateFromTrial(input: ReactivateFromTrialInput): Promise<string> {
        if (!this.billing) {
            throw new Error('Billing not enabled');
        }

        const { customerId, planId } = input;

        try {
            apiLogger.info(
                {
                    customerId,
                    planId
                },
                'Reactivating customer from trial'
            );

            // Get existing subscriptions
            const existingSubscriptions =
                await this.billing.subscriptions.getByCustomerId(customerId);

            // Cancel existing trial subscriptions
            if (existingSubscriptions && existingSubscriptions.length > 0) {
                for (const sub of existingSubscriptions) {
                    if (sub.status === 'trialing' || sub.status === 'canceled') {
                        await this.billing.subscriptions.cancel(sub.id);
                        apiLogger.debug(
                            {
                                subscriptionId: sub.id
                            },
                            'Cancelled trial subscription'
                        );
                    }
                }
            }

            // Create new paid subscription
            const now = new Date();

            const newSubscription = await this.billing.subscriptions.create({
                customerId,
                planId,
                metadata: {
                    convertedFromTrial: 'true',
                    convertedAt: now.toISOString()
                }
            });

            apiLogger.info(
                {
                    customerId,
                    newSubscriptionId: newSubscription.id,
                    planId
                },
                'Successfully reactivated customer from trial'
            );

            return newSubscription.id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId,
                    planId,
                    error: errorMessage
                },
                'Failed to reactivate customer from trial'
            );

            throw error;
        }
    }

    /**
     * Find trials ending soon
     * Returns trials that will expire within N days
     * Used by notification cron jobs to send reminders
     *
     * @param input - Days ahead to check
     * @returns List of trials ending soon with user details
     */
    async findTrialsEndingSoon(input: {
        daysAhead: number;
    }): Promise<TrialEndingSubscription[]> {
        if (!this.billing) {
            apiLogger.debug('Billing not enabled, skipping trial ending soon query');
            return [];
        }

        const { daysAhead } = input;

        try {
            apiLogger.info({ daysAhead }, 'Finding trials ending soon');

            // Get all active trialing subscriptions
            const allSubscriptionsResult = await this.billing.subscriptions.list({
                filters: { status: 'trialing' }
            });

            if (!allSubscriptionsResult || allSubscriptionsResult.data.length === 0) {
                apiLogger.info('No trialing subscriptions found');
                return [];
            }

            const now = new Date();
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + daysAhead);

            const endingSoon: TrialEndingSubscription[] = [];

            // Check each subscription for expiry within timeframe
            for (const subscription of allSubscriptionsResult.data) {
                const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;

                if (!trialEnd) {
                    continue;
                }

                // Calculate days remaining
                const msRemaining = trialEnd.getTime() - now.getTime();
                const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

                // Check if trial ends within the specified days
                // We want trials ending EXACTLY in daysAhead days (within 24h window)
                const isEndingSoon = daysRemaining === daysAhead;

                if (isEndingSoon) {
                    try {
                        // Get customer details
                        const customer = await this.billing.customers.get(subscription.customerId);

                        if (!customer) {
                            apiLogger.warn(
                                { customerId: subscription.customerId },
                                'Customer not found for trial subscription'
                            );
                            continue;
                        }

                        // Get plan details
                        const plan = await this.billing.plans.get(subscription.planId);

                        if (!plan) {
                            apiLogger.warn(
                                { planId: subscription.planId },
                                'Plan not found for trial subscription'
                            );
                            continue;
                        }

                        endingSoon.push({
                            id: subscription.id,
                            customerId: customer.id,
                            userEmail: customer.email,
                            userName: String(customer.metadata?.name || customer.email),
                            userId: String(customer.metadata?.userId || ''),
                            planSlug: plan.name,
                            trialEnd,
                            daysRemaining
                        });

                        apiLogger.debug(
                            {
                                subscriptionId: subscription.id,
                                customerId: customer.id,
                                daysRemaining
                            },
                            'Found trial ending soon'
                        );
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);

                        apiLogger.error(
                            {
                                subscriptionId: subscription.id,
                                error: errorMessage
                            },
                            'Failed to fetch customer/plan for trial subscription'
                        );
                    }
                }
            }

            apiLogger.info(
                { daysAhead, count: endingSoon.length },
                'Trials ending soon query completed'
            );

            return endingSoon;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    daysAhead,
                    error: errorMessage
                },
                'Failed to find trials ending soon'
            );

            return [];
        }
    }
}
