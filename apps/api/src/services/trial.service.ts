/**
 * Trial Service
 *
 * Manages 14-day trial lifecycle for all HOST users.
 * Handles trial creation, status checks, expiry detection, and reactivation.
 *
 * Features:
 * - Auto-start trial on HOST registration
 * - 14-day countdown tracking
 * - Auto-block on expiry (dashboard blocked, listings hidden, data preserved)
 * - Trial to paid subscription conversion
 * - Batch expiry checking
 * - Trial expiry and reminder notifications
 *
 * @module services/trial
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { OWNER_TRIAL_DAYS } from '@repo/billing';
import { billingSubscriptionEvents, getDb } from '@repo/db';
import { NotificationType, type TrialEventPayload } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { env } from '../utils/env.js';
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
 * Input for starting a trial.
 *
 * All HOST users receive the same trial plan and duration.
 * The accommodation type (simple vs complex/hotel) is determined later
 * when the user creates their first accommodation, not at trial start.
 */
export interface StartTrialInput {
    /** Billing customer ID */
    customerId: string;
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
 * Input for reactivating a canceled subscription (BILL-13)
 */
export interface ReactivateSubscriptionInput {
    /** Billing customer ID */
    customerId: string;
    /** New plan ID to subscribe to */
    planId: string;
}

/**
 * Result from reactivating a canceled subscription
 */
export interface ReactivateSubscriptionResult {
    /** New subscription ID */
    subscriptionId: string;
    /** Previous plan ID (from the canceled subscription), or null */
    previousPlanId: string | null;
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
 * In-memory flag to prevent concurrent blockExpiredTrials runs.
 * Only one run should execute at a time to avoid double-cancelling subscriptions.
 */
let blockExpiredTrialsRunning = false;

/**
 * Reset the concurrent-run guard. Intended for testing only.
 */
export function resetBlockExpiredTrialsGuard(): void {
    blockExpiredTrialsRunning = false;
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

        const { customerId } = input;

        try {
            // All users start on the same base plan with the same trial duration.
            // The accommodation type (simple cabin vs hotel/complex) is an attribute
            // of the accommodation entity, not the user or subscription.
            const planSlug = 'owner-basico';
            const trialDays = OWNER_TRIAL_DAYS;

            apiLogger.info(
                {
                    customerId,
                    planSlug,
                    trialDays
                },
                'Starting trial for user'
            );

            // Get plan by slug
            const plansResult = await this.billing.plans.list();

            if (!plansResult.data) {
                apiLogger.error({ planSlug }, 'Failed to fetch plans list');
                throw new Error('Failed to fetch plans list');
            }

            // QZPay plans use 'name' not 'slug'
            const plan = plansResult.data.find((p) => p.name === planSlug);

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
                    autoStarted: 'true',
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

        // Guard against concurrent execution
        if (blockExpiredTrialsRunning) {
            apiLogger.warn('blockExpiredTrials is already running, skipping concurrent invocation');
            return 0;
        }

        blockExpiredTrialsRunning = true;

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

                        // Capture to Sentry if customer lookup fails so we can investigate
                        if (!customer) {
                            const lookupError = new Error(
                                `Customer not found during blockExpiredTrials: ${subscription.customerId}`
                            );
                            Sentry.captureException(lookupError, {
                                extra: {
                                    subscriptionId: subscription.id,
                                    customerId: subscription.customerId,
                                    planId: subscription.planId,
                                    trialEnd: trialEnd.toISOString()
                                },
                                tags: {
                                    module: 'trial-service',
                                    operation: 'blockExpiredTrials'
                                }
                            });
                            apiLogger.warn(
                                {
                                    subscriptionId: subscription.id,
                                    customerId: subscription.customerId
                                },
                                'Customer not found during blockExpiredTrials, proceeding with cancellation'
                            );
                        }

                        // Update subscription to cancel (QZPay doesn't support 'expired' status)
                        await this.billing.subscriptions.cancel(subscription.id);

                        // Clear entitlement cache to reflect trial expiry immediately
                        clearEntitlementCache(subscription.customerId);

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
                                upgradeUrl: `${env.HOSPEDA_SITE_URL}/mi-cuenta/suscripcion`
                            });

