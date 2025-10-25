import { z } from 'zod';
import {
    ClientIdSchema,
    PricingPlanIdSchema,
    ProfessionalServiceIdSchema
} from '../../common/id.schema.js';
import { ServiceOrderStatusSchema } from '../../enums/index.js';

/**
 * Search Service Orders Schema
 *
 * Schema for searching and filtering service orders with pagination.
 */
export const SearchServiceOrdersSchema = z
    .object({
        // Text search
        q: z
            .string()
            .min(1)
            .max(200)
            .optional()
            .describe('Search in order notes, client requirements, and service names'),

        // Relationship filtering
        clientId: ClientIdSchema.optional(),
        serviceTypeId: ProfessionalServiceIdSchema.optional(),
        pricingPlanId: PricingPlanIdSchema.optional(),

        // Status filtering
        status: ServiceOrderStatusSchema.optional(),
        statuses: z
            .array(ServiceOrderStatusSchema)
            .max(5)
            .optional()
            .describe('Filter by multiple statuses'),

        // Date filtering
        orderedAfter: z.coerce.date().optional().describe('Filter orders placed after this date'),

        orderedBefore: z.coerce.date().optional().describe('Filter orders placed before this date'),

        deliveryAfter: z.coerce
            .date()
            .optional()
            .describe('Filter orders with delivery after this date'),

        deliveryBefore: z.coerce
            .date()
            .optional()
            .describe('Filter orders with delivery before this date'),

        completedAfter: z.coerce
            .date()
            .optional()
            .describe('Filter orders completed after this date'),

        completedBefore: z.coerce
            .date()
            .optional()
            .describe('Filter orders completed before this date'),

        // Pricing filtering
        minAmount: z.number().min(0).optional().describe('Minimum order amount filter'),

        maxAmount: z.number().positive().optional().describe('Maximum order amount filter'),

        currency: z.string().length(3).optional().describe('Filter by currency'),

        // Service category filtering (requires join)
        serviceCategory: z.string().max(100).optional().describe('Filter by service category'),

        // Deliverables filtering
        hasDeliverables: z.boolean().optional().describe('Filter orders with/without deliverables'),

        approvalStatus: z
            .enum(['pending', 'approved', 'rejected', 'needs_revision'])
            .optional()
            .describe('Filter by deliverable approval status'),

        hasRevisions: z.boolean().optional().describe('Filter orders with revision requests'),

        // Pagination
        page: z.number().int().min(1).default(1).describe('Page number for pagination'),

        pageSize: z.number().int().min(1).max(100).default(20).describe('Number of items per page'),

        // Sorting
        sortBy: z
            .enum([
                'orderedAt',
                'deliveryDate',
                'completedAt',
                'status',
                'totalAmount',
                'createdAt',
                'updatedAt'
            ])
            .default('orderedAt')
            .describe('Field to sort by'),

        sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort order'),

        // Include related data
        includeService: z
            .boolean()
            .default(false)
            .describe('Include service type information in response'),

        includeDeliverables: z
            .boolean()
            .default(false)
            .describe('Include deliverables information in response')
    })
    .refine(
        (data) =>
            !data.orderedAfter || !data.orderedBefore || data.orderedAfter <= data.orderedBefore,
        {
            message: 'zodError.serviceOrder.search.invalidOrderedDateRange',
            path: ['orderedBefore']
        }
    )
    .refine(
        (data) =>
            !data.deliveryAfter ||
            !data.deliveryBefore ||
            data.deliveryAfter <= data.deliveryBefore,
        {
            message: 'zodError.serviceOrder.search.invalidDeliveryDateRange',
            path: ['deliveryBefore']
        }
    )
    .refine(
        (data) =>
            !data.completedAfter ||
            !data.completedBefore ||
            data.completedAfter <= data.completedBefore,
        {
            message: 'zodError.serviceOrder.search.invalidCompletedDateRange',
            path: ['completedBefore']
        }
    )
    .refine((data) => !data.minAmount || !data.maxAmount || data.minAmount <= data.maxAmount, {
        message: 'zodError.serviceOrder.search.invalidAmountRange',
        path: ['maxAmount']
    });

export type SearchServiceOrders = z.infer<typeof SearchServiceOrdersSchema>;

/**
 * Service Order Analytics Schema
 *
 * Schema for aggregated analytics and statistics.
 */
