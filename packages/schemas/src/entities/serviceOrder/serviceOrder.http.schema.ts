import { z } from 'zod';
import {
    AddRevisionRequestSchema,
    CreateServiceOrderSchema,
    UpdateServiceOrderDeliverablesSchema,
    UpdateServiceOrderPricingSchema,
    UpdateServiceOrderSchema,
    UpdateServiceOrderStatusSchema
} from './serviceOrder.crud.schema.js';
import {
    BulkServiceOrderOperationSchema,
    SearchServiceOrdersSchema,
    ServiceOrderAnalyticsSchema,
    ServiceOrderPerformanceAnalyticsSchema,
    ServiceOrderStatusTransitionSchema
} from './serviceOrder.query.schema.js';

/**
 * HTTP Create Service Order Schema
 *
 * Schema for HTTP requests to create service orders.
 * Includes proper coercion and validation for web forms.
 */
export const HttpCreateServiceOrderSchema = CreateServiceOrderSchema.extend({
    // Coerce pricing values from strings
    pricing: z
        .object({
            baseAmount: z.coerce.number().positive(),
            additionalCharges: z.coerce.number().min(0).default(0),
            discountAmount: z.coerce.number().min(0).default(0),
            totalAmount: z.coerce.number().positive(),
            currency: z.string().length(3).default('USD'),
            taxAmount: z.coerce.number().min(0).default(0),
            finalAmount: z.coerce.number().positive()
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

export type HttpCreateServiceOrder = z.infer<typeof HttpCreateServiceOrderSchema>;

/**
 * HTTP Update Service Order Schema
 *
 * Schema for HTTP requests to update service orders.
 */
export const HttpUpdateServiceOrderSchema = UpdateServiceOrderSchema.extend({
    // Coerce pricing values from strings
    pricing: z
        .object({
            baseAmount: z.coerce.number().positive().optional(),
            additionalCharges: z.coerce.number().min(0).optional(),
            discountAmount: z.coerce.number().min(0).optional(),
            totalAmount: z.coerce.number().positive().optional(),
            currency: z.string().length(3).optional(),
            taxAmount: z.coerce.number().min(0).optional(),
            finalAmount: z.coerce.number().positive().optional()
        })
        .optional()
});

export type HttpUpdateServiceOrder = z.infer<typeof HttpUpdateServiceOrderSchema>;

/**
 * HTTP Update Service Order Status Schema
 *
 * Schema for HTTP requests to update order status.
 */
export const HttpUpdateServiceOrderStatusSchema = UpdateServiceOrderStatusSchema;

export type HttpUpdateServiceOrderStatus = z.infer<typeof HttpUpdateServiceOrderStatusSchema>;

/**
 * HTTP Update Service Order Deliverables Schema
 *
 * Schema for HTTP requests to update deliverables.
 */
export const HttpUpdateServiceOrderDeliverablesSchema = UpdateServiceOrderDeliverablesSchema.extend(
    {
        deliverables: z.object({
            files: z
                .array(
                    z.object({
                        id: z.string().uuid(),
                        name: z.string().max(255),
                        url: z.string().url(),
                        size: z.coerce.number().int().min(0),
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

            approvalStatus: z
                .enum(['pending', 'approved', 'rejected', 'needs_revision'])
                .optional(),
            approvedAt: z.coerce.date().optional(),
            approvedById: z.string().uuid().optional()
        })
    }
);

export type HttpUpdateServiceOrderDeliverables = z.infer<
    typeof HttpUpdateServiceOrderDeliverablesSchema
>;

/**
 * HTTP Update Service Order Pricing Schema
 *
 * Schema for HTTP requests to update pricing.
 */
export const HttpUpdateServiceOrderPricingSchema = UpdateServiceOrderPricingSchema.extend({
    pricing: z
        .object({
            baseAmount: z.coerce.number().positive().optional(),
            additionalCharges: z.coerce.number().min(0).optional(),
            discountAmount: z.coerce.number().min(0).optional(),
            totalAmount: z.coerce.number().positive().optional(),
            currency: z.string().length(3).optional(),
            taxAmount: z.coerce.number().min(0).optional(),
            finalAmount: z.coerce.number().positive().optional()
        })
        .refine(
            (data) => {
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
        )
});

export type HttpUpdateServiceOrderPricing = z.infer<typeof HttpUpdateServiceOrderPricingSchema>;

/**
 * HTTP Add Revision Request Schema
 *
 * Schema for HTTP requests to add revision requests.
 */
export const HttpAddRevisionRequestSchema = AddRevisionRequestSchema;

export type HttpAddRevisionRequest = z.infer<typeof HttpAddRevisionRequestSchema>;

/**
 * HTTP Search Service Orders Schema
 *
 * Schema for HTTP requests to search service orders.
 */
export const HttpSearchServiceOrdersSchema = SearchServiceOrdersSchema.extend({
    // Coerce numeric values
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().positive().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // Coerce boolean values
    hasDeliverables: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .optional(),

    hasRevisions: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .optional(),

    includeService: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .default(false),

    includeDeliverables: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .default(false),

    // Parse arrays from query strings
    statuses: z
        .union([
            z.array(z.string()),
            z.string().transform((str) => str.split(',').map((s) => s.trim()))
        ])
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const statuses = Array.isArray(val) ? val : [val];
            return statuses.filter((s) =>
                ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUNDED'].includes(s)
            );
        })
});

export type HttpSearchServiceOrders = z.infer<typeof HttpSearchServiceOrdersSchema>;

/**
 * HTTP Service Order Analytics Schema
 *
 * Schema for HTTP requests for analytics.
 */
export const HttpServiceOrderAnalyticsSchema = ServiceOrderAnalyticsSchema.extend({
    // Parse arrays from query strings
    includeMetrics: z
        .union([
            z.array(z.string()),
            z.string().transform((str) => str.split(',').map((s) => s.trim()))
        ])
        .optional()
        .transform((val) => {
            if (!val) return ['orders', 'completedOrders'];
            const metrics = Array.isArray(val) ? val : [val];
            return metrics.filter((m) =>
                [
                    'orders',
                    'completedOrders',
                    'revenue',
                    'avgOrderValue',
                    'avgCompletionTime',
                    'popularServices'
                ].includes(m)
            );
        }),

    serviceTypeIds: z
        .union([
            z.array(z.string().uuid()),
            z.string().transform((str) =>
                str
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
            )
        ])
        .optional()
        .transform((val) => (Array.isArray(val) ? val : [val])),

    serviceCategories: z
        .union([
            z.array(z.string()),
            z.string().transform((str) =>
                str
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
            )
        ])
        .optional()
        .transform((val) => (Array.isArray(val) ? val : [val])),

    clientIds: z
        .union([
            z.array(z.string().uuid()),
            z.string().transform((str) =>
                str
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
            )
        ])
        .optional()
        .transform((val) => (Array.isArray(val) ? val : [val]))
});

export type HttpServiceOrderAnalytics = z.infer<typeof HttpServiceOrderAnalyticsSchema>;

/**
 * HTTP Bulk Service Order Operation Schema
 *
 * Schema for HTTP requests for bulk operations.
 */
export const HttpBulkServiceOrderOperationSchema = BulkServiceOrderOperationSchema.extend({
    // Parse array from comma-separated string
    orderIds: z
        .union([
            z.array(z.string().uuid()),
            z.string().transform((str) =>
                str
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
            )
        ])
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .refine((ids) => ids.length >= 1 && ids.length <= 100, {
            message: 'zodError.serviceOrder.bulk.invalidCount'
        }),

    // Coerce data values
    data: z
        .object({
            status: z.string().optional(),
            deliveryDate: z.coerce.date().optional(),
            notes: z.string().max(2000).optional(),
            pricingMultiplier: z.coerce.number().positive().max(10).optional(),
            adminInfo: z.record(z.string(), z.unknown()).optional()
        })
        .optional()
});

export type HttpBulkServiceOrderOperation = z.infer<typeof HttpBulkServiceOrderOperationSchema>;

/**
 * HTTP Service Order Performance Analytics Schema
 *
 * Schema for HTTP requests for performance analytics.
 */
export const HttpServiceOrderPerformanceAnalyticsSchema =
    ServiceOrderPerformanceAnalyticsSchema.extend({
        // Parse arrays from query strings
        includeMetrics: z
            .union([
                z.array(z.string()),
                z.string().transform((str) => str.split(',').map((s) => s.trim()))
            ])
            .optional()
            .transform((val) => {
                if (!val) return ['completionRate', 'avgCompletionTime'];
                const metrics = Array.isArray(val) ? val : [val];
                return metrics.filter((m) =>
                    [
                        'completionRate',
                        'avgCompletionTime',
                        'onTimeDelivery',
                        'revisionRate',
                        'clientSatisfaction'
                    ].includes(m)
                );
            }),

        // Coerce boolean values
        compareWithPrevious: z
            .union([z.boolean(), z.string()])
            .transform((val) => {
                if (typeof val === 'string') {
                    return val.toLowerCase() === 'true' || val === '1';
                }
                return val;
            })
            .default(false)
    });

export type HttpServiceOrderPerformanceAnalytics = z.infer<
    typeof HttpServiceOrderPerformanceAnalyticsSchema
>;

/**
 * HTTP Service Order Status Transition Schema
 *
 * Schema for HTTP requests for status transitions.
 */
export const HttpServiceOrderStatusTransitionSchema = ServiceOrderStatusTransitionSchema;

export type HttpServiceOrderStatusTransition = z.infer<
    typeof HttpServiceOrderStatusTransitionSchema
>;
