/**
 * Promotion Schema Exports - Etapa 2.5: Grupo Promociones y Descuentos
 *
 * This module exports all promotion-related database schemas and types.
 * Includes PROMOTION, DISCOUNT_CODE, and DISCOUNT_CODE_USAGE tables.
 */

// Table exports
export {
    promotionRelations,
    promotions,
    type InsertPromotion,
    type Promotion
} from './promotion.dbschema.js';

export {
    discountCodeRelations,
    discountCodes,
    type DiscountCode,
    type InsertDiscountCode
} from './discountCode.dbschema.js';

export {
    discountCodeUsageRelations,
    discountCodeUsages,
    type DiscountCodeUsage,
    type InsertDiscountCodeUsage
} from './discountCodeUsage.dbschema.js';
