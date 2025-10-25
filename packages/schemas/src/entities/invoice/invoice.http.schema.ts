import { z } from 'zod';
import { InvoiceStatusEnumSchema } from '../../enums/index.js';
import { CreateInvoiceSchema, UpdateInvoiceSchema } from './invoice.crud.schema.js';
import { InvoiceQuerySchema, InvoiceSearchSchema } from './invoice.query.schema.js';

/**
 * HTTP-safe coercion for amount strings to numbers
 */
const AmountCoercionSchema = z.coerce
    .number({
        message: 'zodError.invoice.amount.coercion.invalid'
    })
    .nonnegative({ message: 'zodError.invoice.amount.nonnegative' });

/**
 * HTTP-safe coercion for date strings to Date objects
 */
const DateCoercionSchema = z.coerce.date({
    message: 'zodError.invoice.date.coercion.invalid'
});

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
 * HTTP-safe coercion for status arrays from comma-separated strings
 */
const StatusArrayCoercionSchema = z.preprocess(
    (val) => {
        if (typeof val === 'string' && val.includes(',')) {
            return val.split(',').map((s) => s.trim());
        }
        return val;
    },
    z.union([InvoiceStatusEnumSchema, z.array(InvoiceStatusEnumSchema)])
);

/**
 * Invoice HTTP Query Schema
 *
 * Schema for handling invoice queries from HTTP requests with proper coercion.
 */
export const InvoiceHttpQuerySchema = InvoiceQuerySchema.extend({
    // Override amount fields with coercion
    totalMin: AmountCoercionSchema.optional(),
    totalMax: AmountCoercionSchema.optional(),
    subtotalMin: AmountCoercionSchema.optional(),
    subtotalMax: AmountCoercionSchema.optional(),

    // Override date fields with coercion
    issueDateFrom: DateCoercionSchema.optional(),
    issueDateTo: DateCoercionSchema.optional(),
    dueDateFrom: DateCoercionSchema.optional(),
    dueDateTo: DateCoercionSchema.optional(),

    // Override boolean fields with coercion
    isOverdue: BooleanCoercionSchema.optional(),
    isPaid: BooleanCoercionSchema.optional(),

    // Override status with array coercion
    status: StatusArrayCoercionSchema.optional(),

    // Override pagination with coercion
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10)
});

/**
 * Invoice HTTP Search Schema
 *
 * Schema for handling invoice search from HTTP requests with proper coercion.
 */
export const InvoiceHttpSearchSchema = InvoiceSearchSchema.extend({
    // Override amount fields with coercion
    totalMin: AmountCoercionSchema.optional(),
    totalMax: AmountCoercionSchema.optional(),
    subtotalMin: AmountCoercionSchema.optional(),
    subtotalMax: AmountCoercionSchema.optional(),

    // Override date fields with coercion
    issueDateFrom: DateCoercionSchema.optional(),
    issueDateTo: DateCoercionSchema.optional(),
    dueDateFrom: DateCoercionSchema.optional(),
    dueDateTo: DateCoercionSchema.optional(),

    // Override boolean fields with coercion
    isOverdue: BooleanCoercionSchema.optional(),
    isPaid: BooleanCoercionSchema.optional(),

    // Override status with array coercion
    status: StatusArrayCoercionSchema.optional(),

    // Override pagination with coercion
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10)
});

/**
 * Invoice HTTP Create Schema
 *
 * Schema for handling invoice creation from HTTP requests with proper coercion.
 */
export const InvoiceHttpCreateSchema = CreateInvoiceSchema.extend({
    // Override amount fields with coercion
    subtotal: AmountCoercionSchema,
    taxes: AmountCoercionSchema,
    total: AmountCoercionSchema,

    // Override date fields with coercion
    issueDate: DateCoercionSchema,
    dueDate: DateCoercionSchema
});

/**
 * Invoice HTTP Update Schema
 *
 * Schema for handling invoice updates from HTTP requests with proper coercion.
 */
export const InvoiceHttpUpdateSchema = UpdateInvoiceSchema.extend({
    // Override amount fields with coercion
    subtotal: AmountCoercionSchema.optional(),
    taxes: AmountCoercionSchema.optional(),
    total: AmountCoercionSchema.optional(),

    // Override date fields with coercion
    issueDate: DateCoercionSchema.optional(),
    dueDate: DateCoercionSchema.optional(),
    paidAt: DateCoercionSchema.optional()
});

/**
 * Type exports for Invoice HTTP operations
 */
export type InvoiceHttpQuery = z.infer<typeof InvoiceHttpQuerySchema>;
export type InvoiceHttpSearch = z.infer<typeof InvoiceHttpSearchSchema>;
export type InvoiceHttpCreate = z.infer<typeof InvoiceHttpCreateSchema>;
export type InvoiceHttpUpdate = z.infer<typeof InvoiceHttpUpdateSchema>;
