import { z } from 'zod';
import { ProductIdSchema } from '../../common/id.schema.js';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { ProductTypeEnumSchema } from '../../enums/product-type.schema.js';

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new product
 * Includes required fields with lifecycle defaults
 */
export const ProductCreateInputSchema = z.object({
    name: z
        .string()
        .min(1, { message: 'zodError.product.name.required' })
        .max(200, { message: 'zodError.product.name.max' }),
    type: ProductTypeEnumSchema,
    metadata: z.record(z.string(), z.any()).default({}),

    // Lifecycle field with default
    lifecycleState: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default(LifecycleStatusEnum.ACTIVE)
});

export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an existing product
 * All fields are optional for partial updates
 */
export const ProductUpdateInputSchema = ProductCreateInputSchema.partial();

export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>;

/**
 * Schema for updating a product with ID
 */
export const ProductUpdateWithIdSchema = z.object({
    id: ProductIdSchema,
    ...ProductUpdateInputSchema.shape
});

export type ProductUpdateWithId = z.infer<typeof ProductUpdateWithIdSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for deleting a product (soft delete)
 */
export const ProductDeleteSchema = z.object({
    id: ProductIdSchema
});

export type ProductDelete = z.infer<typeof ProductDeleteSchema>;

/**
 * Schema for restoring a deleted product
 */
export const ProductRestoreSchema = z.object({
    id: ProductIdSchema
});

export type ProductRestore = z.infer<typeof ProductRestoreSchema>;

/**
 * Schema for hard deleting a product (permanent)
 */
export const ProductHardDeleteSchema = z.object({
    id: ProductIdSchema
});

export type ProductHardDelete = z.infer<typeof ProductHardDeleteSchema>;

// ============================================================================
// BULK OPERATION SCHEMAS
// ============================================================================

/**
 * Schema for bulk creating products
 */
export const ProductBulkCreateInputSchema = z.object({
    items: z.array(ProductCreateInputSchema).min(1).max(100)
});

export type ProductBulkCreateInput = z.infer<typeof ProductBulkCreateInputSchema>;

/**
 * Schema for bulk updating products
 */
export const ProductBulkUpdateInputSchema = z.object({
    items: z.array(ProductUpdateWithIdSchema).min(1).max(100)
});

export type ProductBulkUpdateInput = z.infer<typeof ProductBulkUpdateInputSchema>;

/**
 * Schema for bulk deleting products
 */
export const ProductBulkDeleteSchema = z.object({
    ids: z.array(ProductIdSchema).min(1).max(100)
});

export type ProductBulkDelete = z.infer<typeof ProductBulkDeleteSchema>;
