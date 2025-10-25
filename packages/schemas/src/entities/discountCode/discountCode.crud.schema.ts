import { z } from 'zod';
import { PromotionIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { DiscountTypeEnumSchema } from '../../enums/index.js';

/**
 * Create Discount Code Schema
 * Schema for creating new discount codes with type-specific validation
 */
export const CreateDiscountCodeSchema = z
    .object({
        // Audit fields for creation
        createdById: UserIdSchema,

        // Optional promotion association
        promotionId: PromotionIdSchema.optional(),

        // Code identifier
        code: z
            .string({
                message: 'zodError.discountCode.code.required'
            })
            .min(1, { message: 'zodError.discountCode.code.min' })
            .max(50, { message: 'zodError.discountCode.code.max' })
            .regex(/^[A-Z0-9_-]+$/, {
                message: 'zodError.discountCode.code.format'
            }),

        // Discount type and value
        discountType: DiscountTypeEnumSchema,

        // Percentage off (only for PERCENTAGE type)
        percentOff: z
            .number({
                message: 'zodError.discountCode.percentOff.required'
            })
            .min(0, { message: 'zodError.discountCode.percentOff.min' })
            .max(100, { message: 'zodError.discountCode.percentOff.max' })
            .optional(),

        // Fixed amount off in minor currency units (only for FIXED_AMOUNT type)
        amountOffMinor: z
            .number({
                message: 'zodError.discountCode.amountOffMinor.required'
            })
            .int({ message: 'zodError.discountCode.amountOffMinor.int' })
            .nonnegative({ message: 'zodError.discountCode.amountOffMinor.nonnegative' })
            .optional(),

        // Validity period
        validFrom: z.date({
            message: 'zodError.discountCode.validFrom.required'
        }),

        validTo: z.date({
            message: 'zodError.discountCode.validTo.required'
        }),

        // Usage limits
        maxRedemptionsGlobal: z
            .number({
                message: 'zodError.discountCode.maxRedemptionsGlobal.required'
            })
            .int({ message: 'zodError.discountCode.maxRedemptionsGlobal.int' })
            .positive({ message: 'zodError.discountCode.maxRedemptionsGlobal.positive' })
            .optional(),

        maxRedemptionsPerUser: z
            .number({
                message: 'zodError.discountCode.maxRedemptionsPerUser.required'
            })
            .int({ message: 'zodError.discountCode.maxRedemptionsPerUser.int' })
            .positive({ message: 'zodError.discountCode.maxRedemptionsPerUser.positive' })
            .optional()
    })
    // Type-specific validation refinement
    .refine(
        (data) => {
            // PERCENTAGE type must have percentOff and not amountOffMinor
            if (data.discountType === 'percentage') {
                return data.percentOff !== undefined && data.amountOffMinor === undefined;
            }
            // FIXED_AMOUNT type must have amountOffMinor and not percentOff
            if (data.discountType === 'fixed_amount') {
                return data.amountOffMinor !== undefined && data.percentOff === undefined;
            }
            return false;
        },
        {
            message: 'zodError.discountCode.typeSpecificFields.invalid'
        }
    )
    // Date validation refinement
    .refine(
        (data) => {
            return data.validFrom < data.validTo;
        },
        {
            message: 'zodError.discountCode.validDates.invalidRange',
            path: ['validTo']
        }
    )
    // Usage limits validation
    .refine(
        (data) => {
            if (data.maxRedemptionsGlobal && data.maxRedemptionsPerUser) {
                return data.maxRedemptionsPerUser <= data.maxRedemptionsGlobal;
            }
            return true;
        },
        {
            message: 'zodError.discountCode.usageLimits.perUserExceedsGlobal',
            path: ['maxRedemptionsPerUser']
        }
    );

/**
 * Update Discount Code Schema
 * Schema for updating existing discount codes
 */
export const UpdateDiscountCodeSchema = z
    .object({
        // Audit fields for updates
        updatedById: UserIdSchema,

        // Optional promotion association
        promotionId: PromotionIdSchema.optional(),

        // Code identifier (can be updated)
        code: z
            .string()
            .min(1, { message: 'zodError.discountCode.code.min' })
            .max(50, { message: 'zodError.discountCode.code.max' })
            .regex(/^[A-Z0-9_-]+$/, {
                message: 'zodError.discountCode.code.format'
            })
            .optional(),

        // Discount type and value (conditional updates)
        discountType: DiscountTypeEnumSchema.optional(),
        percentOff: z
            .number()
            .min(0, { message: 'zodError.discountCode.percentOff.min' })
            .max(100, { message: 'zodError.discountCode.percentOff.max' })
            .optional(),
        amountOffMinor: z
            .number()
            .int({ message: 'zodError.discountCode.amountOffMinor.int' })
            .nonnegative({ message: 'zodError.discountCode.amountOffMinor.nonnegative' })
            .optional(),

        // Validity period (can be extended)
        validFrom: z.date().optional(),
        validTo: z.date().optional(),

        // Usage limits (can be adjusted)
        maxRedemptionsGlobal: z
            .number()
            .int({ message: 'zodError.discountCode.maxRedemptionsGlobal.int' })
            .positive({ message: 'zodError.discountCode.maxRedemptionsGlobal.positive' })
            .optional(),

        maxRedemptionsPerUser: z
            .number()
            .int({ message: 'zodError.discountCode.maxRedemptionsPerUser.int' })
            .positive({ message: 'zodError.discountCode.maxRedemptionsPerUser.positive' })
            .optional(),

        // Usage tracking (admin only)
        usedCountGlobal: z
            .number()
            .int({ message: 'zodError.discountCode.usedCountGlobal.int' })
            .nonnegative({ message: 'zodError.discountCode.usedCountGlobal.nonnegative' })
            .optional()
    })
    // Conditional type validation for updates
    .refine(
        (data) => {
            // If updating discount type, must have appropriate value field
            if (data.discountType) {
                if (data.discountType === 'percentage') {
                    return data.percentOff !== undefined && data.amountOffMinor === undefined;
                }
                if (data.discountType === 'fixed_amount') {
                    return data.amountOffMinor !== undefined && data.percentOff === undefined;
                }
            }
            return true;
        },
        {
            message: 'zodError.discountCode.typeSpecificFields.invalid'
        }
    )
    // Date validation for updates
    .refine(
        (data) => {
            if (data.validFrom && data.validTo) {
                return data.validFrom < data.validTo;
            }
            return true;
        },
        {
            message: 'zodError.discountCode.validDates.invalidRange',
            path: ['validTo']
        }
    )
    // Usage limits validation for updates
    .refine(
        (data) => {
            if (data.maxRedemptionsGlobal && data.maxRedemptionsPerUser) {
                return data.maxRedemptionsPerUser <= data.maxRedemptionsGlobal;
            }
            return true;
        },
        {
            message: 'zodError.discountCode.usageLimits.perUserExceedsGlobal',
            path: ['maxRedemptionsPerUser']
        }
    );

export type CreateDiscountCode = z.infer<typeof CreateDiscountCodeSchema>;
export type UpdateDiscountCode = z.infer<typeof UpdateDiscountCodeSchema>;
