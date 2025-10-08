/**
 * Payment HTTP Schemas
 *
 * HTTP-compatible schemas for payment operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';

/**
 * Payment status enumeration for HTTP requests
 */
export const PaymentStatusHttpSchema = z.enum([
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'refunded'
]);

/**
 * HTTP-compatible payment search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const PaymentSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Entity relation filters with HTTP coercion
    userId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),

    // Status filters with HTTP coercion
    status: PaymentStatusHttpSchema.optional(),

    // Amount filters with HTTP coercion
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    amount: z.coerce.number().min(0).optional(),

    // Currency filters
    currency: z.string().length(3).optional(),

    // Date filters with HTTP coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    processedAfter: z.coerce.date().optional(),
    processedBefore: z.coerce.date().optional(),

    // Payment method filters
    paymentMethod: z.string().optional(),

    // External provider filters
    mpPaymentId: z.string().optional(),
    mpStatus: z.string().optional(),
    stripePaymentIntentId: z.string().optional(),

    // Status flags with HTTP coercion
    hasRefunds: createBooleanQueryParam('Filter payments with refunds'),
    isRefunded: createBooleanQueryParam('Filter refunded payments'),
    hasFailed: createBooleanQueryParam('Filter failed payments'),
    isCompleted: createBooleanQueryParam('Filter completed payments'),

    // Failure analysis
    failureReason: z.string().optional(),
    hasFailureReason: createBooleanQueryParam('Filter payments with failure reasons'),

    // Metadata filters with HTTP coercion
    hasMetadata: createBooleanQueryParam('Filter payments with metadata'),
    metadataKey: z.string().optional(),
    metadataValue: z.string().optional(),

    // Array filters with HTTP coercion
    userIds: createArrayQueryParam('Filter by multiple user IDs'),
    planIds: createArrayQueryParam('Filter by multiple plan IDs'),
    statuses: createArrayQueryParam('Filter by multiple payment statuses'),
    currencies: createArrayQueryParam('Filter by multiple currencies'),
    paymentMethods: createArrayQueryParam('Filter by multiple payment methods'),

    // Additional search options with HTTP coercion
    searchInMetadata: createBooleanQueryParam('Include metadata in search')
});

export type PaymentSearchHttp = z.infer<typeof PaymentSearchHttpSchema>;

/**
 * HTTP-compatible payment creation schema
 * Handles form data and JSON input for creating payments via HTTP
 */
export const PaymentCreateHttpSchema = z.object({
    userId: z.string().uuid(),
    planId: z.string().uuid(),
    amount: z.coerce.number().min(0),
    currency: z.string().length(3),
    paymentMethod: z.string(),
    description: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional()
});

export type PaymentCreateHttp = z.infer<typeof PaymentCreateHttpSchema>;

/**
 * HTTP-compatible payment update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const PaymentUpdateHttpSchema = z.object({
    status: PaymentStatusHttpSchema.optional(),
    mpPaymentId: z.string().optional(),
    mpStatus: z.string().optional(),
    stripePaymentIntentId: z.string().optional(),
    failureReason: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional()
});

export type PaymentUpdateHttp = z.infer<typeof PaymentUpdateHttpSchema>;

/**
 * HTTP to Domain Conversion Functions
 * These functions convert HTTP request data to domain-compatible formats
 */

import {
    PaymentMethodEnumSchema,
    PaymentStatusEnumSchema,
    PaymentTypeEnumSchema,
    PriceCurrencyEnumSchema
} from '../../enums/index.js';
import type { PaymentCreateInputSchema, PaymentUpdateInputSchema } from './payment.crud.schema.js';
import type { PaymentSearchInputSchema } from './payment.query.schema.js';

/**
 * Convert HTTP search parameters to domain search format
 */
export function httpToDomainPaymentSearch(
    httpData: PaymentSearchHttp
): z.infer<typeof PaymentSearchInputSchema> {
    return {
        ...httpData,
        // Convert string arrays to proper arrays if needed
        userIds: httpData.userIds,
        planIds: httpData.planIds,
        statuses: httpData.statuses?.map((s) => PaymentStatusHttpSchema.parse(s)),
        currencies: httpData.currencies,
        paymentMethods: httpData.paymentMethods,
        // Convert boolean flags properly
        hasRefunds: httpData.hasRefunds,
        isRefunded: httpData.isRefunded,
        hasFailed: httpData.hasFailed,
        isCompleted: httpData.isCompleted,
        hasFailureReason: httpData.hasFailureReason,
        hasMetadata: httpData.hasMetadata,
        searchInMetadata: httpData.searchInMetadata
    };
}

/**
 * Convert HTTP payment creation data to domain format
 */
export function httpToDomainPaymentCreate(
    httpData: PaymentCreateHttp
): z.infer<typeof PaymentCreateInputSchema> {
    return {
        userId: httpData.userId,
        paymentPlanId: httpData.planId,
        type: PaymentTypeEnumSchema.enum.SUBSCRIPTION, // Default type
        status: PaymentStatusEnumSchema.enum.PENDING, // Default status
        paymentMethod: PaymentMethodEnumSchema.optional().parse(httpData.paymentMethod),
        amount: httpData.amount,
        currency: PriceCurrencyEnumSchema.parse(httpData.currency),
        description: httpData.description,
        metadata: httpData.metadata
    };
}

/**
 * Convert HTTP payment update data to domain format
 */
export function httpToDomainPaymentUpdate(
    httpData: PaymentUpdateHttp
): z.infer<typeof PaymentUpdateInputSchema> {
    return {
        status: httpData.status ? PaymentStatusEnumSchema.parse(httpData.status) : undefined,
        mercadoPagoPaymentId: httpData.mpPaymentId,
        failureReason: httpData.failureReason,
        metadata: httpData.metadata
    };
}
