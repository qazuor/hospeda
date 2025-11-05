/**
 * AdMediaAsset Entity Schemas
 *
 * Schema package for advertising media asset management including
 * images, videos, and HTML content used in campaigns.
 *
 * @module AdMediaAssetSchemas
 */

// Core ad media asset schema
export { AdMediaAssetSchema } from './adMediaAsset.schema.js';
export type { AdMediaAsset } from './adMediaAsset.schema.js';

// Create schema
export { CreateAdMediaAssetSchema } from './create.schema.js';
export type { CreateAdMediaAsset } from './create.schema.js';

// Update schema
export { UpdateAdMediaAssetSchema } from './update.schema.js';
export type { UpdateAdMediaAsset } from './update.schema.js';

// Search schema
export { SearchAdMediaAssetSchema } from './search.schema.js';
export type { SearchAdMediaAsset } from './search.schema.js';
