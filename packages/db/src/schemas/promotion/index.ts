/**
 * Promotion Schema Exports - Etapa 2.5: Grupo Promociones y Descuentos
 *
 * This module exports all promotion-related database schemas and types.
 * Includes PROMOTION, DISCOUNT_CODE, and DISCOUNT_CODE_USAGE tables.
 */

// Table exports
export {
    promotions,
    promotionRelations,
    type Promotion,
    type InsertPromotion
} from './promotion.dbschema.js';

export {
    discountCodes,
    discountCodeRelations,
    discountTypeEnum,
    type DiscountCode,
    type InsertDiscountCode
} from './discountCode.dbschema.js';

export {
    discountCodeUsages,
    discountCodeUsageRelations,
    type DiscountCodeUsage,
    type InsertDiscountCodeUsage
} from './discountCodeUsage.dbschema.js';
