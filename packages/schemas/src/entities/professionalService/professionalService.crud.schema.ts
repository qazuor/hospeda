import { z } from 'zod';
import { ProfessionalServiceCategorySchema } from '../../enums/index.js';
import { ProfessionalServiceSchema } from './professionalService.schema.js';

/**
 * Create Professional Service Schema
 *
 * Schema for creating new professional services.
 * Excludes auto-generated fields and includes optional defaults.
 */
export const CreateProfessionalServiceSchema = ProfessionalServiceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    // Make category required on creation
    category: ProfessionalServiceCategorySchema,

    // Allow partial pricing that will be validated
    defaultPricing: z
        .object({
            basePrice: z
                .number()
                .positive({ message: 'zodError.professionalService.basePrice.mustBePositive' }),
            currency: z.string().length(3).default('USD'),
            billingUnit: z.enum(['hour', 'day', 'project', 'month']).default('project'),
            minOrderValue: z.number().min(0).optional(),
            maxOrderValue: z.number().positive().optional()
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

export type CreateProfessionalService = z.infer<typeof CreateProfessionalServiceSchema>;

/**
 * Update Professional Service Schema
 *
 * Schema for updating existing professional services.
 * All fields are optional except those with business constraints.
 */
export const UpdateProfessionalServiceSchema = z.object({
    name: z
        .string()
        .min(3, { message: 'zodError.professionalService.name.tooShort' })
        .max(200, { message: 'zodError.professionalService.name.tooLong' })
        .optional(),

    description: z
        .string()
        .min(10, { message: 'zodError.professionalService.description.tooShort' })
        .max(2000, { message: 'zodError.professionalService.description.tooLong' })
        .optional(),

    category: ProfessionalServiceCategorySchema.optional(),

    defaultPricing: z
        .object({
            basePrice: z
                .number()
                .positive({ message: 'zodError.professionalService.basePrice.mustBePositive' })
                .optional(),
            currency: z.string().length(3).optional(),
            billingUnit: z.enum(['hour', 'day', 'project', 'month']).optional(),
            minOrderValue: z.number().min(0).optional(),
            maxOrderValue: z.number().positive().optional()
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

    isActive: z.boolean().optional(),

    adminInfo: z.record(z.string(), z.unknown()).optional()
});

export type UpdateProfessionalService = z.infer<typeof UpdateProfessionalServiceSchema>;

/**
 * Update Professional Service Status Schema
 *
 * Specialized schema for updating service availability status.
 */
export const UpdateProfessionalServiceStatusSchema = z.object({
    isActive: z.boolean(),
    adminInfo: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional admin notes about the status change')
});

export type UpdateProfessionalServiceStatus = z.infer<typeof UpdateProfessionalServiceStatusSchema>;

/**
 * Update Professional Service Pricing Schema
 *
 * Specialized schema for updating service pricing information.
 */
export const UpdateProfessionalServicePricingSchema = z.object({
    defaultPricing: z
        .object({
            basePrice: z
                .number()
                .positive({ message: 'zodError.professionalService.basePrice.mustBePositive' })
                .optional(),
            currency: z.string().length(3).optional(),
            billingUnit: z.enum(['hour', 'day', 'project', 'month']).optional(),
            minOrderValue: z.number().min(0).optional(),
            maxOrderValue: z.number().positive().optional()
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

    adminInfo: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional admin notes about the pricing change')
});

export type UpdateProfessionalServicePricing = z.infer<
    typeof UpdateProfessionalServicePricingSchema
>;
