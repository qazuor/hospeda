/**
 * Update Ad Media Asset Schema
 *
 * Schema for updating existing advertising media assets.
 * All fields are optional, omits immutable fields.
 *
 * @module UpdateAdMediaAssetSchema
 */

import type { z } from 'zod';
import { AdMediaAssetSchema } from './adMediaAsset.schema.js';

/**
 * Schema for updating an ad media asset
 * Omits: id, createdAt, createdById (immutable fields)
 * Makes all other fields optional
 */
export const UpdateAdMediaAssetSchema = AdMediaAssetSchema.omit({
    id: true,
    createdAt: true,
    createdById: true
}).partial();

export type UpdateAdMediaAsset = z.infer<typeof UpdateAdMediaAssetSchema>;
