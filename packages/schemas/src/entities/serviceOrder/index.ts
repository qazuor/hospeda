/**
 * Service Order Schema Exports
 *
 * This module exports all service order-related schemas for the professional services platform.
 * Includes main order schema, CRUD operations, queries, HTTP coercion,
 * and comprehensive order management functionality.
 */

// Main service order schema
export {
    PublicServiceOrderSchema,
    ServiceOrderSchema,
    ServiceOrderSummarySchema,
    ServiceOrderWithServiceSchema,
    type PublicServiceOrder,
    type ServiceOrder,
    type ServiceOrderSummary,
    type ServiceOrderWithService
} from './serviceOrder.schema.js';

// CRUD operation schemas
export {
    AddRevisionRequestSchema,
    CreateServiceOrderSchema,
    UpdateServiceOrderDeliverablesSchema,
    UpdateServiceOrderPricingSchema,
    UpdateServiceOrderSchema,
    UpdateServiceOrderStatusSchema,
    type AddRevisionRequest,
    type CreateServiceOrder,
    type UpdateServiceOrder,
    type UpdateServiceOrderDeliverables,
    type UpdateServiceOrderPricing,
    type UpdateServiceOrderStatus
} from './serviceOrder.crud.schema.js';

// Query and search schemas
export {
    BulkServiceOrderOperationSchema,
    SearchServiceOrdersSchema,
    ServiceOrderAnalyticsSchema,
    ServiceOrderPerformanceAnalyticsSchema,
    ServiceOrderStatusTransitionSchema,
    type BulkServiceOrderOperation,
    type SearchServiceOrders,
    type ServiceOrderAnalytics,
    type ServiceOrderPerformanceAnalytics,
    type ServiceOrderStatusTransition
} from './serviceOrder.query.schema.js';

// HTTP coercion schemas
export {
    HttpAddRevisionRequestSchema,
    HttpBulkServiceOrderOperationSchema,
    HttpCreateServiceOrderSchema,
    HttpSearchServiceOrdersSchema,
    HttpServiceOrderAnalyticsSchema,
    HttpServiceOrderPerformanceAnalyticsSchema,
    HttpServiceOrderStatusTransitionSchema,
    HttpUpdateServiceOrderDeliverablesSchema,
    HttpUpdateServiceOrderPricingSchema,
    HttpUpdateServiceOrderSchema,
    HttpUpdateServiceOrderStatusSchema,
    type HttpAddRevisionRequest,
    type HttpBulkServiceOrderOperation,
    type HttpCreateServiceOrder,
    type HttpSearchServiceOrders,
    type HttpServiceOrderAnalytics,
    type HttpServiceOrderPerformanceAnalytics,
    type HttpServiceOrderStatusTransition,
    type HttpUpdateServiceOrder,
    type HttpUpdateServiceOrderDeliverables,
    type HttpUpdateServiceOrderPricing,
    type HttpUpdateServiceOrderStatus
} from './serviceOrder.http.schema.js';
