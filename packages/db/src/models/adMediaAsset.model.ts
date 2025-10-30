import type { MediaAssetTypeEnum } from '@repo/schemas';
import { isNull } from 'drizzle-orm';
import { BaseModel } from '../base/base.model';
import { getDb } from '../client';
import type { AdMediaAsset } from '../schemas/campaign/adMediaAsset.dbschema';
import { adMediaAssets } from '../schemas/campaign/adMediaAsset.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Ad Media Asset Model
 *
 * Manages media assets used in advertising campaigns including images, videos,
 * and HTML content with validation, optimization, and performance tracking.
 *
 * @extends BaseModel<AdMediaAsset>
 */
export class AdMediaAssetModel extends BaseModel<AdMediaAsset> {
    protected table = adMediaAssets;
    protected entityName = 'ad-media-asset';

    protected getTableName(): string {
        return 'ad_media_assets';
    }

    /**
     * Find all ad media assets for a specific campaign
     *
     * @param campaignId - The campaign ID to filter by
     * @returns Array of ad media assets
     *
     * @example
     * ```ts
     * const assets = await model.findByCampaign('campaign-123');
     * ```
     */
    async findByCampaign(campaignId: string): Promise<AdMediaAsset[]> {
        try {
            const result = await this.findAll({ campaignId });
            logQuery(this.entityName, 'findByCampaign', { campaignId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByCampaign', { campaignId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all ad media assets by type (IMAGE, VIDEO, HTML)
     *
     * @param type - The media asset type to filter by
     * @returns Array of ad media assets
     *
     * @example
     * ```ts
     * const images = await model.findByType(MediaAssetTypeEnum.IMAGE);
     * ```
     */
    async findByType(type: MediaAssetTypeEnum): Promise<AdMediaAsset[]> {
        try {
            const result = await this.findAll({ type });
            logQuery(this.entityName, 'findByType', { type }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByType', { type }, error as Error);
            throw error;
        }
    }

    /**
     * Get assets by format specification
     *
     * Searches within the specs JSONB field for assets matching a specific format.
     * This is useful for finding all assets of a particular file type (e.g., 'jpeg', 'mp4').
     *
     * @param format - The format to search for within specs
     * @returns Array of matching ad media assets
     *
     * @example
     * ```ts
     * const jpegAssets = await model.getAssetsByFormat('jpeg');
     * ```
     */
    async getAssetsByFormat(format: string): Promise<AdMediaAsset[]> {
        try {
            const db = getDb();

            // Query assets where specs.format matches the provided format
            const assets = await db.select().from(this.table).where(isNull(this.table.deletedAt));

            // Filter in memory for JSONB field matching
            const filtered = assets.filter((asset) => {
                const specs = asset.specs as { format?: string };
                return specs?.format?.toLowerCase() === format.toLowerCase();
            });

            logQuery(this.entityName, 'getAssetsByFormat', { format }, filtered);
            return filtered as AdMediaAsset[];
        } catch (error) {
            logError(this.entityName, 'getAssetsByFormat', { format }, error as Error);
            throw error;
        }
    }
}
