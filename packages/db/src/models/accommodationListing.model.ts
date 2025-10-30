import type { AccommodationListing, ListingStatusEnum } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { accommodationListings } from '../schemas/accommodationListing/accommodationListing.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Accommodation Listing Model
 *
 * Manages active listings of accommodations by clients using specific plans.
 * Handles listing lifecycle, trial periods, and custom configurations.
 *
 * @extends BaseModel<AccommodationListing>
 */
export class AccommodationListingModel extends BaseModel<AccommodationListing> {
    protected table = accommodationListings;
    protected entityName = 'accommodation-listing';

    protected getTableName(): string {
        return 'accommodation_listings';
    }

    /**
     * Find all listings for a specific client
     *
     * @param clientId - The client ID to filter by
     * @returns Array of accommodation listings
     *
     * @example
     * ```ts
     * const clientListings = await model.findByClient('client-123');
     * ```
     */
    async findByClient(clientId: string): Promise<AccommodationListing[]> {
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
     * Find all listings for a specific accommodation
     *
     * @param accommodationId - The accommodation ID to filter by
     * @returns Array of accommodation listings
     *
     * @example
     * ```ts
     * const accommodationListings = await model.findByAccommodation('accommodation-123');
     * ```
     */
    async findByAccommodation(accommodationId: string): Promise<AccommodationListing[]> {
        try {
            const result = await this.findAll({ accommodationId });
            logQuery(this.entityName, 'findByAccommodation', { accommodationId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByAccommodation', { accommodationId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all listings using a specific plan
     *
     * @param planId - The plan ID to filter by
     * @returns Array of accommodation listings
     *
     * @example
     * ```ts
     * const planListings = await model.findByPlan('plan-123');
     * ```
     */
    async findByPlan(planId: string): Promise<AccommodationListing[]> {
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
     * @returns Array of accommodation listings
     *
     * @example
     * ```ts
     * const activeListings = await model.findByStatus(ListingStatusEnum.ACTIVE);
     * ```
     */
    async findByStatus(status: ListingStatusEnum): Promise<AccommodationListing[]> {
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
     * @returns Array of active accommodation listings
     *
     * @example
     * ```ts
     * const activeListings = await model.findActive();
     * ```
     */
    async findActive(): Promise<AccommodationListing[]> {
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
     * Find all listings with active trial
     *
     * @returns Array of listings with active trial
     *
     * @example
     * ```ts
     * const trialListings = await model.findWithActiveTrial();
     * ```
     */
    async findWithActiveTrial(): Promise<AccommodationListing[]> {
        try {
            const result = await this.findAll({ isTrialActive: true });
            logQuery(this.entityName, 'findWithActiveTrial', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findWithActiveTrial', {}, error as Error);
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
    async activate(listingId: string): Promise<AccommodationListing> {
        try {
            const result = await this.update({ id: listingId }, {
                status: 'ACTIVE' as ListingStatusEnum
            } as Partial<AccommodationListing>);

            if (!result) {
                throw new Error(`Accommodation listing not found: ${listingId}`);
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
    async pause(listingId: string): Promise<AccommodationListing> {
        try {
            const result = await this.update({ id: listingId }, {
                status: 'PAUSED' as ListingStatusEnum
            } as Partial<AccommodationListing>);

            if (!result) {
                throw new Error(`Accommodation listing not found: ${listingId}`);
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
    async archive(listingId: string): Promise<AccommodationListing> {
        try {
            const result = await this.update({ id: listingId }, {
                status: 'ARCHIVED' as ListingStatusEnum
            } as Partial<AccommodationListing>);

            if (!result) {
                throw new Error(`Accommodation listing not found: ${listingId}`);
            }

            logQuery(this.entityName, 'archive', { listingId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'archive', { listingId }, error as Error);
            throw error;
        }
    }
}
