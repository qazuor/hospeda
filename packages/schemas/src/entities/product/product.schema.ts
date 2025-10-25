import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ProductIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { ProductTypeEnumSchema } from '../../enums/product-type.schema.js';

/**
 * Product Schema - Business Model Catalog Entity
 *
 * This schema defines the complete structure of a Product entity
 * using base field objects for consistency and maintainability.
 */
export const ProductSchema = z.object({
    // Base fields
    id: ProductIdSchema,
    ...BaseAuditFields,

    // Entity fields - specific to product
    name: z
        .string()
        .min(1, { message: 'zodError.product.name.required' })
        .max(200, { message: 'zodError.product.name.max' }),
    type: ProductTypeEnumSchema,
    description: z.string().optional(),
    metadata: z.record(z.string(), z.any()).default({}),

    // Base field groups
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Status fields
    isActive: z.boolean().default(true),
    isDeleted: z.boolean().default(false)
});

export type Product = z.infer<typeof ProductSchema>;
