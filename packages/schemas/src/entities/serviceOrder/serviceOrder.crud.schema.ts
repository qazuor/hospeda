import { z } from 'zod';
import {
    ClientIdSchema,
    PricingPlanIdSchema,
    ProfessionalServiceIdSchema
} from '../../common/id.schema.js';
import { ServiceOrderStatusSchema } from '../../enums/index.js';
import { ServiceOrderStatusEnum } from '../../enums/service-order-status.enum.js';
import { ServiceOrderSchema } from './serviceOrder.schema.js';

/**
 * Create Service Order Schema
 *
 * Schema for creating new service orders.
 * Excludes auto-generated fields and includes required relationships.
 */
export const CreateServiceOrderSchema = ServiceOrderSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    completedAt: true // Cannot be set on creation
}).extend({
    // Required relationship fields
    clientId: ClientIdSchema,
    serviceTypeId: ProfessionalServiceIdSchema,
    pricingPlanId: PricingPlanIdSchema,

    // Status defaults to PENDING on creation
    status: ServiceOrderStatusSchema.default(ServiceOrderStatusEnum.PENDING),

    // Order date defaults to now if not provided
    orderedAt: z.coerce.date().default(() => new Date()),

    // Client requirements are required on creation
    clientRequirements: z
        .string()
        .min(10, { message: 'zodError.serviceOrder.clientRequirements.tooShort' })
        .max(5000, { message: 'zodError.serviceOrder.clientRequirements.tooLong' }),

    // Pricing is required on creation
    pricing: z
        .object({
            baseAmount: z.number().positive(),
            additionalCharges: z.number().min(0).default(0),
            discountAmount: z.number().min(0).default(0),
            totalAmount: z.number().positive(),
            currency: z.string().length(3).default('USD'),
            taxAmount: z.number().min(0).default(0),
            finalAmount: z.number().positive()
        })
        .refine(
            (data) => {
                const calculated = data.baseAmount + data.additionalCharges - data.discountAmount;
                return Math.abs(calculated - data.totalAmount) < 0.01;
            },
            {
                message: 'zodError.serviceOrder.pricing.invalidTotal'
            }
        )
        .refine(
            (data) => {
                const calculated = data.totalAmount + data.taxAmount;
                return Math.abs(calculated - data.finalAmount) < 0.01;
            },
            {
                message: 'zodError.serviceOrder.pricing.invalidFinal'
            }
        )
});

export type CreateServiceOrder = z.infer<typeof CreateServiceOrderSchema>;

/**
 * Update Service Order Schema
 *
 * Schema for updating existing service orders.
 * Restricts certain fields based on order status.
 */
export const UpdateServiceOrderSchema = z.object({
    serviceTypeId: ProfessionalServiceIdSchema.optional(),
    pricingPlanId: PricingPlanIdSchema.optional(),

    deliveryDate: z.coerce.date().optional(),

    notes: z.string().max(2000).optional(),

    clientRequirements: z
        .string()
        .min(10, { message: 'zodError.serviceOrder.clientRequirements.tooShort' })
        .max(5000, { message: 'zodError.serviceOrder.clientRequirements.tooLong' })
        .optional(),

    pricing: z
        .object({
            baseAmount: z.number().positive().optional(),
            additionalCharges: z.number().min(0).optional(),
            discountAmount: z.number().min(0).optional(),
            totalAmount: z.number().positive().optional(),
            currency: z.string().length(3).optional(),
            taxAmount: z.number().min(0).optional(),
            finalAmount: z.number().positive().optional()
        })
        .optional(),

    serviceMetadata: z.record(z.string(), z.unknown()).optional(),

    adminInfo: z.record(z.string(), z.unknown()).optional()
});

export type UpdateServiceOrder = z.infer<typeof UpdateServiceOrderSchema>;

/**
 * Update Service Order Status Schema
 *
 * Specialized schema for updating order status with status transitions.
 */
