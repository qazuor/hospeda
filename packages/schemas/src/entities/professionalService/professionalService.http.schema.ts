import { z } from 'zod';
import {
    CreateProfessionalServiceSchema,
    UpdateProfessionalServicePricingSchema,
    UpdateProfessionalServiceSchema,
    UpdateProfessionalServiceStatusSchema
} from './professionalService.crud.schema.js';
import {
    BulkProfessionalServiceOperationSchema,
    ProfessionalServiceAnalyticsSchema,
    SearchProfessionalServicesSchema
} from './professionalService.query.schema.js';

/**
 * HTTP Create Professional Service Schema
 *
 * Schema for HTTP requests to create professional services.
 * Includes proper coercion and validation for web forms.
 */
export const HttpCreateProfessionalServiceSchema = CreateProfessionalServiceSchema.extend({
    // Coerce pricing values from strings
    defaultPricing: z
        .object({
            basePrice: z.coerce
                .number()
                .positive({ message: 'zodError.professionalService.basePrice.mustBePositive' }),
            currency: z.string().length(3).default('USD'),
            billingUnit: z.enum(['hour', 'day', 'project', 'month']).default('project'),
            minOrderValue: z.coerce.number().min(0).optional(),
            maxOrderValue: z.coerce.number().positive().optional()
        })
        .refine(
            (data) =>
                !data.maxOrderValue ||
                !data.minOrderValue ||
                data.minOrderValue <= data.maxOrderValue,
            {
                message: 'zodError.professionalService.pricing.invalidRange'
            }
        ),

    // Coerce boolean values
    isActive: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .default(true)
});

export type HttpCreateProfessionalService = z.infer<typeof HttpCreateProfessionalServiceSchema>;

/**
 * HTTP Update Professional Service Schema
 *
 * Schema for HTTP requests to update professional services.
 */
export const HttpUpdateProfessionalServiceSchema = UpdateProfessionalServiceSchema.extend({
    // Coerce pricing values from strings
    defaultPricing: z
        .object({
            basePrice: z.coerce
                .number()
                .positive({ message: 'zodError.professionalService.basePrice.mustBePositive' })
                .optional(),
            currency: z.string().length(3).optional(),
            billingUnit: z.enum(['hour', 'day', 'project', 'month']).optional(),
            minOrderValue: z.coerce.number().min(0).optional(),
            maxOrderValue: z.coerce.number().positive().optional()
        })
        .refine(
            (data) =>
                !data.maxOrderValue ||
                !data.minOrderValue ||
                data.minOrderValue <= data.maxOrderValue,
            {
                message: 'zodError.professionalService.pricing.invalidRange'
            }
        )
        .optional(),

    // Coerce boolean values
    isActive: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .optional()
});

export type HttpUpdateProfessionalService = z.infer<typeof HttpUpdateProfessionalServiceSchema>;

/**
 * HTTP Update Professional Service Status Schema
 *
 * Schema for HTTP requests to update service status.
 */
export const HttpUpdateProfessionalServiceStatusSchema =
    UpdateProfessionalServiceStatusSchema.extend({
        // Coerce boolean values
        isActive: z.union([z.boolean(), z.string()]).transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
    });

export type HttpUpdateProfessionalServiceStatus = z.infer<
    typeof HttpUpdateProfessionalServiceStatusSchema
>;

/**
 * HTTP Update Professional Service Pricing Schema
 *
 * Schema for HTTP requests to update service pricing.
 */
export const HttpUpdateProfessionalServicePricingSchema =
    UpdateProfessionalServicePricingSchema.extend({
        // Coerce pricing values from strings
        defaultPricing: z
            .object({
                basePrice: z.coerce
                    .number()
                    .positive({ message: 'zodError.professionalService.basePrice.mustBePositive' })
                    .optional(),
                currency: z.string().length(3).optional(),
                billingUnit: z.enum(['hour', 'day', 'project', 'month']).optional(),
                minOrderValue: z.coerce.number().min(0).optional(),
                maxOrderValue: z.coerce.number().positive().optional()
            })
            .refine(
                (data) =>
                    !data.maxOrderValue ||
                    !data.minOrderValue ||
                    data.minOrderValue <= data.maxOrderValue,
                {
                    message: 'zodError.professionalService.pricing.invalidRange'
                }
            )
    });

export type HttpUpdateProfessionalServicePricing = z.infer<
    typeof HttpUpdateProfessionalServicePricingSchema
>;

/**
 * HTTP Search Professional Services Schema
 *
 * Schema for HTTP requests to search professional services.
 */
export const HttpSearchProfessionalServicesSchema = SearchProfessionalServicesSchema.extend({
    // Coerce numeric values
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().positive().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // Coerce boolean values
    isActive: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .optional(),

    // Parse arrays from query strings
    categories: z
        .union([
            z.array(z.string()),
            z.string().transform((str) => str.split(',').map((s) => s.trim()))
        ])
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const categories = Array.isArray(val) ? val : [val];
            return categories.filter((c) =>
                [
                    'PHOTO',
                    'COPYWRITING',
                    'SEO',
                    'DESIGN',
                    'MAINTENANCE',
                    'TOUR',
                    'BIKE_RENTAL',
                    'OTHER'
                ].includes(c)
            );
        })
});

export type HttpSearchProfessionalServices = z.infer<typeof HttpSearchProfessionalServicesSchema>;

/**
 * HTTP Professional Service Analytics Schema
 *
 * Schema for HTTP requests for analytics.
 */
export const HttpProfessionalServiceAnalyticsSchema = ProfessionalServiceAnalyticsSchema.extend({
    // Parse arrays from query strings
    includeMetrics: z
        .union([
            z.array(z.string()),
            z.string().transform((str) => str.split(',').map((s) => s.trim()))
        ])
        .optional()
        .transform((val) => {
            if (!val) return ['orders', 'revenue'];
            const metrics = Array.isArray(val) ? val : [val];
            return metrics.filter((m) =>
                ['orders', 'revenue', 'avgOrderValue', 'popularServices'].includes(m)
            );
        })
});

export type HttpProfessionalServiceAnalytics = z.infer<
    typeof HttpProfessionalServiceAnalyticsSchema
>;

/**
 * HTTP Bulk Professional Service Operation Schema
 *
 * Schema for HTTP requests for bulk operations.
 */
export const HttpBulkProfessionalServiceOperationSchema =
    BulkProfessionalServiceOperationSchema.extend({
        // Parse array from comma-separated string
        serviceIds: z
            .union([
                z.array(z.string().uuid()),
                z.string().transform((str) =>
                    str
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                )
            ])
            .transform((val) => (Array.isArray(val) ? val : [val]))
            .refine((ids) => ids.length >= 1 && ids.length <= 100, {
                message: 'zodError.professionalService.bulk.invalidCount'
            }),

        // Coerce boolean and numeric values in data
        data: z
            .object({
                isActive: z
                    .union([z.boolean(), z.string()])
                    .transform((val) => {
                        if (typeof val === 'string') {
                            return val.toLowerCase() === 'true' || val === '1';
                        }
                        return val;
                    })
                    .optional(),
                category: z.string().optional(),
                pricingMultiplier: z.coerce.number().positive().max(10).optional(),
                adminInfo: z.record(z.string(), z.unknown()).optional()
            })
            .optional()
    });

export type HttpBulkProfessionalServiceOperation = z.infer<
    typeof HttpBulkProfessionalServiceOperationSchema
>;
