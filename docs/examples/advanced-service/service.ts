/**
 * Advanced Service Example - Complex Business Logic
 *
 * This file demonstrates advanced service patterns including:
 * - Complex business logic with multiple database operations
 * - Transaction handling for data consistency
 * - Multi-level permission checking
 * - ServiceOutput error handling
 * - Business rule validation
 * - Service composition (using other services)
 *
 * Example: SubscriptionUpgradeService
 * Handles upgrading user subscriptions from one plan to another,
 * including payment processing, prorating charges, and updating limits.
 *
 * @see packages/service-core/src/services/subscription/subscription.service.ts
 * @see packages/service-core/src/base/base.crud.service.ts
 */

import { db, PricingPlanModel, PurchaseModel, SubscriptionModel } from '@repo/db';
import type {
    ClientIdType,
    PricingPlanIdType,
    Subscription,
    SubscriptionIdType
} from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode, SubscriptionStatusEnum } from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Schema for subscription upgrade request
 */
export const UpgradeSubscriptionInputSchema = z.object({
    subscriptionId: z.string().uuid(),
    newPricingPlanId: z.string().uuid(),
    effectiveDate: z.date().optional() // When to apply upgrade (default: now)
});

export type UpgradeSubscriptionInput = z.infer<typeof UpgradeSubscriptionInputSchema>;

/**
 * Result of subscription upgrade operation
 */
export const UpgradeResultSchema = z.object({
    subscription: z.object({
        id: z.string(),
        status: z.string(),
        pricingPlanId: z.string()
    }),
    purchase: z.object({
        id: z.string(),
        amount: z.number(),
        description: z.string()
    }).nullable(),
    proratedCredit: z.number(),
    message: z.string()
});

export type UpgradeResult = z.infer<typeof UpgradeResultSchema>;

/**
 * Advanced service for handling subscription upgrades/downgrades
 *
 * Demonstrates:
 * - Multi-step business process
 * - Transaction management
 * - Complex permission logic
 * - Integration with external services (payment)
 * - Prorating calculations
 * - State machine transitions
 */
export class SubscriptionUpgradeService extends BaseCrudService<
    Subscription,
    SubscriptionModel,
    typeof z.object({}),
    typeof z.object({}),
    typeof z.object({})