export const UpdateServiceOrderStatusSchema = z
    .object({
        status: ServiceOrderStatusSchema,

        // Conditional fields based on status
        completedAt: z.coerce.date().optional(),
        deliveryDate: z.coerce.date().optional(),

        adminInfo: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Optional admin notes about the status change')
    })
    .refine(
        (data) => {
            // COMPLETED status requires completedAt
            if (data.status === ServiceOrderStatusEnum.COMPLETED && !data.completedAt) {
                return false;
            }
            // Other statuses should not have completedAt unless transitioning from completed
            return true;
        },
        {
            message: 'zodError.serviceOrder.status.missingCompletedAt',
            path: ['completedAt']
        }
    );

export type UpdateServiceOrderStatus = z.infer<typeof UpdateServiceOrderStatusSchema>;

/**
 * Update Service Order Deliverables Schema
 *
 * Specialized schema for managing order deliverables.
 */
export const UpdateServiceOrderDeliverablesSchema = z.object({
    deliverables: z.object({
        files: z
            .array(
                z.object({
                    id: z.string().uuid(),
                    name: z.string().max(255),
                    url: z.string().url(),
                    size: z.number().int().min(0),
                    mimeType: z.string().max(100),
                    uploadedAt: z.coerce.date()
                })
            )
            .max(50)
            .optional(),

        description: z.string().max(2000).optional(),

        completionNotes: z.string().max(2000).optional(),

        revisionRequests: z
            .array(
                z.object({
                    id: z.string().uuid(),
                    requestedAt: z.coerce.date(),
                    description: z.string().max(1000),
                    status: z.enum(['pending', 'in_progress', 'completed']),
                    completedAt: z.coerce.date().optional()
                })
            )
            .max(10)
            .optional(),

        approvalStatus: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
        approvedAt: z.coerce.date().optional(),
        approvedById: z.string().uuid().optional()
    }),

    adminInfo: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional admin notes about the deliverables update')
});

export type UpdateServiceOrderDeliverables = z.infer<typeof UpdateServiceOrderDeliverablesSchema>;

/**
 * Update Service Order Pricing Schema
 *
 * Specialized schema for updating order pricing.
 */
export const UpdateServiceOrderPricingSchema = z.object({
    pricing: z
        .object({
            baseAmount: z.number().positive().optional(),
            additionalCharges: z.number().min(0).optional(),
            discountAmount: z.number().min(0).optional(),
            totalAmount: z.number().positive().optional(),
            currency: z.string().length(3).optional(),
            taxAmount: z.number().min(0).optional(),
            finalAmount: z.number().positive().optional()
        })
        .refine(
            (data) => {
                // If updating totals, ensure consistency
                if (
                    data.baseAmount !== undefined &&
                    data.additionalCharges !== undefined &&
                    data.discountAmount !== undefined &&
                    data.totalAmount !== undefined
                ) {
                    const calculated =
                        data.baseAmount + data.additionalCharges - data.discountAmount;
                    return Math.abs(calculated - data.totalAmount) < 0.01;
                }
                return true;
            },
            {
                message: 'zodError.serviceOrder.pricing.invalidTotal'
            }
        )
        .refine(
            (data) => {
                // If updating final amount, ensure consistency
                if (
                    data.totalAmount !== undefined &&
                    data.taxAmount !== undefined &&
                    data.finalAmount !== undefined
                ) {
                    const calculated = data.totalAmount + data.taxAmount;
                    return Math.abs(calculated - data.finalAmount) < 0.01;
                }
                return true;
            },
            {
                message: 'zodError.serviceOrder.pricing.invalidFinal'
            }
        ),

    adminInfo: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional admin notes about the pricing change')
});

export type UpdateServiceOrderPricing = z.infer<typeof UpdateServiceOrderPricingSchema>;

/**
 * Add Revision Request Schema
 *
 * Schema for adding revision requests to an order.
 */
export const AddRevisionRequestSchema = z.object({
    description: z
        .string()
        .min(10, { message: 'zodError.serviceOrder.revision.description.tooShort' })
        .max(1000, { message: 'zodError.serviceOrder.revision.description.tooLong' }),

    requestedAt: z.coerce.date().default(() => new Date()),

    adminInfo: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional admin notes about the revision request')
});

export type AddRevisionRequest = z.infer<typeof AddRevisionRequestSchema>;
