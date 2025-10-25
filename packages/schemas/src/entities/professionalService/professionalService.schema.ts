import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ProfessionalServiceIdSchema } from '../../common/id.schema.js';
import { ProfessionalServiceCategorySchema } from '../../enums/index.js';

/**
 * Professional Service Schema
 *
 * Defines professional services offered to accommodation hosts and clients.
 * Includes service categorization, pricing models, and availability status.
 * Maps to PROFESSIONAL_SERVICE_TYPE in the database diagram.
 */
export const ProfessionalServiceSchema = z.object({
    // Base fields
    id: ProfessionalServiceIdSchema,
    ...BaseAuditFields,

    // Basic service information
    name: z
        .string()
        .min(3, { message: 'zodError.professionalService.name.tooShort' })
        .max(200, { message: 'zodError.professionalService.name.tooLong' })
        .describe('Professional service name'),

    description: z
        .string()
        .min(10, { message: 'zodError.professionalService.description.tooShort' })
        .max(2000, { message: 'zodError.professionalService.description.tooLong' })
        .describe('Detailed service description'),

    // Service categorization
    category: ProfessionalServiceCategorySchema.describe('Service category'),

    // Pricing information
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
        .describe('Default pricing structure for the service'),

    // Service availability and status
    isActive: z
        .boolean()
        .default(true)
        .describe('Whether the service is currently available for booking'),

    // Additional metadata
    adminInfo: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Administrative information and internal notes')
});

export type ProfessionalService = z.infer<typeof ProfessionalServiceSchema>;

/**
 * Professional Service Schema without admin fields
 * Used for public API responses
 */
export const PublicProfessionalServiceSchema = ProfessionalServiceSchema.omit({
    adminInfo: true,
    deletedAt: true,
    deletedById: true
});

export type PublicProfessionalService = z.infer<typeof PublicProfessionalServiceSchema>;
