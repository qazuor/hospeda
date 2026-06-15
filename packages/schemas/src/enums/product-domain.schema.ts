import { z } from 'zod';
import { ProductDomainEnum } from './product-domain.enum.js';

/**
 * Zod schema for {@link ProductDomainEnum} validation.
 * Accepts 'accommodation' or 'commerce'.
 */
export const ProductDomainEnumSchema = z.nativeEnum(ProductDomainEnum, {
    error: () => ({ message: 'zodError.enums.productDomain.invalid' })
});
export type ProductDomain = z.infer<typeof ProductDomainEnumSchema>;
