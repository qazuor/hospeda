import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ProductIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BillingIntervalEnumSchema } from '../../enums/billing-interval.schema.js';
import { BillingSchemeEnum } from '../../enums/billing-scheme.enum.js';
import { BillingSchemeEnumSchema } from '../../enums/billing-scheme.schema.js';
import { numericField } from '../../utils/index.js';

/**
 * PricingPlan ID schema for UUID validation
 */
export const PricingPlanIdSchema = z.string().uuid({
    message: 'zodError.pricingPlan.id.invalidUuid'
});

export type PricingPlanId = z.infer<typeof PricingPlanIdSchema>;

/**
 * Core pricing plan schema with conditional interval validation
 * Follows the accommodation pattern for architectural consistency
 */
export const PricingPlanSchema = z
    .object({
        id: PricingPlanIdSchema,
        productId: ProductIdSchema,
        billingScheme: BillingSchemeEnumSchema,
        interval: BillingIntervalEnumSchema.optional(),
        amount: numericField(
            z
                .number({ message: 'zodError.pricingPlan.amount.required' })
                .nonnegative({ message: 'zodError.pricingPlan.amount.nonnegative' })
        ),
        currency: z
            .string()
            .length(3, { message: 'zodError.pricingPlan.currency.length' })
            .regex(/^[A-Z]{3}$/, { message: 'zodError.pricingPlan.currency.format' }),

        // Base field groups following product pattern
        ...BaseAuditFields,
        ...BaseLifecycleFields,
        ...BaseAdminFields,

        // Status fields
        isActive: z.boolean().default(true),
        isDeleted: z.boolean().default(false)
    })
    .refine(
        (data) => {
            // Conditional validation: interval required for RECURRING, forbidden for ONE_TIME
            if (data.billingScheme === BillingSchemeEnum.RECURRING) {
                return data.interval !== undefined;
            }
            if (data.billingScheme === BillingSchemeEnum.ONE_TIME) {
                return data.interval === undefined;
            }
            return true;
        },
        {
            message: 'Interval is required for RECURRING billing scheme and forbidden for ONE_TIME',
            path: ['interval']
        }
    );

export type PricingPlan = z.infer<typeof PricingPlanSchema>;
