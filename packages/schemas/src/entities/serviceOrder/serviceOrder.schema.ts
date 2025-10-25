import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    ClientIdSchema,
    PricingPlanIdSchema,
    ProfessionalServiceIdSchema,
    ServiceOrderIdSchema
} from '../../common/id.schema.js';
import { ServiceOrderStatusSchema } from '../../enums/index.js';
import { ServiceOrderStatusEnum } from '../../enums/service-order-status.enum.js';

/**
 * Service Order Schema
 *
 * Defines orders for professional services with status tracking, delivery dates,
 * and deliverable management. Maps to PROFESSIONAL_SERVICE_ORDER in the database diagram.
 */
export const ServiceOrderSchema = z
    .object({
        // Base fields
        id: ServiceOrderIdSchema,
        ...BaseAuditFields,

        // Relationship fields
        clientId: ClientIdSchema.describe('Client who placed this order'),
        serviceTypeId: ProfessionalServiceIdSchema.describe('Type of professional service ordered'),
        pricingPlanId: PricingPlanIdSchema.describe('Pricing plan used for this order'),

        // Order status and lifecycle
        status: ServiceOrderStatusSchema.describe('Current order status'),

        orderedAt: z.coerce.date().describe('When the order was placed'),

        deliveryDate: z
            .union([z.date(), z.string(), z.undefined()])
            .transform((val) => {
                if (val === undefined) return undefined;
                if (val instanceof Date) return val;
                return new Date(val);
            })
            .optional()
            .describe('Expected or actual delivery date'),

        completedAt: z
            .union([z.date(), z.string(), z.null()])
            .transform((val) => {
                if (val === null) return null;
                if (val instanceof Date) return val;
                return new Date(val);
            })
            .nullable()
            .describe('When the order was completed'),

        // Order details and requirements
        notes: z.string().max(2000).optional().describe('General notes about the order'),

        clientRequirements: z
            .string()
            .min(10, { message: 'zodError.serviceOrder.clientRequirements.tooShort' })
            .max(5000, { message: 'zodError.serviceOrder.clientRequirements.tooLong' })
            .describe('Detailed client requirements and specifications'),

        // Deliverables and work output
        deliverables: z
            .object({
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
                    .default([]),

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
                    .default([]),

                approvalStatus: z
                    .enum(['pending', 'approved', 'rejected', 'needs_revision'])
                    .default('pending'),
                approvedAt: z.coerce.date().optional(),
                approvedById: z.string().uuid().optional()
            })
            .optional()
            .describe('Order deliverables and completion details'),

        // Pricing and payment information
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
                    const calculated =
                        data.baseAmount + data.additionalCharges - data.discountAmount;
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
            .describe('Pricing breakdown for the order'),

        // Service-specific metadata
        serviceMetadata: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Service-specific configuration and metadata'),

        // Additional metadata
        adminInfo: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Administrative information and internal notes')
    })
    .refine(
        (data) => {
            // Status validation for completed orders
            if (data.status === ServiceOrderStatusEnum.COMPLETED && !data.completedAt) {
                return false;
            }
            if (data.status !== ServiceOrderStatusEnum.COMPLETED && data.completedAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.serviceOrder.status.inconsistentCompletion',
            path: ['completedAt']
        }
    )
    .refine(
        (data) => {
            // Delivery date should be after order date
            return !data.deliveryDate || data.orderedAt <= data.deliveryDate;
        },
        {
            message: 'zodError.serviceOrder.deliveryDate.beforeOrderDate',
            path: ['deliveryDate']
        }
    )
    .refine(
        (data) => {
            // Completed date should be after order date
            return !data.completedAt || data.orderedAt <= data.completedAt;
        },
        {
            message: 'zodError.serviceOrder.completedAt.beforeOrderDate',
            path: ['completedAt']
        }
    );

export type ServiceOrder = z.infer<typeof ServiceOrderSchema>;

/**
 * Service Order Schema without admin fields
 * Used for public API responses
 */
export const PublicServiceOrderSchema = ServiceOrderSchema.omit({
    adminInfo: true,
    deletedAt: true,
    deletedById: true,
    serviceMetadata: true
});

export type PublicServiceOrder = z.infer<typeof PublicServiceOrderSchema>;

/**
 * Service Order with Service Information
 * Extended schema that includes service type details
 */
export const ServiceOrderWithServiceSchema = ServiceOrderSchema.extend({
    serviceType: z
        .object({
            id: ProfessionalServiceIdSchema,
            name: z.string(),
            category: z.string(),
            description: z.string().optional()
        })
        .optional()
});

export type ServiceOrderWithService = z.infer<typeof ServiceOrderWithServiceSchema>;

/**
 * Service Order Summary Schema
 * Lightweight schema for listing and basic operations
 */
export const ServiceOrderSummarySchema = ServiceOrderSchema.pick({
    id: true,
    clientId: true,
    serviceTypeId: true,
    status: true,
    orderedAt: true,
    deliveryDate: true,
    completedAt: true,
    pricing: true,
    createdAt: true,
    updatedAt: true
});

export type ServiceOrderSummary = z.infer<typeof ServiceOrderSummarySchema>;
