import { z } from 'zod';
import { PurchaseCreateInputSchema, PurchaseUpdateInputSchema } from './purchase.crud.schema.js';
import { PurchaseQuerySchema } from './purchase.query.schema.js';

/**
 * HTTP coercion schema for purchase creation
 *
 * Handles HTTP-specific transformations like string-to-date conversion
 * for form data and query parameters.
 */
export const PurchaseCreateHttpSchema = PurchaseCreateInputSchema.extend({
    // HTTP date coercion for form inputs
    purchasedAt: z.coerce.date().default(() => new Date())
});

export type PurchaseCreateHttp = z.infer<typeof PurchaseCreateHttpSchema>;

/**
 * HTTP coercion schema for purchase updates
 *
 * Handles HTTP-specific transformations for update operations.
 */
export const PurchaseUpdateHttpSchema = PurchaseUpdateInputSchema;

export type PurchaseUpdateHttp = z.infer<typeof PurchaseUpdateHttpSchema>;

/**
 * HTTP coercion schema for purchase queries
 *
 * Handles URL query parameter coercion for filtering and searching.
 */
export const PurchaseQueryHttpSchema = PurchaseQuerySchema.extend({
    // Boolean coercion for query parameters
    includeDeleted: z
        .union([z.boolean(), z.string().transform((val) => val === 'true')])
        .default(false),

    // Number coercion for amount filtering
    amountFrom: z.coerce.number().optional(),
    amountTo: z.coerce.number().optional()
});

export type PurchaseQueryHttp = z.infer<typeof PurchaseQueryHttpSchema>;

/**
 * Path parameter schema for purchase operations
 *
 * Validates purchase ID in URL paths.
 */
export const PurchaseParamsSchema = z.object({
    id: z.string().uuid({
        message: 'zodError.purchase.id.invalidUuid'
    })
});

export type PurchaseParams = z.infer<typeof PurchaseParamsSchema>;