> {
    static readonly ENTITY_NAME = 'subscription-upgrade';
    protected readonly entityName = SubscriptionUpgradeService.ENTITY_NAME;

    private readonly subscriptionModel: SubscriptionModel;
    private readonly pricingPlanModel: PricingPlanModel;
    private readonly purchaseModel: PurchaseModel;

    constructor(ctx: ServiceContext) {
        const model = new SubscriptionModel();
        super(ctx, SubscriptionUpgradeService.ENTITY_NAME);
        this.model = model;
        this.subscriptionModel = model;
        this.pricingPlanModel = new PricingPlanModel();
        this.purchaseModel = new PurchaseModel();
    }

    /**
     * Upgrades a subscription to a new pricing plan
     *
     * Business Logic:
     * 1. Validate actor permissions (user owns subscription OR admin)
     * 2. Fetch current subscription and validate status
     * 3. Fetch new pricing plan and validate it exists
     * 4. Check business rules (can't downgrade during trial, etc.)
     * 5. Calculate prorated credit/charge
     * 6. Process payment if upgrade requires additional charge
     * 7. Update subscription in transaction
     * 8. Create purchase record
     * 9. Update client's usage limits
     *
     * @param actor - The user performing the upgrade
     * @param input - Upgrade request data
     * @returns ServiceOutput with upgrade result or error
     */
    public async upgradeSubscription(
        actor: Actor,
        input: UpgradeSubscriptionInput
    ): Promise<ServiceOutput<UpgradeResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'upgradeSubscription',
            input: { actor, ...input },
            schema: UpgradeSubscriptionInputSchema,
            execute: async (validatedData, validatedActor) => {
                // ============================================================
                // STEP 1: Permission Check
                // ============================================================
                this._checkUpgradePermission(validatedActor);

                // ============================================================
                // STEP 2: Fetch and Validate Current Subscription
                // ============================================================
                const currentSubscription = await this.subscriptionModel.findById(
                    validatedData.subscriptionId as SubscriptionIdType
                );

                if (!currentSubscription) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Subscription not found'
                    );
                }

                // Check ownership (unless admin)
                if (
                    validatedActor.role !== RoleEnum.ADMIN &&
                    currentSubscription.clientId !== validatedActor.id
                ) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You can only upgrade your own subscriptions'
                    );
                }

                // ============================================================
                // STEP 3: Fetch New Pricing Plan
                // ============================================================
                const newPlan = await this.pricingPlanModel.findById(
                    validatedData.newPricingPlanId as PricingPlanIdType
                );

                if (!newPlan) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Pricing plan not found');
                }

                if (!newPlan.isActive) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Selected pricing plan is not available'
                    );
                }

                // ============================================================
                // STEP 4: Business Rules Validation
                // ============================================================
                this._validateUpgradeRules(currentSubscription, newPlan);

                // ============================================================
                // STEP 5: Calculate Prorating
                // ============================================================
                const effectiveDate = validatedData.effectiveDate ?? new Date();
                const { credit, charge, description } = this._calculateProration(
                    currentSubscription,
                    newPlan,
                    effectiveDate
                );

                // ============================================================
                // STEP 6-9: Execute Upgrade in Transaction
                // ============================================================
                const result = await db.transaction(async (trx) => {
                    // Step 6: Process payment if charge is required
                    let purchase = null;
                    if (charge > 0) {
                        // In real implementation, integrate with payment provider
                        // For now, create purchase record
                        purchase = await this.purchaseModel.create(
                            {
                                clientId: currentSubscription.clientId as ClientIdType,
                                amount: charge,
                                description,
                                status: 'completed'
                            },
                            trx
                        );
                    }

                    // Step 7: Update subscription
                    const updatedSubscription = await this.subscriptionModel.update(
                        currentSubscription.id,
                        {
                            pricingPlanId: newPlan.id,
                            startAt: effectiveDate,
                            // Reset billing cycle count on plan change
                            billingCyclesCompleted: 0
                        },
                        trx
                    );

                    if (!updatedSubscription) {
                        throw new ServiceError(
                            ServiceErrorCode.DATABASE_ERROR,
                            'Failed to update subscription'
                        );
                    }

                    // Step 8: Record credit if applicable
                    if (credit > 0) {
                        await this.purchaseModel.create(
                            {
                                clientId: currentSubscription.clientId as ClientIdType,
                                amount: -credit, // Negative amount for credit
                                description: `Credit from downgrade: ${description}`,
                                status: 'completed'
                            },
                            trx
                        );
                    }

                    return {
                        subscription: {
                            id: updatedSubscription.id,
                            status: updatedSubscription.status,
                            pricingPlanId: updatedSubscription.pricingPlanId
                        },
                        purchase: purchase
                            ? {
                                  id: purchase.id,
                                  amount: purchase.amount,
                                  description: purchase.description ?? ''
                              }
                            : null,
                        proratedCredit: credit,
                        message: charge > 0 ? 'Subscription upgraded successfully' : 'Subscription downgraded successfully'
                    };
                });

                return result;
            }
        });
    }

    /**
     * Permission check for upgrade operation
     *
     * Rules:
     * - User must be authenticated
     * - Must have SUBSCRIPTION_UPDATE permission OR be ADMIN
     *
     * @param actor - Actor performing the upgrade
     * @throws ServiceError if permission denied
     */
    private _checkUpgradePermission(actor: Actor): void {
        if (!actor || !actor.id) {
            throw new ServiceError(
                ServiceErrorCode.UNAUTHORIZED,
                'Authentication required to upgrade subscription'
            );
        }

        const hasPermission =
            actor.role === RoleEnum.ADMIN ||
            actor.permissions.includes(PermissionEnum.SUBSCRIPTION_UPDATE);

        if (!hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to upgrade subscription'
            );
        }
    }

    /**
     * Validates business rules for subscription upgrade
     *
     * Rules:
     * 1. Cannot upgrade from same plan to same plan
     * 2. Cannot upgrade cancelled subscriptions
     * 3. Cannot downgrade during trial period
     * 4. Target plan must be active
     *
     * @param currentSubscription - Current subscription
     * @param newPlan - Target pricing plan
     * @throws ServiceError if validation fails
     */
    private _validateUpgradeRules(currentSubscription: Subscription, newPlan: any): void {
        // Rule 1: Same plan check
        if (currentSubscription.pricingPlanId === newPlan.id) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Subscription is already on this plan'
            );
        }

        // Rule 2: Cannot upgrade cancelled subscriptions
        if (currentSubscription.status === SubscriptionStatusEnum.CANCELLED) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Cannot upgrade cancelled subscription. Please create a new subscription.'
            );
        }

        // Rule 3: Trial period restriction
        const now = new Date();
        if (
            currentSubscription.trialEndsAt &&
            currentSubscription.trialEndsAt > now &&
            newPlan.price < (currentSubscription as any).currentPlanPrice
        ) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Cannot downgrade during trial period'
            );
        }
    }

    /**
     * Calculates prorated credit or charge for plan change
     *
     * Logic:
     * - If upgrading (higher price): Calculate charge for remaining period
     * - If downgrading (lower price): Calculate credit for remaining period
     * - Based on days remaining in current billing cycle
     *
     * @param subscription - Current subscription
     * @param newPlan - Target plan
     * @param effectiveDate - When upgrade takes effect
     * @returns Prorated amounts and description
     */
    private _calculateProration(
        subscription: Subscription,
        newPlan: any,
        effectiveDate: Date
    ): { credit: number; charge: number; description: string } {
        // Simplified calculation for example
        // In production, this would integrate with actual pricing data

        const daysInCycle = 30;
        const daysRemaining = this._calculateDaysRemaining(subscription, effectiveDate);
        const prorateRatio = daysRemaining / daysInCycle;

        // Mock prices (in production, fetch from plan)
        const currentPrice = 100;
        const newPrice = newPlan.price ?? 150;

        const priceDifference = newPrice - currentPrice;
        const proratedAmount = priceDifference * prorateRatio;

        let credit = 0;
        let charge = 0;
        let description = '';

        if (proratedAmount > 0) {
            // Upgrade: charge additional
            charge = proratedAmount;
            description = `Upgrade to ${newPlan.name} (prorated for ${daysRemaining} days)`;
        } else if (proratedAmount < 0) {
            // Downgrade: issue credit
            credit = Math.abs(proratedAmount);
            description = `Downgrade to ${newPlan.name} (credit for ${daysRemaining} days)`;
        } else {
            description = `Plan change to ${newPlan.name}`;
        }

        return {
            credit: Math.round(credit * 100) / 100,
            charge: Math.round(charge * 100) / 100,
            description
        };
    }

    /**
     * Calculates days remaining in current billing cycle
     *
     * @param subscription - Current subscription
     * @param effectiveDate - Upgrade effective date
     * @returns Number of days remaining
     */
    private _calculateDaysRemaining(subscription: Subscription, effectiveDate: Date): number {
        if (!subscription.endAt) {
            return 30; // Default billing cycle
        }

        const msPerDay = 1000 * 60 * 60 * 24;
        const remainingMs = subscription.endAt.getTime() - effectiveDate.getTime();
        return Math.max(0, Math.ceil(remainingMs / msPerDay));
    }

    /**
     * Protected method overrides required by BaseCrudService
     */
    protected getDefaultListRelations() {
        return {};
    }

    protected _canCreate(_actor: Actor, _data: unknown): void {
        throw new ServiceError(ServiceErrorCode.NOT_IMPLEMENTED, 'Use upgradeSubscription instead');
    }

    protected _canUpdate(_actor: Actor, _entity: Subscription): void {
        throw new ServiceError(ServiceErrorCode.NOT_IMPLEMENTED, 'Use upgradeSubscription instead');
    }

    protected _canSoftDelete(_actor: Actor, _entity: Subscription): void {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not applicable for upgrades');
    }

    protected _canHardDelete(_actor: Actor, _entity: Subscription): void {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not applicable for upgrades');
    }

    protected _canRestore(_actor: Actor, _entity: Subscription): void {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not applicable for upgrades');
    }

    protected _canView(_actor: Actor, _entity: Subscription): void {
        // Can view if owner or admin
    }

    protected _canList(_actor: Actor): void {
        // Can list if authenticated
    }

    protected _canSearch(_actor: Actor): void {
        // Can search if authenticated
    }

    protected _canCount(_actor: Actor): void {
        // Can count if authenticated
    }

    protected async _executeSearch(_params: Record<string, unknown>, _actor: Actor) {
        return this.model.findAll({}, { page: 1, pageSize: 10 });
    }

    protected async _executeCount(_params: Record<string, unknown>, _actor: Actor) {
        return { count: 0 };
    }
}
