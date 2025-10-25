import { z } from 'zod';
import { CreateInvoiceLineSchema, UpdateInvoiceLineSchema } from './invoiceLine.crud.schema.js';
import { InvoiceLineQuerySchema, InvoiceLineSearchSchema } from './invoiceLine.query.schema.js';

/**
 * HTTP-safe coercion for amount strings to numbers
 */
const AmountCoercionSchema = z.coerce
    .number({
        message: 'zodError.invoiceLine.amount.coercion.invalid'
    })
    .nonnegative({ message: 'zodError.invoiceLine.amount.nonnegative' });

/**
 * HTTP-safe coercion for positive numbers (quantity)
 */
const PositiveNumberCoercionSchema = z.coerce
    .number({
        message: 'zodError.invoiceLine.quantity.coercion.invalid'
    })
    .positive({ message: 'zodError.invoiceLine.quantity.positive' });

/**
 * HTTP-safe coercion for boolean strings to booleans
 */
const BooleanCoercionSchema = z.preprocess((val) => {
    if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
        // Return the string as-is to let zod validation fail
        return val;
    }
    return val;
}, z.boolean());

/**
 * Invoice Line HTTP Query Schema
 *
 * Schema for handling invoice line queries from HTTP requests with proper coercion.
 */
export const InvoiceLineHttpQuerySchema = InvoiceLineQuerySchema.extend({
    // Override amount fields with coercion
    totalMin: AmountCoercionSchema.optional(),
    totalMax: AmountCoercionSchema.optional(),
    unitPriceMin: AmountCoercionSchema.optional(),
    unitPriceMax: AmountCoercionSchema.optional(),

    // Override quantity fields with coercion
    quantityMin: PositiveNumberCoercionSchema.optional(),
    quantityMax: PositiveNumberCoercionSchema.optional(),

    // Override tax rate fields with coercion
    taxRateMin: AmountCoercionSchema.optional(),
    taxRateMax: AmountCoercionSchema.optional(),

    // Override boolean fields with coercion
    hasTax: BooleanCoercionSchema.optional(),
    hasDiscount: BooleanCoercionSchema.optional(),

    // Override pagination with coercion
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10)
});

/**
 * Invoice Line HTTP Search Schema
 *
 * Schema for handling invoice line search from HTTP requests with proper coercion.
 */
export const InvoiceLineHttpSearchSchema = InvoiceLineSearchSchema.extend({
    // Override amount fields with coercion
    totalMin: AmountCoercionSchema.optional(),
    totalMax: AmountCoercionSchema.optional(),
    unitPriceMin: AmountCoercionSchema.optional(),
    unitPriceMax: AmountCoercionSchema.optional(),

    // Override quantity fields with coercion
    quantityMin: PositiveNumberCoercionSchema.optional(),
    quantityMax: PositiveNumberCoercionSchema.optional(),

    // Override tax rate fields with coercion
    taxRateMin: AmountCoercionSchema.optional(),
    taxRateMax: AmountCoercionSchema.optional(),

    // Override boolean fields with coercion
    hasTax: BooleanCoercionSchema.optional(),
    hasDiscount: BooleanCoercionSchema.optional(),

    // Override pagination with coercion
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10)
});

/**
 * Invoice Line HTTP Create Schema
 *
 * Schema for handling invoice line creation from HTTP requests with proper coercion.
 */
export const InvoiceLineHttpCreateSchema = CreateInvoiceLineSchema.extend({
    // Override amount fields with coercion
    quantity: PositiveNumberCoercionSchema,
    unitPrice: AmountCoercionSchema,
    total: AmountCoercionSchema,
    taxAmount: AmountCoercionSchema.optional(),
    taxRate: AmountCoercionSchema.optional(),
    discountAmount: AmountCoercionSchema.optional()
});

/**
 * Invoice Line HTTP Update Schema
 *
 * Schema for handling invoice line updates from HTTP requests with proper coercion.
 */
export const InvoiceLineHttpUpdateSchema = UpdateInvoiceLineSchema.extend({
    // Override amount fields with coercion
    quantity: PositiveNumberCoercionSchema.optional(),
    unitPrice: AmountCoercionSchema.optional(),
    total: AmountCoercionSchema.optional(),
    taxAmount: AmountCoercionSchema.optional(),
    taxRate: AmountCoercionSchema.optional(),
    discountAmount: AmountCoercionSchema.optional()
});

/**
 * Type exports for Invoice Line HTTP operations
 */
export type InvoiceLineHttpQuery = z.infer<typeof InvoiceLineHttpQuerySchema>;
export type InvoiceLineHttpSearch = z.infer<typeof InvoiceLineHttpSearchSchema>;
export type InvoiceLineHttpCreate = z.infer<typeof InvoiceLineHttpCreateSchema>;
export type InvoiceLineHttpUpdate = z.infer<typeof InvoiceLineHttpUpdateSchema>;
