import { z } from 'zod';
import { ClientIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { InvoiceStatusEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * Invoice Query Schema
 *
 * Schema for querying invoices with various filters, pagination, and sorting options.
 */
export const InvoiceQuerySchema = z.object({
    // Client filter
    clientId: ClientIdSchema.optional(),

    // Status filters
    status: z.union([InvoiceStatusEnumSchema, z.array(InvoiceStatusEnumSchema)]).optional(),

    // Invoice number filter (exact match or partial)
    invoiceNumber: z
        .string()
        .min(1, { message: 'zodError.invoice.query.invoiceNumber.min' })
        .optional(),

    // Date range filters
    issueDateFrom: z.coerce.date().optional(),
    issueDateTo: z.coerce.date().optional(),
    dueDateFrom: z.coerce.date().optional(),
    dueDateTo: z.coerce.date().optional(),

    // Amount range filters
    totalMin: z.number().nonnegative().optional(),
    totalMax: z.number().nonnegative().optional(),
    subtotalMin: z.number().nonnegative().optional(),
    subtotalMax: z.number().nonnegative().optional(),

    // Currency filter
    currency: PriceCurrencyEnumSchema.optional(),

    // Special filters
    isOverdue: z.boolean().optional(),
    isPaid: z.boolean().optional(),

    // Pagination and sorting
    ...PaginationSchema.shape,
    ...SortingSchema.extend({
        sortBy: z
            .enum([
                'issueDate',
                'dueDate',
                'total',
                'subtotal',
                'invoiceNumber',
                'status',
                'createdAt',
                'updatedAt'
            ])
            .default('issueDate')
    }).shape
});

/**
 * Invoice Search Schema
 *
 * Schema for full-text search across invoices with optional filters.
 */
export const InvoiceSearchSchema = InvoiceQuerySchema.extend({
    // Text search query
    q: z
        .string()
        .min(2, { message: 'zodError.invoice.search.query.min' })
        .max(200, { message: 'zodError.invoice.search.query.max' })
        .optional()
});

/**
 * Type exports for Invoice query operations
 */
export type InvoiceQuery = z.infer<typeof InvoiceQuerySchema>;
export type InvoiceSearch = z.infer<typeof InvoiceSearchSchema>;
