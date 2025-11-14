import type { AdSlot } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { adSlots } from '../schemas/campaign/adSlot.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Ad Slot Model
 *
 * Manages advertising slots available for reservation by campaigns.
 * Provides methods for querying active slots, finding by location key,
 * and managing slot availability.
 *
 * @extends BaseModel<AdSlot>
 */
export class AdSlotModel extends BaseModel<AdSlot> {
    protected table = adSlots;
    protected entityName = 'ad-slot';

    protected getTableName(): string {
        return 'ad_slots';
    }

    /**
     * Find an ad slot by its unique location key
     *
     * @param locationKey - The unique location key (e.g., 'HOME_BANNER', 'SIDEBAR')
     * @returns The ad slot or null if not found
     *
     * @example
     * ```ts
     * const slot = await model.findByLocationKey('HOME_BANNER');
     * ```
     */
    async findByLocationKey(locationKey: string): Promise<AdSlot | null> {
        try {
            const result = await this.findOne({ locationKey });
            logQuery(this.entityName, 'findByLocationKey', { locationKey }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findByLocationKey', { locationKey }, error as Error);
            throw error;
        }
    }

    /**
     * Find all active ad slots
     *
     * @returns Array of active ad slots
     *
     * @example
     * ```ts
     * const activeSlots = await model.findActive();
     * ```
     */
    async findActive(): Promise<AdSlot[]> {
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
     * Get all available ad slots (active and not deleted)
     *
     * This is useful for showing slots that can be reserved for campaigns.
     *
     * @returns Array of available ad slots
     *
     * @example
     * ```ts
     * const availableSlots = await model.getAvailableSlots();
     * ```
     */
    async getAvailableSlots(): Promise<AdSlot[]> {
        try {
            // Find active slots that are not soft-deleted
            const result = await this.findAll({
                isActive: true,
                deletedAt: null
            });
            logQuery(this.entityName, 'getAvailableSlots', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'getAvailableSlots', {}, error as Error);
            throw error;
        }
    }

    /**
     * Find ad slots by placement (page + position)
     *
     * @param page - The page where slots are placed
     * @param position - The position within the page
     * @returns Array of ad slots matching the placement
     *
     * @example
     * ```ts
     * const slots = await model.findByPlacement('home', 'banner');
     * ```
     */
    async findByPlacement(page: string, position: string): Promise<AdSlot[]> {
        try {
            // Get all active slots and filter in memory
            const allSlots = await this.findAll({ isActive: true });
            const filtered = allSlots.items.filter(
                (slot) => slot.placement?.page === page && slot.placement?.position === position
            );
            logQuery(this.entityName, 'findByPlacement', { page, position }, filtered);
            return filtered;
        } catch (error) {
            logError(this.entityName, 'findByPlacement', { page, position }, error as Error);
            throw error;
        }
    }

    /**
     * Find ad slots by format type
     *
     * @param format - The format type (banner, square, etc.)
     * @returns Array of ad slots with the specified format
     *
     * @example
     * ```ts
     * const slots = await model.findByFormat('banner');
     * ```
     */
    async findByFormat(format: string): Promise<AdSlot[]> {
        try {
            // Get all active slots and filter in memory
            const allSlots = await this.findAll({ isActive: true });
            const filtered = allSlots.items.filter((slot) =>
                slot.format?.allowedFormats?.includes(
                    format as
                        | 'banner'
                        | 'square'
                        | 'rectangle'
                        | 'skyscraper'
                        | 'leaderboard'
                        | 'mobile_banner'
                )
            );
            logQuery(this.entityName, 'findByFormat', { format }, filtered);
            return filtered;
        } catch (error) {
            logError(this.entityName, 'findByFormat', { format }, error as Error);
            throw error;
        }
    }

    /**
     * Find ad slots by pricing model
     *
     * @param pricingModel - The pricing model (cpm, cpc, cpa, fixed_rate)
     * @returns Array of ad slots with the specified pricing model
     *
     * @example
     * ```ts
     * const slots = await model.findByPricingModel('cpm');
     * ```
     */
    async findByPricingModel(pricingModel: string): Promise<AdSlot[]> {
        try {
            // Get all active slots and filter in memory
            const allSlots = await this.findAll({ isActive: true });
            const filtered = allSlots.items.filter((slot) => slot.pricing?.model === pricingModel);
            logQuery(this.entityName, 'findByPricingModel', { pricingModel }, filtered);
            return filtered;
        } catch (error) {
            logError(this.entityName, 'findByPricingModel', { pricingModel }, error as Error);
            throw error;
        }
    }

    /**
     * Get top performing ad slots ordered by metrics
     *
     * @param limit - Number of top slots to return
     * @returns Array of top performing ad slots
     *
     * @example
     * ```ts
     * const topSlots = await model.getTopPerformingSlots(10);
     * ```
     */
    async getTopPerformingSlots(limit: number): Promise<AdSlot[]> {
        try {
            // Note: This is a simplified implementation
            // In production, you'd want to order by actual performance metrics
            const result = await this.findAll({ isActive: true }, { page: 1, pageSize: limit });
            logQuery(this.entityName, 'getTopPerformingSlots', { limit }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'getTopPerformingSlots', { limit }, error as Error);
            throw error;
        }
    }
}
