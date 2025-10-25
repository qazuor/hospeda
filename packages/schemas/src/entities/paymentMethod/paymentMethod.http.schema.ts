import { z } from 'zod';
import { PaymentMethodEnumSchema } from '../../enums/index.js';
import {
    CreatePaymentMethodSchema,
    UpdatePaymentMethodSchema
} from './paymentMethod.crud.schema.js';
import {
    PaymentMethodQuerySchema,
    PaymentMethodSearchSchema
} from './paymentMethod.query.schema.js';

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
 * HTTP-safe coercion for type arrays from comma-separated strings
 */
const TypeArrayCoercionSchema = z.preprocess(
    (val) => {
        if (typeof val === 'string' && val.includes(',')) {
            return val.split(',').map((s) => s.trim());
        }
        return val;
    },
    z.union([PaymentMethodEnumSchema, z.array(PaymentMethodEnumSchema)])
);

/**
 * HTTP-safe coercion for number strings to numbers
 */
const NumberCoercionSchema = z.coerce
    .number({
        message: 'zodError.paymentMethod.number.coercion.invalid'
    })
    .int();

/**
 * Payment Method HTTP Query Schema
 *
 * Schema for handling payment method queries from HTTP requests with proper coercion.
 */
export const PaymentMethodHttpQuerySchema = PaymentMethodQuerySchema.extend({
    // Override type with array coercion
    type: TypeArrayCoercionSchema.optional(),

    // Override boolean fields with coercion
    isDefault: BooleanCoercionSchema.optional(),
    isActive: BooleanCoercionSchema.optional(),

    // Override pagination with coercion
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10)
});

/**
 * Payment Method HTTP Search Schema
 *
 * Schema for handling payment method search from HTTP requests with proper coercion.
 */
export const PaymentMethodHttpSearchSchema = PaymentMethodSearchSchema.extend({
    // Override type with array coercion
    type: TypeArrayCoercionSchema.optional(),

    // Override boolean fields with coercion
    isDefault: BooleanCoercionSchema.optional(),
    isActive: BooleanCoercionSchema.optional(),

    // Override pagination with coercion
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10)
});

/**
 * Payment Method HTTP Create Schema
 *
 * Schema for handling payment method creation from HTTP requests with proper coercion.
 */
export const PaymentMethodHttpCreateSchema = CreatePaymentMethodSchema.extend({
    // Override boolean fields with coercion
    isDefault: BooleanCoercionSchema.default(false),
    isActive: BooleanCoercionSchema.default(true),

    // Override number fields with coercion
    cardExpiryMonth: NumberCoercionSchema.optional(),
    cardExpiryYear: NumberCoercionSchema.optional()
});

/**
 * Payment Method HTTP Update Schema
 *
 * Schema for handling payment method updates from HTTP requests with proper coercion.
 */
export const PaymentMethodHttpUpdateSchema = UpdatePaymentMethodSchema.extend({
    // Override boolean fields with coercion
    isDefault: BooleanCoercionSchema.optional(),
    isActive: BooleanCoercionSchema.optional(),

    // Override number fields with coercion
    cardExpiryMonth: NumberCoercionSchema.optional(),
    cardExpiryYear: NumberCoercionSchema.optional()
});

/**
 * Type exports for Payment Method HTTP operations
 */
export type PaymentMethodHttpQuery = z.infer<typeof PaymentMethodHttpQuerySchema>;
export type PaymentMethodHttpSearch = z.infer<typeof PaymentMethodHttpSearchSchema>;
export type PaymentMethodHttpCreate = z.infer<typeof PaymentMethodHttpCreateSchema>;
export type PaymentMethodHttpUpdate = z.infer<typeof PaymentMethodHttpUpdateSchema>;
