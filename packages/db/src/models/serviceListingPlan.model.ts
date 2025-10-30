import { BaseModel } from '../base/base.model';
import type { ServiceListingPlan } from '../schemas/serviceListing/serviceListingPlan.dbschema';
import { serviceListingPlans } from '../schemas/serviceListing/serviceListingPlan.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Service Listing Plan Model
 *
 * Manages plans that define limits and features for service listings.
 * Controls capabilities like max listings, media limits, and advanced features.
 *
 * @extends BaseModel<ServiceListingPlan>
 */
export class ServiceListingPlanModel extends BaseModel<ServiceListingPlan> {
    protected table = serviceListingPlans;
    protected entityName = 'service-listing-plan';

    protected getTableName(): string {
        return 'service_listing_plans';
    }

    /**
     * Find all active plans
     *
     * @returns Array of active plans
     *
     * @example
     * ```ts
     * const activePlans = await model.findActive();
     * ```
     */
    async findActive(): Promise<ServiceListingPlan[]> {
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
    async findWithTrial(): Promise<ServiceListingPlan[]> {
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
     * Activate a plan
     *
     * @param planId - The plan ID to activate
     * @returns Updated plan
     *
     * @example
     * ```ts
     * const activated = await model.activate('plan-123');
     * ```
     */
    async activate(planId: string): Promise<ServiceListingPlan> {
        try {
            const result = await this.update({ id: planId }, {
                isActive: true
            } as Partial<ServiceListingPlan>);

            if (!result) {
                throw new Error(`Service listing plan not found: ${planId}`);
            }

            logQuery(this.entityName, 'activate', { planId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'activate', { planId }, error as Error);
            throw error;
        }
    }

    /**
     * Deactivate a plan
     *
     * @param planId - The plan ID to deactivate
     * @returns Updated plan
     *
     * @example
     * ```ts
     * const deactivated = await model.deactivate('plan-123');
     * ```
     */
    async deactivate(planId: string): Promise<ServiceListingPlan> {
        try {
            const result = await this.update({ id: planId }, {
                isActive: false
            } as Partial<ServiceListingPlan>);

            if (!result) {
                throw new Error(`Service listing plan not found: ${planId}`);
            }

            logQuery(this.entityName, 'deactivate', { planId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'deactivate', { planId }, error as Error);
            throw error;
        }
    }
}
