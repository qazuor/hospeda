import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';

/**
 * PricingTier ID schema for UUID validation
 */
export const PricingTierIdSchema = z.string().uuid({
    message: 'zodError.pricingTier.id.invalidUuid'
});

export type PricingTierId = z.infer<typeof PricingTierIdSchema>;

/**
 * PricingTier Core Schema
 *
 * Defines tiered pricing structure for PricingPlans.
 * Supports quantity-based pricing with ranges and unit prices.
 *
 * Business Rules:
 * - Quantity ranges must not overlap within same pricing plan
 * - minQuantity must be >= 1
 * - maxQuantity must be null (unlimited) or > minQuantity
 * - unitPriceMinor must be > 0 (price in smallest currency unit)
 * - Each tier belongs to exactly one pricing plan
 */
export const PricingTierSchema = z
    .object({
        id: PricingTierIdSchema,
        ...BaseAuditFields,
        ...BaseLifecycleFields,
        ...BaseAdminFields,

        /** Foreign key to the parent pricing plan */
        pricingPlanId: z.string().uuid('pricingPlanId must be a valid UUID'),

        /** Minimum quantity for this pricing tier (inclusive) */
        minQuantity: z.number().int().min(1, 'minQuantity must be at least 1'),

        /** Maximum quantity for this pricing tier (inclusive, null for unlimited) */
        maxQuantity: z.number().int().positive('maxQuantity must be positive').nullable(),

        /** Unit price in minor currency units (e.g., cents for USD) */
        unitPriceMinor: z.bigint().positive('unitPriceMinor must be positive')
    })
    .refine(
        (data: { maxQuantity: number | null; minQuantity: number }) =>
            data.maxQuantity === null || data.maxQuantity > data.minQuantity,
        {
            message: 'maxQuantity must be greater than minQuantity when specified',
            path: ['maxQuantity']
        }
    );

export type PricingTier = z.infer<typeof PricingTierSchema>;

/**
 * Schema for validating quantity ranges don't overlap
 * Used internally for business rule validation
 */
export const PricingTierRangeValidationSchema = z
    .object({
        pricingPlanId: z.string().uuid(),
        tiers: z
            .array(
                z.object({
                    id: z.string().uuid().optional(),
                    minQuantity: z.number().int().min(1),
                    maxQuantity: z.number().int().positive().nullable()
                })
            )
            .min(1, 'At least one tier is required')
    })
    .refine(
        (data: { tiers: Array<{ minQuantity: number; maxQuantity: number | null }> }) => {
            const sortedTiers = [...data.tiers].sort((a, b) => a.minQuantity - b.minQuantity);

            for (let i = 0; i < sortedTiers.length - 1; i++) {
                const current = sortedTiers[i];
                const next = sortedTiers[i + 1];

                // Safety check for array access
                if (!current || !next) {
                    return false;
                }

                // If current tier has no max (unlimited), it must be the last tier
                if (current.maxQuantity === null && i < sortedTiers.length - 1) {
                    return false;
                }

                // Check for overlap: current max >= next min
                if (current.maxQuantity !== null && current.maxQuantity >= next.minQuantity) {
                    return false;
                }
            }

            return true;
        },
        {
            message:
                'Pricing tier quantity ranges must not overlap and unlimited tiers must be last',
            path: ['tiers']
        }
    );

export type PricingTierRangeValidation = z.infer<typeof PricingTierRangeValidationSchema>;
