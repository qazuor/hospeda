/**
 * Search Ad Media Asset Schema
 *
 * Schema for searching and filtering advertising media assets.
 *
 * @module SearchAdMediaAssetSchema
 */

import { z } from 'zod';
import { MediaAssetTypeSchema } from '../../enums/media-asset-type.schema.js';

/**
 * Schema for searching ad media assets
 * Supports filtering by campaign, type, and format
 */
export const SearchAdMediaAssetSchema = z.object({
    campaignId: z.string().uuid().optional(),
    type: MediaAssetTypeSchema.optional(),
    format: z.string().optional(),
    status: z
        .enum(['draft', 'processing', 'approved', 'active', 'inactive', 'archived', 'rejected'])
        .optional()
});

export type SearchAdMediaAsset = z.infer<typeof SearchAdMediaAssetSchema>;
