import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    ClientIdSchema,
    DiscountCodeIdSchema,
    DiscountCodeUsageIdSchema
} from '../../common/id.schema.js';

/**
 * Discount Code Usage Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a DiscountCodeUsage entity
 * representing usage tracking for discount codes by clients.
 */
export const DiscountCodeUsageSchema = z
    .object({
        // Base fields
        id: DiscountCodeUsageIdSchema,
        ...BaseAuditFields,

        // Usage-specific core fields
        discountCodeId: DiscountCodeIdSchema,
        clientId: ClientIdSchema,

        // Usage tracking
        usageCount: z
            .number({
                message: 'zodError.discountCodeUsage.usageCount.required'
            })
            .int({ message: 'zodError.discountCodeUsage.usageCount.int' })
            .positive({ message: 'zodError.discountCodeUsage.usageCount.positive' }),

        // Timestamps for usage tracking
        firstUsedAt: z.date({
            message: 'zodError.discountCodeUsage.firstUsedAt.required'
        }),

        lastUsedAt: z.date({
            message: 'zodError.discountCodeUsage.lastUsedAt.required'
        })
    })
    // Usage date validation
    .refine(
        (data) => {
            return data.firstUsedAt <= data.lastUsedAt;
        },
        {
            message: 'zodError.discountCodeUsage.usageDates.invalid',
            path: ['lastUsedAt']
        }
    );

export type DiscountCodeUsage = z.infer<typeof DiscountCodeUsageSchema>;
