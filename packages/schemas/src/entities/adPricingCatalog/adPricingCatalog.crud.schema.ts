import { z } from 'zod';
import { PricingModelEnum } from '../../enums/index.js';
import { AdPricingCatalogSchema } from './adPricingCatalog.schema.js';

/**
 * Create Ad Pricing Catalog Schema
 *
 * Schema for creating new ad pricing catalog entries. Excludes auto-generated fields
 * and provides sensible defaults for certain fields.
 */
export const CreateAdPricingCatalogSchema = AdPricingCatalogSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    // Default currency to USD if not provided
    currency: AdPricingCatalogSchema.shape.currency.default('USD'),
    // Default pricing model to CPM if not provided
    pricingModel: AdPricingCatalogSchema.shape.pricingModel.default(PricingModelEnum.CPM),
    // Default isActive to true if not provided
    isActive: AdPricingCatalogSchema.shape.isActive.default(true),
    // Default multipliers to 1.0 if not provided
    weekendMultiplier: AdPricingCatalogSchema.shape.weekendMultiplier.default(1.0),
    holidayMultiplier: AdPricingCatalogSchema.shape.holidayMultiplier.default(1.0)
});

/**
 * Update Ad Pricing Catalog Schema
 *
 * Schema for updating existing ad pricing catalog entries. All fields are optional
 * to support partial updates, except adSlotId which cannot be changed.
 */
export const UpdateAdPricingCatalogSchema = AdPricingCatalogSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    adSlotId: true // Cannot update ad slot association
}).partial();

/**
 * Delete Ad Pricing Catalog Schema
 *
 * Schema for soft-deleting ad pricing catalog entries with optional reason and metadata.
 */
export const DeleteAdPricingCatalogSchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.adPricingCatalog.deleteReason.min' })
        .max(500, { message: 'zodError.adPricingCatalog.deleteReason.max' })
        .optional(),

    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type exports for Ad Pricing Catalog CRUD operations
 */
export type CreateAdPricingCatalog = z.infer<typeof CreateAdPricingCatalogSchema>;
export type UpdateAdPricingCatalog = z.infer<typeof UpdateAdPricingCatalogSchema>;
export type DeleteAdPricingCatalog = z.infer<typeof DeleteAdPricingCatalogSchema>;
