import { z } from 'zod';
import { InvoiceIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';

/**
 * Invoice Line Query Schema
 *
 * Schema for querying invoice lines with various filters, pagination, and sorting options.
 */
export const InvoiceLineQuerySchema = z.object({
    // Invoice filter
    invoiceId: InvoiceIdSchema.optional(),

    // Description search (partial match)
    description: z
        .string()
        .min(1, { message: 'zodError.invoiceLine.query.description.min' })
        .optional(),

    // Product reference filter
    productReference: z
        .string()
        .min(1, { message: 'zodError.invoiceLine.query.productReference.min' })
        .optional(),

    // Amount range filters
    totalMin: z.number().nonnegative().optional(),
    totalMax: z.number().nonnegative().optional(),
    unitPriceMin: z.number().nonnegative().optional(),
    unitPriceMax: z.number().nonnegative().optional(),

    // Quantity range filters
    quantityMin: z.number().positive().optional(),
    quantityMax: z.number().positive().optional(),

    // Tax filters
    hasTax: z.boolean().optional(),
    taxRateMin: z.number().nonnegative().optional(),
    taxRateMax: z.number().nonnegative().optional(),

    // Discount filters
    hasDiscount: z.boolean().optional(),

    // Pagination and sorting
    ...PaginationSchema.shape,
    ...SortingSchema.extend({
        sortBy: z
            .enum([
                'description',
                'quantity',
                'unitPrice',
                'total',
                'productReference',
                'createdAt',
                'updatedAt'
            ])
            .default('createdAt')
    }).shape
});

/**
 * Invoice Line Search Schema
 *
 * Schema for full-text search across invoice lines with optional filters.
 */
export const InvoiceLineSearchSchema = InvoiceLineQuerySchema.extend({
    // Text search query
    q: z
        .string()
        .min(2, { message: 'zodError.invoiceLine.search.query.min' })
        .max(200, { message: 'zodError.invoiceLine.search.query.max' })
        .optional()
});

/**
 * Type exports for Invoice Line query operations
 */
export type InvoiceLineQuery = z.infer<typeof InvoiceLineQuerySchema>;
export type InvoiceLineSearch = z.infer<typeof InvoiceLineSearchSchema>;
