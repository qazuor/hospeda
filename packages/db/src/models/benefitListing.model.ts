import type { BenefitListing, ListingStatusEnum } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { benefitListings } from '../schemas/services/benefitListing.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Benefit Listing Model
 *
 * Manages benefit listings from partners offered to platform users.
 * Handles listing lifecycle, trial periods, and benefit details.
 *
 * @extends BaseModel<BenefitListing>
 */
export class BenefitListingModel extends BaseModel<BenefitListing> {
    protected table = benefitListings;
    protected entityName = 'benefit-listing';

    protected getTableName(): string {
        return 'benefit_listings';
    }

    /**
     * Find all listings for a specific client
     *
     * @param clientId - The client ID to filter by
     * @returns Array of benefit listings
     *
     * @example
     * ```ts
     * const clientListings = await model.findByClient('client-123');
     * ```
     */
    async findByClient(clientId: string): Promise<BenefitListing[]> {
        try {
            const result = await this.findAll({ clientId });
            logQuery(this.entityName, 'findByClient', { clientId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByClient', { clientId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all listings for a specific benefit partner
     *
     * @param partnerId - The partner ID to filter by
     * @returns Array of benefit listings
     *
     * @example
     * ```ts
     * const partnerListings = await model.findByPartner('partner-123');
     * ```
     */
    async findByPartner(partnerId: string): Promise<BenefitListing[]> {
        try {
            const result = await this.findAll({ benefitPartnerId: partnerId });
            logQuery(this.entityName, 'findByPartner', { partnerId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByPartner', { partnerId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all listings using a specific plan
     *
     * @param planId - The plan ID to filter by
     * @returns Array of benefit listings
     *
     * @example
     * ```ts
     * const planListings = await model.findByPlan('plan-123');
     * ```
     */
    async findByPlan(planId: string): Promise<BenefitListing[]> {
        try {
            const result = await this.findAll({ listingPlanId: planId });
            logQuery(this.entityName, 'findByPlan', { planId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByPlan', { planId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all listings by status
     *
     * @param status - The listing status to filter by
     * @returns Array of benefit listings
     *
     * @example
     * ```ts
     * const activeListings = await model.findByStatus(ListingStatusEnum.ACTIVE);
     * ```
     */
    async findByStatus(status: ListingStatusEnum): Promise<BenefitListing[]> {
        try {
            const result = await this.findAll({ status });
            logQuery(this.entityName, 'findByStatus', { status }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByStatus', { status }, error as Error);
            throw error;
        }
    }

    /**
     * Find all active listings
     *
     * @returns Array of active benefit listings
     *
     * @example
     * ```ts
     * const activeListings = await model.findActive();
     * ```
     */
    async findActive(): Promise<BenefitListing[]> {
        try {
            const result = await this.findAll({ status: 'ACTIVE' as ListingStatusEnum });
            logQuery(this.entityName, 'findActive', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findActive', {}, error as Error);
            throw error;
        }
    }

    /**
     * Find all listings with trial period
     *
     * @returns Array of listings with trial period
     *
     * @example
     * ```ts
     * const trialListings = await model.findWithTrial();
     * ```
     */
    async findWithTrial(): Promise<BenefitListing[]> {
        try {
            const result = await this.findAll({ isTrialPeriod: true });
            logQuery(this.entityName, 'findWithTrial', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findWithTrial', {}, error as Error);
            throw error;
        }
    }

    /**
     * Activate a listing (set status to ACTIVE)
     *
     * @param listingId - The listing ID to activate
     * @returns Updated listing
     *
     * @example
     * ```ts
     * const activated = await model.activate('listing-123');
     * ```
     */
    async activate(listingId: string): Promise<BenefitListing> {
        try {
            const result = await this.update({ id: listingId }, {
                status: 'ACTIVE' as ListingStatusEnum
            } as Partial<BenefitListing>);

            if (!result) {
                throw new Error(`Benefit listing not found: ${listingId}`);
            }

            logQuery(this.entityName, 'activate', { listingId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'activate', { listingId }, error as Error);
            throw error;
        }
    }

    /**
     * Pause a listing (set status to PAUSED)
     *
     * @param listingId - The listing ID to pause
     * @returns Updated listing
     *
     * @example
     * ```ts
     * const paused = await model.pause('listing-123');
     * ```
     */
    async pause(listingId: string): Promise<BenefitListing> {
        try {
            const result = await this.update({ id: listingId }, {
                status: 'PAUSED' as ListingStatusEnum
            } as Partial<BenefitListing>);

            if (!result) {
                throw new Error(`Benefit listing not found: ${listingId}`);
            }

            logQuery(this.entityName, 'pause', { listingId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'pause', { listingId }, error as Error);
            throw error;
        }
    }

    /**
     * Archive a listing (set status to ARCHIVED)
     *
     * @param listingId - The listing ID to archive
     * @returns Updated listing
     *
     * @example
     * ```ts
     * const archived = await model.archive('listing-123');
     * ```
     */
    async archive(listingId: string): Promise<BenefitListing> {
        try {
            const result = await this.update({ id: listingId }, {
                status: 'ARCHIVED' as ListingStatusEnum
            } as Partial<BenefitListing>);

            if (!result) {
                throw new Error(`Benefit listing not found: ${listingId}`);
            }

            logQuery(this.entityName, 'archive', { listingId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'archive', { listingId }, error as Error);
            throw error;
        }
    }
}