                            apiLogger.debug(
                                {
                                    customerId: customer.id,
                                    emailDomain: customer.email.split('@')[1]
                                },
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
        } finally {
            blockExpiredTrialsRunning = false;
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
    }): Promise<{ previousTrialEnd: string; newTrialEnd: string }> {
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

            // Update both the actual trialEnd field and metadata for audit trail
            await this.billing.subscriptions.update(subscriptionId, {
                trialEnd: newTrialEnd,
                metadata: {
                    ...((subscription.metadata as Record<string, string>) || {}),
                    trialExtendedAt: new Date().toISOString(),
                    trialExtendedBy: `${additionalDays} days`,
                    originalTrialEnd: currentTrialEnd.toISOString(),
                    newTrialEnd: newTrialEnd.toISOString()
                }
            });

            // Clear entitlement cache to reflect trial extension immediately
            clearEntitlementCache(subscription.customerId);

            apiLogger.info(
                {
                    subscriptionId,
                    previousTrialEnd: currentTrialEnd.toISOString(),
                    newTrialEnd: newTrialEnd.toISOString(),
                    additionalDays
                },
                'Trial period extended successfully'
            );

            return {
                previousTrialEnd: currentTrialEnd.toISOString(),
                newTrialEnd: newTrialEnd.toISOString()
            };
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

            // Create new paid subscription FIRST to avoid leaving user without a subscription
            // if cancellation succeeds but creation fails
            const now = new Date();

            const newSubscription = await this.billing.subscriptions.create({
                customerId,
                planId,
                metadata: {
                    convertedFromTrial: 'true',
                    convertedAt: now.toISOString()
                }
            });

            // Record reactivation event in audit log (best-effort)
            try {
                const db = getDb();
                await db.insert(billingSubscriptionEvents).values({
                    subscriptionId: newSubscription.id,
                    previousStatus: SubscriptionStatusEnum.TRIALING,
                    newStatus: SubscriptionStatusEnum.ACTIVE,
                    triggerSource: 'trial-reactivation',
                    metadata: {
                        convertedFromTrial: true,
                        customerId,
                        planId
                    }
                });
            } catch (auditError) {
                apiLogger.error(
                    { error: auditError, subscriptionId: newSubscription.id },
                    'Failed to insert reactivation event (non-blocking)'
                );
            }

            // Cancel existing trial subscriptions only after new subscription is created
            if (existingSubscriptions && existingSubscriptions.length > 0) {
                for (const sub of existingSubscriptions) {
                    if (sub.status === 'trialing') {
                        try {
                            await this.billing.subscriptions.cancel(sub.id);
                            apiLogger.debug(
                                {
                                    subscriptionId: sub.id
                                },
                                'Cancelled trial subscription'
                            );
                        } catch (cancelError) {
                            // Log but do not throw: the new subscription is already active
                            const cancelMsg =
                                cancelError instanceof Error
                                    ? cancelError.message
                                    : String(cancelError);
                            apiLogger.warn(
                                { subscriptionId: sub.id, error: cancelMsg },
                                'Failed to cancel old trial subscription after reactivation'
                            );
                        }
                    }
                }
            }

            // Clear entitlement cache to reflect new subscription immediately
            clearEntitlementCache(customerId);

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
     * Reactivate a canceled subscription by creating a new paid subscription.
     *
     * Rejects if:
     * - Any subscription is active or trialing (use plan-change instead)
     * - No canceled subscription exists (nothing to reactivate)
     *
     * @param input - Reactivation parameters
     * @returns New subscription ID and previous plan ID
     */
    async reactivateSubscription(
        input: ReactivateSubscriptionInput
    ): Promise<ReactivateSubscriptionResult> {
        if (!this.billing) {
            throw new Error('Billing not enabled');
        }

        const { customerId, planId } = input;

        try {
            apiLogger.info({ customerId, planId }, 'Reactivating canceled subscription');

            const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);

            if (!subscriptions || subscriptions.length === 0) {
                throw new Error('No canceled subscription found to reactivate');
            }

            // Reject if any subscription is active or trialing
            const activeOrTrialing = subscriptions.find(
                (sub) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (activeOrTrialing) {
                const statusLabel = activeOrTrialing.status === 'active' ? 'active' : 'trialing';
                throw new Error(
                    `Cannot reactivate: ${statusLabel} subscription exists. Use plan-change instead.`
                );
            }

            // Find a canceled subscription to reactivate from
            const canceledSub = subscriptions.find((sub) => sub.status === 'canceled');

            if (!canceledSub) {
                throw new Error('No canceled subscription found to reactivate');
            }

            const previousPlanId = canceledSub.planId ?? null;

            // Create new paid subscription FIRST to avoid leaving user without a subscription
            // if cancellation succeeds but creation fails
            const newSubscription = await this.billing.subscriptions.create({
                customerId,
                planId,
                metadata: {
                    reactivatedFromCanceled: 'true',
                    reactivatedAt: new Date().toISOString(),
                    previousPlanId: previousPlanId ?? undefined
                }
            });

            // Record reactivation event in audit log (best-effort)
            try {
                const db = getDb();
                await db.insert(billingSubscriptionEvents).values({
                    subscriptionId: newSubscription.id,
                    previousStatus: SubscriptionStatusEnum.CANCELLED,
                    newStatus: SubscriptionStatusEnum.ACTIVE,
                    triggerSource: 'subscription-reactivation',
                    metadata: {
                        reactivatedFromCanceled: true,
                        customerId,
                        planId,
                        previousPlanId
                    }
                });
            } catch (auditError) {
                apiLogger.error(
                    { error: auditError, subscriptionId: newSubscription.id },
                    'Failed to insert reactivation event (non-blocking)'
                );
            }

            // Cancel all existing canceled subscriptions (idempotent cleanup)
            // Done after creation so user always has an active subscription
            for (const sub of subscriptions) {
                if (sub.status === 'canceled') {
                    try {
                        await this.billing.subscriptions.cancel(sub.id);
                    } catch {
                        // Already canceled, ignore
                    }
                }
            }

            // Clear entitlement cache to reflect new subscription immediately
            clearEntitlementCache(customerId);

            apiLogger.info(
                {
                    customerId,
                    newSubscriptionId: newSubscription.id,
                    planId,
                    previousPlanId
                },
                'Successfully reactivated canceled subscription'
            );

            return {
                subscriptionId: newSubscription.id,
                previousPlanId
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                { customerId, planId, error: errorMessage },
                'Failed to reactivate canceled subscription'
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

                // Check if trial ends exactly on the specified day window.
                // Using exact match (===) instead of range (<=) to prevent duplicate
                // reminders when the cron runs with different daysAhead values
                // (e.g. a 3-day query should not also pick up 1-day trials).
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
