import { BaseModel } from '../base/base.model';
import type { AdSlot } from '../schemas/campaign/adSlot.dbschema';
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
}