export const ServiceOrderAnalyticsSchema = z
    .object({
        // Time period for analytics
        startDate: z.coerce.date().optional().describe('Start date for analytics period'),

        endDate: z.coerce.date().optional().describe('End date for analytics period'),

        // Grouping options
        groupBy: z
            .enum(['status', 'serviceType', 'serviceCategory', 'client', 'month', 'week'])
            .optional()
            .describe('Group analytics by specified field'),

        // Metrics to include
        includeMetrics: z
            .array(
                z.enum([
                    'orders',
                    'completedOrders',
                    'revenue',
                    'avgOrderValue',
                    'avgCompletionTime',
                    'popularServices'
                ])
            )
            .default(['orders', 'completedOrders'])
            .describe('Metrics to include in analytics'),

        // Filter specific services or categories
        serviceTypeIds: z
            .array(ProfessionalServiceIdSchema)
            .max(50)
            .optional()
            .describe('Specific service types to include in analytics'),

        serviceCategories: z
            .array(z.string().max(100))
            .max(20)
            .optional()
            .describe('Specific service categories to include in analytics'),

        clientIds: z
            .array(ClientIdSchema)
            .max(50)
            .optional()
            .describe('Specific clients to include in analytics')
    })
    .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
        message: 'zodError.serviceOrder.analytics.invalidDateRange',
        path: ['endDate']
    });

export type ServiceOrderAnalytics = z.infer<typeof ServiceOrderAnalyticsSchema>;

/**
 * Bulk Service Order Operation Schema
 *
 * Schema for performing bulk operations on multiple service orders.
 */
export const BulkServiceOrderOperationSchema = z.object({
    // Order IDs to operate on
    orderIds: z
        .array(z.string().uuid())
        .min(1, { message: 'zodError.serviceOrder.bulk.minOrders' })
        .max(100, { message: 'zodError.serviceOrder.bulk.maxOrders' })
        .describe('List of order IDs to operate on'),

    // Operation to perform
    operation: z
        .enum(['updateStatus', 'cancel', 'setDeliveryDate', 'addNotes', 'assignPricing'])
        .describe('Bulk operation to perform'),

    // Operation-specific data
    data: z
        .object({
            status: ServiceOrderStatusSchema.optional(),
            deliveryDate: z.coerce.date().optional(),
            notes: z.string().max(2000).optional(),
            pricingMultiplier: z.number().positive().max(10).optional(),
            adminInfo: z.record(z.string(), z.unknown()).optional()
        })
        .optional()
        .describe('Data for the bulk operation')
});

export type BulkServiceOrderOperation = z.infer<typeof BulkServiceOrderOperationSchema>;

/**
 * Service Order Performance Analytics Schema
 *
 * Schema for tracking order performance and completion metrics.
 */
export const ServiceOrderPerformanceAnalyticsSchema = z
    .object({
        // Time period for performance analytics
        startDate: z.coerce.date().optional().describe('Start date for performance period'),

        endDate: z.coerce.date().optional().describe('End date for performance period'),

        // Service filtering
        serviceTypeId: ProfessionalServiceIdSchema.optional(),
        serviceCategory: z.string().max(100).optional(),

        // Performance metrics to include
        includeMetrics: z
            .array(
                z.enum([
                    'completionRate',
                    'avgCompletionTime',
                    'onTimeDelivery',
                    'revisionRate',
                    'clientSatisfaction'
                ])
            )
            .default(['completionRate', 'avgCompletionTime'])
            .describe('Performance metrics to include'),

        // Grouping for trends
        groupBy: z
            .enum(['day', 'week', 'month', 'quarter'])
            .optional()
            .describe('Time grouping for performance trends'),

        // Comparison period
        compareWithPrevious: z
            .boolean()
            .default(false)
            .describe('Include comparison with previous period')
    })
    .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
        message: 'zodError.serviceOrder.performance.invalidDateRange',
        path: ['endDate']
    });

export type ServiceOrderPerformanceAnalytics = z.infer<
    typeof ServiceOrderPerformanceAnalyticsSchema
>;

/**
 * Service Order Status Transition Schema
 *
 * Schema for tracking and validating status transitions.
 */
export const ServiceOrderStatusTransitionSchema = z.object({
    orderId: z.string().uuid(),
    fromStatus: ServiceOrderStatusSchema,
    toStatus: ServiceOrderStatusSchema,
    reason: z.string().max(500).optional(),
    transitionedAt: z.coerce.date().default(() => new Date()),
    transitionedById: z.string().uuid(),
    adminInfo: z.record(z.string(), z.unknown()).optional()
});

export type ServiceOrderStatusTransition = z.infer<typeof ServiceOrderStatusTransitionSchema>;
