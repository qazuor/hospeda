import { BaseModel } from '../base/base.model';
import type { ServiceListing } from '../schemas/serviceListing/serviceListing.dbschema';
import { serviceListings } from '../schemas/serviceListing/serviceListing.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Service Listing Model
 *
 * Manages service listings created by clients for their tourist services.
 * Handles listing lifecycle, trial periods, featuring, and publishing.
 *
 * @extends BaseModel<ServiceListing>
 */
export class ServiceListingModel extends BaseModel<ServiceListing> {
    protected table = serviceListings;
    protected entityName = 'service-listing';

    protected getTableName(): string {
        return 'service_listings';
    }

    /**
     * Find all listings for a specific client
     *
     * @param clientId - The client ID to filter by
     * @returns Array of service listings
     *
     * @example
     * ```ts
     * const clientListings = await model.findByClient('client-123');
     * ```
     */
    async findByClient(clientId: string): Promise<ServiceListing[]> {
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
     * Find all listings for a specific tourist service
     *
     * @param serviceId - The tourist service ID to filter by
     * @returns Array of service listings
     *
     * @example
     * ```ts
     * const serviceListings = await model.findByService('service-123');
     * ```
     */
    async findByService(serviceId: string): Promise<ServiceListing[]> {
        try {
            const result = await this.findAll({ touristServiceId: serviceId });
            logQuery(this.entityName, 'findByService', { serviceId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByService', { serviceId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all listings using a specific plan
     *
     * @param planId - The plan ID to filter by
     * @returns Array of service listings
     *
     * @example
     * ```ts
     * const planListings = await model.findByPlan('plan-123');
     * ```
     */
    async findByPlan(planId: string): Promise<ServiceListing[]> {
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
     * @returns Array of service listings
     *
     * @example
     * ```ts
     * const activeListings = await model.findByStatus('active');
     * ```
     */
    async findByStatus(status: string): Promise<ServiceListing[]> {
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
     * @returns Array of active service listings
     *
     * @example
     * ```ts
     * const activeListings = await model.findActive();
     * ```
     */
    async findActive(): Promise<ServiceListing[]> {
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
     * Find all featured listings
     *
     * @returns Array of featured service listings
     *
     * @example
     * ```ts
     * const featuredListings = await model.findFeatured();
     * ```
     */
    async findFeatured(): Promise<ServiceListing[]> {
        try {
            const result = await this.findAll({ isFeatured: true });
            logQuery(this.entityName, 'findFeatured', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findFeatured', {}, error as Error);
            throw error;
        }
    }

    /**
     * Find all listings with trial
     *
     * @returns Array of listings with trial
     *
     * @example
     * ```ts
     * const trialListings = await model.findWithTrial();
     * ```
     */
    async findWithTrial(): Promise<ServiceListing[]> {
        try {
            const result = await this.findAll({ isTrialListing: true });
            logQuery(this.entityName, 'findWithTrial', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findWithTrial', {}, error as Error);
            throw error;
        }
    }

    /**
     * Activate a listing
     *
     * @param listingId - The listing ID to activate
     * @returns Updated listing
     *
     * @example
     * ```ts
     * const activated = await model.activate('listing-123');
     * ```
     */
    async activate(listingId: string): Promise<ServiceListing> {
        try {
            const result = await this.update({ id: listingId }, {
                isActive: true,
                status: 'active'
            } as Partial<ServiceListing>);

            if (!result) {
                throw new Error(`Service listing not found: ${listingId}`);
            }

            logQuery(this.entityName, 'activate', { listingId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'activate', { listingId }, error as Error);
            throw error;
        }
    }

    /**
     * Deactivate a listing
     *
     * @param listingId - The listing ID to deactivate
     * @returns Updated listing
     *
     * @example
     * ```ts
     * const deactivated = await model.deactivate('listing-123');
     * ```
     */
    async deactivate(listingId: string): Promise<ServiceListing> {
        try {
            const result = await this.update({ id: listingId }, {
                isActive: false
            } as Partial<ServiceListing>);

            if (!result) {
                throw new Error(`Service listing not found: ${listingId}`);
            }

            logQuery(this.entityName, 'deactivate', { listingId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'deactivate', { listingId }, error as Error);
            throw error;
        }
    }

    /**
     * Publish a listing
     *
     * @param listingId - The listing ID to publish
     * @returns Updated listing
     *
     * @example
     * ```ts
     * const published = await model.publish('listing-123');
     * ```
     */
    async publish(listingId: string): Promise<ServiceListing> {
        try {
            const result = await this.update({ id: listingId }, {
                status: 'active',
                isActive: true,
                publishedAt: new Date()
            } as Partial<ServiceListing>);

            if (!result) {
                throw new Error(`Service listing not found: ${listingId}`);
            }

            logQuery(this.entityName, 'publish', { listingId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'publish', { listingId }, error as Error);
            throw error;
        }
    }

    /**
     * Pause a listing
     *
     * @param listingId - The listing ID to pause
     * @returns Updated listing
     *
     * @example
     * ```ts
     * const paused = await model.pause('listing-123');
     * ```
     */
    async pause(listingId: string): Promise<ServiceListing> {
        try {
            const result = await this.update({ id: listingId }, {
                status: 'paused',
                isActive: false
            } as Partial<ServiceListing>);

            if (!result) {
                throw new Error(`Service listing not found: ${listingId}`);
            }

            logQuery(this.entityName, 'pause', { listingId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'pause', { listingId }, error as Error);
            throw error;
        }
    }
}
