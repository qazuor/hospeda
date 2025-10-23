import { z } from 'zod';
import { ProductTypeEnum } from './product-type.enum.js';

/**
 * Product type enum schema for validation
 */
export const ProductTypeEnumSchema = z.nativeEnum(ProductTypeEnum, {
    message: 'zodError.enums.productType.invalid'
});
export type ProductTypeSchema = z.infer<typeof ProductTypeEnumSchema>;
