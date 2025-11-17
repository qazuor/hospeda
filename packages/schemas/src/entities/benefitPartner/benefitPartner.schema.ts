import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BenefitPartnerIdSchema, ClientIdSchema } from '../../common/id.schema.js';
import { BenefitCategorySchema } from '../../enums/benefit-category.schema.js';

/**
 * BenefitPartner Schema - Partner organizations that provide benefits
 *
 * Partners offer various benefits (discounts, perks) to accommodation clients
 * through benefit listings that are linked to accommodation listing plans.
 */
export const BenefitPartnerSchema = z.object({
    // Base fields
    id: BenefitPartnerIdSchema,
    ...BaseAuditFields,

    // Partner information
    name: z
        .string({ message: 'zodError.benefitPartner.name.required' })
        .min(1, { message: 'zodError.benefitPartner.name.min' })
        .max(255, { message: 'zodError.benefitPartner.name.max' }),

    category: BenefitCategorySchema,

    description: z
        .string()
        .max(1000, { message: 'zodError.benefitPartner.description.max' })
        .optional(),

    contactInfo: z
        .string()
        .max(500, { message: 'zodError.benefitPartner.contactInfo.max' })
        .optional(),

    // Owner relationship
    clientId: ClientIdSchema,

    // Admin metadata
    ...BaseAdminFields
});

export type BenefitPartner = z.infer<typeof BenefitPartnerSchema>;
