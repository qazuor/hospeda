import type { AccommodationListingPlan } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { accommodationListingPlans } from '../schemas/accommodationListing/accommodationListingPlan.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Accommodation Listing Plan Model
 *
 * Manages plans that define the limits and features for accommodation listings
 * including pricing, listing limits, photo limits, and premium features.
 *
 * @extends BaseModel<AccommodationListingPlan>
 */
export class AccommodationListingPlanModel extends BaseModel<AccommodationListingPlan> {
    protected table = accommodationListingPlans;
    protected entityName = 'accommodation-listing-plan';

    protected getTableName(): string {
        return 'accommodation_listing_plans';
    }

    /**
     * Find all active accommodation listing plans
     *
     * @returns Array of active plans
     *
     * @example
     * ```ts
     * const activePlans = await model.findActive();
     * ```
     */
    async findActive(): Promise<AccommodationListingPlan[]> {
        try {
            const result = await this.findAll({ isActive: true });
            logQuery(this.entityName, 'findActive', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findActive', {}, error as Error);
            throw error;
        }
    }

    /**
     * Find all plans with trial available
     *
     * @returns Array of plans with trial
     *
     * @example
     * ```ts
     * const trialPlans = await model.findWithTrial();
     * ```
     */
    async findWithTrial(): Promise<AccommodationListingPlan[]> {
        try {
            const result = await this.findAll({ isTrialAvailable: true });
            logQuery(this.entityName, 'findWithTrial', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findWithTrial', {}, error as Error);
            throw error;
        }
    }

    /**
     * Activate a plan (set isActive to true)
     *
     * @param planId - The plan ID to activate
     * @returns Updated plan
     *
     * @example
     * ```ts
     * const activated = await model.activate('plan-123');
     * ```
     */
    async activate(planId: string): Promise<AccommodationListingPlan> {
        try {
            const result = await this.update({ id: planId }, {
                isActive: true
            } as Partial<AccommodationListingPlan>);

            if (!result) {
                throw new Error(`Accommodation listing plan not found: ${planId}`);
            }

            logQuery(this.entityName, 'activate', { planId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'activate', { planId }, error as Error);
            throw error;
        }
    }

    /**
     * Deactivate a plan (set isActive to false)
     *
     * @param planId - The plan ID to deactivate
     * @returns Updated plan
     *
     * @example
     * ```ts
     * const deactivated = await model.deactivate('plan-123');
     * ```
     */
    async deactivate(planId: string): Promise<AccommodationListingPlan> {
        try {
            const result = await this.update({ id: planId }, {
                isActive: false
            } as Partial<AccommodationListingPlan>);

            if (!result) {
                throw new Error(`Accommodation listing plan not found: ${planId}`);
            }

            logQuery(this.entityName, 'deactivate', { planId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'deactivate', { planId }, error as Error);
            throw error;
        }
    }
}
