/**
 * Create Ad Media Asset Schema
 *
 * Schema for creating new advertising media assets.
 * Omits auto-generated fields (id, audit fields).
 *
 * @module CreateAdMediaAssetSchema
 */

import type { z } from 'zod';
import { AdMediaAssetSchema } from './adMediaAsset.schema.js';

/**
 * Schema for creating a new ad media asset
 * Omits: id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById
 */
export const CreateAdMediaAssetSchema = AdMediaAssetSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
});

export type CreateAdMediaAsset = z.infer<typeof CreateAdMediaAssetSchema>;
