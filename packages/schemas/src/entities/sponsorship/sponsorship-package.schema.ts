import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SponsorshipLevelIdSchema, SponsorshipPackageIdSchema } from '../../common/id.schema.js';

/**
 * Sponsorship Package entity schema
 */
export const SponsorshipPackageSchema = z.object({
    id: SponsorshipPackageIdSchema,
    ...BaseAuditFields,

    slug: z
        .string({
            message: 'zodError.sponsorshipPackage.slug.required'
        })
        .min(1, { message: 'zodError.sponsorshipPackage.slug.min' }),

    name: z
        .string({
            message: 'zodError.sponsorshipPackage.name.required'
        })
        .min(1, { message: 'zodError.sponsorshipPackage.name.min' })
        .max(100, { message: 'zodError.sponsorshipPackage.name.max' }),

    description: z
        .string()
        .max(500, { message: 'zodError.sponsorshipPackage.description.max' })
        .optional()
        .nullable(),

    priceAmount: z
        .number({
            message: 'zodError.sponsorshipPackage.priceAmount.required'
        })
        .int({ message: 'zodError.sponsorshipPackage.priceAmount.int' })
        .min(0, { message: 'zodError.sponsorshipPackage.priceAmount.min' }),

    priceCurrency: z
        .string({
            message: 'zodError.sponsorshipPackage.priceCurrency.required'
        })
        .default('ARS'),

    includedPosts: z
        .number({
            message: 'zodError.sponsorshipPackage.includedPosts.required'
        })
        .int({ message: 'zodError.sponsorshipPackage.includedPosts.int' })
        .min(0, { message: 'zodError.sponsorshipPackage.includedPosts.min' }),

    includedEvents: z
        .number({
            message: 'zodError.sponsorshipPackage.includedEvents.required'
        })
        .int({ message: 'zodError.sponsorshipPackage.includedEvents.int' })
        .min(0, { message: 'zodError.sponsorshipPackage.includedEvents.min' }),

    eventLevelId: SponsorshipLevelIdSchema.nullable().optional(),

    isActive: z.boolean().default(true),

    sortOrder: z.number().int({ message: 'zodError.sponsorshipPackage.sortOrder.int' }).default(0)
});
export type SponsorshipPackage = z.infer<typeof SponsorshipPackageSchema>;

/**
 * Create input for sponsorship package
 */
export const SponsorshipPackageCreateInputSchema = SponsorshipPackageSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).extend({
    slug: z
        .string({
            message: 'zodError.sponsorshipPackage.slug.required'
        })
        .min(1, { message: 'zodError.sponsorshipPackage.slug.min' })
        .optional()
});
export type SponsorshipPackageCreateInput = z.infer<typeof SponsorshipPackageCreateInputSchema>;

/**
 * Update input for sponsorship package
 */
export const SponsorshipPackageUpdateInputSchema = SponsorshipPackageCreateInputSchema.partial();
export type SponsorshipPackageUpdateInput = z.infer<typeof SponsorshipPackageUpdateInputSchema>;

/**
 * Search input for sponsorship packages
 */
export const SponsorshipPackageSearchSchema = z.object({
    isActive: z.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type SponsorshipPackageSearchInput = z.infer<typeof SponsorshipPackageSearchSchema>;
