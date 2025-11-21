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
 * Payment type enumeration for HTTP requests
 */
export const PaymentTypeHttpSchema = z.enum(['SUBSCRIPTION', 'ONE_TIME', 'RECURRING', 'REFUND']);

/**
 * Lifecycle status enumeration for HTTP requests
 */
export const LifecycleStatusHttpSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED']);

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
 * Complete schema matching all PaymentCreateInputSchema fields with HTTP coercion
 */
export const PaymentCreateHttpSchema = z.object({
    // Core required fields with HTTP coercion
    userId: z.string().uuid(),
    planId: z.string().uuid(), // Maps to paymentPlanId in domain
    amount: z.coerce.number().min(0),
    currency: z.string().length(3),
    paymentMethod: z.string(),
    type: PaymentTypeHttpSchema.optional().default('SUBSCRIPTION'),
    status: PaymentStatusHttpSchema.optional().default('pending'),

    // Optional relational fields
    invoiceId: z.string().uuid().optional(),

    // Mercado Pago fields (optional)
    mercadoPagoPaymentId: z.string().optional(),
    mercadoPagoPreferenceId: z.string().optional(),
    mercadoPagoResponse: z.record(z.string(), z.unknown()).optional(),

    // Business fields
    externalReference: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    metadata: z.record(z.string(), z.string()).optional(),

    // Dates (optional - HTTP will send as ISO strings, coerced to Date)
    processedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    failureReason: z.string().max(1000).optional(),

    // Lifecycle flags (with defaults matching transformer)
    lifecycleState: LifecycleStatusHttpSchema.optional().default('ACTIVE'),
    isActive: z.coerce.boolean().optional().default(true),
    isDeleted: z.coerce.boolean().optional().default(false),
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type PaymentCreateHttp = z.infer<typeof PaymentCreateHttpSchema>;

/**
 * HTTP-compatible payment update schema
 * Handles partial updates via HTTP PATCH requests
 * All fields optional for partial updates
 */
export const PaymentUpdateHttpSchema = z.object({
    // Core fields (all optional for updates)
    paymentPlanId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    type: PaymentTypeHttpSchema.optional(),
    status: PaymentStatusHttpSchema.optional(),
    paymentMethod: z.string().optional(),

    // Amount and currency
    amount: z.coerce.number().min(0).optional(),
    currency: z.string().length(3).optional(),

    // Mercado Pago fields
    mercadoPagoPaymentId: z.string().optional(),
    mercadoPagoPreferenceId: z.string().optional(),
    mercadoPagoResponse: z.record(z.string(), z.unknown()).optional(),

    // Business fields
    externalReference: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    metadata: z.record(z.string(), z.string()).optional(),

    // Dates
    processedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    failureReason: z.string().max(1000).optional(),

    // Lifecycle flags
    lifecycleState: LifecycleStatusHttpSchema.optional(),
    isActive: z.coerce.boolean().optional(),
    isDeleted: z.coerce.boolean().optional(),
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type PaymentUpdateHttp = z.infer<typeof PaymentUpdateHttpSchema>;

/**
 * HTTP to Domain Conversion Functions
 * These functions convert HTTP request data to domain-compatible formats
 */

import {
    LifecycleStatusEnumSchema,
    PaymentMethodEnumSchema,
    PaymentStatusEnumSchema,
    PaymentTypeEnumSchema,
    PriceCurrencyEnumSchema
} from '../../enums/index.js';
import type { PaymentCreateInput, PaymentUpdateInput } from './payment.crud.schema.js';
// TODO: Re-enable when payment.query.schema.ts is recreated for new business model
// import type { PaymentSearchInputSchema } from './payment.query.schema.js';

/**
 * Convert HTTP search parameters to domain search format
 * TODO: Re-enable when payment.query.schema.ts is recreated
 */
/*
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
*/

/**
 * Convert HTTP payment creation data to domain format
 * Maps HTTP field names to domain field names (e.g., planId -> paymentPlanId)
 * All other fields are already in the correct format from HTTP schema
 */
export function httpToDomainPaymentCreate(httpData: PaymentCreateHttp): PaymentCreateInput {
    return {
        // Map field names
        paymentPlanId: httpData.planId,

        // Pass through all other fields directly (they're already validated and coerced)
        userId: httpData.userId,
        amount: httpData.amount,
        currency: PriceCurrencyEnumSchema.parse(httpData.currency),
        ...(httpData.paymentMethod && {
            paymentMethod: PaymentMethodEnumSchema.parse(httpData.paymentMethod)
        }),
        type: PaymentTypeEnumSchema.parse(httpData.type || 'SUBSCRIPTION'),
        status: PaymentStatusEnumSchema.parse(httpData.status || 'PENDING'),
        ...(httpData.invoiceId && { invoiceId: httpData.invoiceId }),
        ...(httpData.mercadoPagoPaymentId && {
            mercadoPagoPaymentId: httpData.mercadoPagoPaymentId
        }),
        ...(httpData.mercadoPagoPreferenceId && {
            mercadoPagoPreferenceId: httpData.mercadoPagoPreferenceId
        }),
        ...(httpData.mercadoPagoResponse && { mercadoPagoResponse: httpData.mercadoPagoResponse }),
        ...(httpData.externalReference && { externalReference: httpData.externalReference }),
        ...(httpData.description && { description: httpData.description }),
        ...(httpData.metadata && { metadata: httpData.metadata }),
        ...(httpData.processedAt && { processedAt: httpData.processedAt }),
        ...(httpData.expiresAt && { expiresAt: httpData.expiresAt }),
        ...(httpData.failureReason && { failureReason: httpData.failureReason }),
        lifecycleState: LifecycleStatusEnumSchema.parse(httpData.lifecycleState || 'ACTIVE'),
        isActive: httpData.isActive ?? true,
        isDeleted: httpData.isDeleted ?? false,
        ...(httpData.adminInfo && { adminInfo: httpData.adminInfo })
    };
}

/**
 * Convert HTTP payment update data to domain format
 * All fields are optional for partial updates
 */
export function httpToDomainPaymentUpdate(httpData: PaymentUpdateHttp): PaymentUpdateInput {
    // Create result object with only defined fields
    const result: PaymentUpdateInput = {};

    // Only include fields that are actually provided
    if (httpData.paymentPlanId !== undefined) result.paymentPlanId = httpData.paymentPlanId;
    if (httpData.invoiceId !== undefined) result.invoiceId = httpData.invoiceId;
    if (httpData.type !== undefined) result.type = PaymentTypeEnumSchema.parse(httpData.type);
    if (httpData.status !== undefined)
        result.status = PaymentStatusEnumSchema.parse(httpData.status);
    if (httpData.paymentMethod !== undefined && httpData.paymentMethod !== null) {
        result.paymentMethod = PaymentMethodEnumSchema.parse(httpData.paymentMethod);
    }
    if (httpData.amount !== undefined) result.amount = httpData.amount;
    if (httpData.currency !== undefined)
        result.currency = PriceCurrencyEnumSchema.parse(httpData.currency);
    if (httpData.mercadoPagoPaymentId !== undefined)
        result.mercadoPagoPaymentId = httpData.mercadoPagoPaymentId;
    if (httpData.mercadoPagoPreferenceId !== undefined)
        result.mercadoPagoPreferenceId = httpData.mercadoPagoPreferenceId;
    if (httpData.mercadoPagoResponse !== undefined)
        result.mercadoPagoResponse = httpData.mercadoPagoResponse;
    if (httpData.externalReference !== undefined)
        result.externalReference = httpData.externalReference;
    if (httpData.description !== undefined) result.description = httpData.description;
    if (httpData.metadata !== undefined) result.metadata = httpData.metadata;
    if (httpData.processedAt !== undefined) result.processedAt = httpData.processedAt;
    if (httpData.expiresAt !== undefined) result.expiresAt = httpData.expiresAt;
    if (httpData.failureReason !== undefined) result.failureReason = httpData.failureReason;
    if (httpData.lifecycleState !== undefined) {
        result.lifecycleState = LifecycleStatusEnumSchema.parse(httpData.lifecycleState);
    }
    if (httpData.isActive !== undefined) result.isActive = httpData.isActive;
    if (httpData.isDeleted !== undefined) result.isDeleted = httpData.isDeleted;
    if (httpData.adminInfo !== undefined) result.adminInfo = httpData.adminInfo;

    return result;
}
