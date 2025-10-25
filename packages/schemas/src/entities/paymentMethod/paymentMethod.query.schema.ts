import { z } from 'zod';
import { ClientIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { PaymentMethodEnumSchema } from '../../enums/index.js';

/**
 * Payment Method Query Schema
 *
 * Schema for querying payment methods with various filters, pagination, and sorting options.
 */
export const PaymentMethodQuerySchema = z.object({
    // Client filter
    clientId: ClientIdSchema.optional(),

    // Type filter
    type: z.union([PaymentMethodEnumSchema, z.array(PaymentMethodEnumSchema)]).optional(),

    // Status filters
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),

    // Card specific filters
    cardBrand: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.query.cardBrand.min' })
        .optional(),

    cardLast4: z
        .string()
        .regex(/^\d{4}$/, { message: 'zodError.paymentMethod.query.cardLast4.format' })
        .optional(),

    // Bank specific filters
    bankName: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.query.bankName.min' })
        .optional(),

    accountType: z.enum(['CHECKING', 'SAVINGS']).optional(),

    // Provider filters
    providerPaymentMethodId: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.query.providerPaymentMethodId.min' })
        .optional(),

    providerCustomerId: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.query.providerCustomerId.min' })
        .optional(),

    // Display name search (partial match)
    displayName: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.query.displayName.min' })
        .optional(),

    // Pagination and sorting
    ...PaginationSchema.shape,
    ...SortingSchema.extend({
        sortBy: z
            .enum(['displayName', 'type', 'isDefault', 'isActive', 'createdAt', 'updatedAt'])
            .default('createdAt')
    }).shape
});

/**
 * Payment Method Search Schema
 *
 * Schema for full-text search across payment methods with optional filters.
 */
export const PaymentMethodSearchSchema = PaymentMethodQuerySchema.extend({
    // Text search query
    q: z
        .string()
        .min(2, { message: 'zodError.paymentMethod.search.query.min' })
        .max(200, { message: 'zodError.paymentMethod.search.query.max' })
        .optional()
});

/**
 * Type exports for Payment Method query operations
 */
export type PaymentMethodQuery = z.infer<typeof PaymentMethodQuerySchema>;
export type PaymentMethodSearch = z.infer<typeof PaymentMethodSearchSchema>;
