import type { CampaignChannelEnum } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { adPricingCatalog } from '../schemas/payment/adPricingCatalog.dbschema';
import { logError, logQuery } from '../utils/logger';

// Infer type from Drizzle schema
type AdPricingCatalog = typeof adPricingCatalog.$inferSelect;

/**
 * Ad Pricing Catalog Model
 *
 * Manages pricing catalogs for advertising slots with channel-specific pricing,
 * dynamic pricing models, and time-based rate structures.
 *
 * @extends BaseModel<AdPricingCatalog>
 */
export class AdPricingCatalogModel extends BaseModel<AdPricingCatalog> {
    protected table = adPricingCatalog;
    protected entityName = 'ad-pricing-catalog';

    protected getTableName(): string {
        return 'ad_pricing_catalogs';
    }

    /**
     * Find all pricing catalogs for a specific ad slot
     *
     * @param adSlotId - The ad slot ID to filter by
     * @returns Array of pricing catalogs
     *
     * @example
     * ```ts
     * const catalogs = await model.findByAdSlot('ad-slot-123');
     * ```
     */
    async findByAdSlot(adSlotId: string): Promise<AdPricingCatalog[]> {
        try {
            const result = await this.findAll({ adSlotId });
            logQuery(this.entityName, 'findByAdSlot', { adSlotId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByAdSlot', { adSlotId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all pricing catalogs by campaign channel (WEB, SOCIAL)
     *
     * @param channel - The campaign channel to filter by
     * @returns Array of pricing catalogs
     *
     * @example
     * ```ts
     * const webCatalogs = await model.findByChannel(CampaignChannelEnum.WEB);
     * ```
     */
    async findByChannel(channel: CampaignChannelEnum): Promise<AdPricingCatalog[]> {
        try {
            const result = await this.findAll({ channel });
            logQuery(this.entityName, 'findByChannel', { channel }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByChannel', { channel }, error as Error);
            throw error;
        }
    }

    /**
     * Find all active pricing catalogs
     *
     * @returns Array of active pricing catalogs
     *
     * @example
     * ```ts
     * const activeCatalogs = await model.findActive();
     * ```
     */
    async findActive(): Promise<AdPricingCatalog[]> {
        try {
            const result = await this.findAll({ isActive: 'true' });
            logQuery(this.entityName, 'findActive', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findActive', {}, error as Error);
            throw error;
        }
    }

    /**
     * Calculate price for a campaign based on catalog pricing and multipliers
     *
     * Applies dynamic pricing based on:
     * - Base price from catalog
     * - Weekend/holiday multipliers
     * - Impressions (for CPM model)
     * - Clicks (for CPC model)
     *
     * @param params - Pricing calculation parameters
     * @param params.catalogId - The pricing catalog ID
     * @param params.impressions - Number of impressions (for CPM)
     * @param params.clicks - Number of clicks (for CPC)
     * @param params.isWeekend - Whether pricing is for weekend
     * @param params.isHoliday - Whether pricing is for holiday
     * @returns Calculated price in USD
     *
     * @example
     * ```ts
     * const price = await model.calculatePrice({
     *   catalogId: 'catalog-123',
     *   impressions: 10000,
     *   isWeekend: true,
     *   isHoliday: false
     * });
     * ```
     */
    async calculatePrice(params: {
        catalogId: string;
        impressions?: number;
        clicks?: number;
        isWeekend?: boolean;
        isHoliday?: boolean;
    }): Promise<number> {
        try {
            const catalog = await this.findById(params.catalogId);
            if (!catalog) {
                throw new Error(`Pricing catalog not found: ${params.catalogId}`);
            }

            // Parse base price from string
            let basePrice = Number.parseFloat(catalog.basePrice);

            // Apply weekend multiplier
            if (params.isWeekend && catalog.weekendMultiplier) {
                const weekendMultiplier = Number.parseFloat(catalog.weekendMultiplier);
                basePrice *= weekendMultiplier;
            }

            // Apply holiday multiplier
            if (params.isHoliday && catalog.holidayMultiplier) {
                const holidayMultiplier = Number.parseFloat(catalog.holidayMultiplier);
                basePrice *= holidayMultiplier;
            }

            // Calculate based on pricing model
            let totalPrice = basePrice;

            if (catalog.pricingModel === 'CPM' && params.impressions) {
                // Cost Per Thousand Impressions
                totalPrice = (basePrice / 1000) * params.impressions;
            } else if (catalog.pricingModel === 'CPC' && params.clicks) {
                // Cost Per Click
                totalPrice = basePrice * params.clicks;
            }
            // For FLAT pricing, use base price as-is

            const result = Number.parseFloat(totalPrice.toFixed(2));
            logQuery(this.entityName, 'calculatePrice', params, { totalPrice: result });
            return result;
        } catch (error) {
            logError(this.entityName, 'calculatePrice', params, error as Error);
            throw error;
        }
    }
}
