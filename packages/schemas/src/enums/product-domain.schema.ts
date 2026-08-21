import { z } from 'zod';
import { ProductDomainEnum } from './product-domain.enum.js';

/**
 * Zod schema for {@link ProductDomainEnum} validation.
 *
 * Accepts every member of the enum — `z.nativeEnum` derives from it, so this
 * schema widens with the vocabulary and never needs restating. Do not replace
 * it with a hand-written `z.enum([...])`: a restated literal list is exactly
 * the drift `scripts/check-product-domain-vocabulary.sh` exists to catch.
 */
export const ProductDomainEnumSchema = z.nativeEnum(ProductDomainEnum, {
    error: () => ({ message: 'zodError.enums.productDomain.invalid' })
});
export type ProductDomain = z.infer<typeof ProductDomainEnumSchema>;

/**
 * The enum's values as plain string literals.
 *
 * Use this — not {@link ProductDomain} — to type anything a caller passes a
 * literal to. `ProductDomain` is the *enum* type, and TypeScript rejects
 * `'commerce'` where an enum member is expected, so typing a prop or a query
 * field with it would break every existing call site. The template-literal form
 * accepts both a raw literal and an enum member, and still widens automatically
 * when the vocabulary grows (HOS-685).
 */
export type ProductDomainValue = `${ProductDomainEnum}`;
