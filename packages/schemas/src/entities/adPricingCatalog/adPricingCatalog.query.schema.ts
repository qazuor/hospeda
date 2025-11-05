import { z } from 'zod';
import { AdSlotIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { CampaignChannelSchema, PricingModelEnumSchema } from '../../enums/index.js';

/**
 * Ad Pricing Catalog Query Schema
 *
 * Schema for querying ad pricing catalog entries with various filters, pagination, and sorting options.
 */
export const AdPricingCatalogQuerySchema = z.object({
    // Ad slot filter
    adSlotId: AdSlotIdSchema.optional(),

    // Channel filter
    channel: z.union([CampaignChannelSchema, z.array(CampaignChannelSchema)]).optional(),

    // Pricing model filter
    pricingModel: z.union([PricingModelEnumSchema, z.array(PricingModelEnumSchema)]).optional(),

    // Status filter
    isActive: z.boolean().optional(),

    // Currency filter
    currency: z
        .string()
        .min(3, { message: 'zodError.adPricingCatalog.query.currency.min' })
        .max(3, { message: 'zodError.adPricingCatalog.query.currency.max' })
        .optional(),

    // Base price range filters
    basePriceMin: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.query.basePriceMin.positive' })
        .optional(),

    basePriceMax: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.query.basePriceMax.positive' })
        .optional(),

    // Budget range filters
    minimumBudgetMin: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.query.minimumBudgetMin.positive' })
        .optional(),

    minimumBudgetMax: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.query.minimumBudgetMax.positive' })
        .optional(),

    maximumBudgetMin: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.query.maximumBudgetMin.positive' })
        .optional(),

    maximumBudgetMax: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.query.maximumBudgetMax.positive' })
        .optional(),

    // Availability date range filters
    availableFrom: z.coerce
        .date({
            message: 'zodError.adPricingCatalog.query.availableFrom.invalid'
        })
        .optional(),

    availableUntil: z.coerce
        .date({
            message: 'zodError.adPricingCatalog.query.availableUntil.invalid'
        })
        .optional(),

    // Description search (partial match)
    description: z
        .string()
        .min(1, { message: 'zodError.adPricingCatalog.query.description.min' })
        .optional(),

    // Pagination and sorting
    ...PaginationSchema.shape,
    ...SortingSchema.extend({
        sortBy: z
            .enum([
                'basePrice',
                'channel',
                'pricingModel',
                'dailyRate',
                'weeklyRate',
                'monthlyRate',
                'minimumBudget',
                'maximumBudget',
                'availableFrom',
                'availableUntil',
                'isActive',
                'createdAt',
                'updatedAt'
            ])
            .default('createdAt')
    }).shape
});

/**
 * Ad Pricing Catalog Search Schema
 *
 * Schema for full-text search across ad pricing catalog entries with optional filters.
 */
export const AdPricingCatalogSearchSchema = AdPricingCatalogQuerySchema.extend({
    // Text search query
    q: z
        .string()
        .min(2, { message: 'zodError.adPricingCatalog.search.query.min' })
        .max(200, { message: 'zodError.adPricingCatalog.search.query.max' })
        .optional()
});

/**
 * Type exports for Ad Pricing Catalog query operations
 */
export type AdPricingCatalogQuery = z.infer<typeof AdPricingCatalogQuerySchema>;
export type AdPricingCatalogSearch = z.infer<typeof AdPricingCatalogSearchSchema>;
