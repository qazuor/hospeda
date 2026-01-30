/**
 * Promo code condition type
 */
export type PromoCodeConditionType =
    | 'plan_restriction'
    | 'min_duration'
    | 'new_user_only'
    | 'category_restriction';

/**
 * Promo code definition
 */
export interface PromoCodeDefinition {
    /** The promo code string (uppercase) */
    code: string;
    /** Description of the promo code */
    description: string;
    /** Discount percentage (0-100) */
    discountPercent: number;
    /** Whether the discount is permanent or first period only */
    isPermanent: boolean;
    /** Number of billing cycles the discount applies (null = forever) */
    durationCycles: number | null;
    /** Maximum number of times this code can be used (null = unlimited) */
    maxRedemptions: number | null;
    /** Expiry date (null = never expires) */
    expiresAt: Date | null;
    /** Plan slugs this code is restricted to (null = all plans) */
    restrictedToPlans: string[] | null;
    /** Whether only new users can use this code */
    newUserOnly: boolean;
    /** Whether the code is currently active */
    isActive: boolean;
}

// ─── DEFAULT PROMO CODES ───────────────────────────────────────

export const HOSPEDA_FREE_CODE: PromoCodeDefinition = {
    code: 'HOSPEDA_FREE',
    description: 'Acceso gratuito permanente a la plataforma. Uso interno.',
    discountPercent: 100,
    isPermanent: true,
    durationCycles: null,
    maxRedemptions: null,
    expiresAt: null,
    restrictedToPlans: null,
    newUserOnly: false,
    isActive: true
};

export const LANZAMIENTO_50_CODE: PromoCodeDefinition = {
    code: 'LANZAMIENTO50',
    description: '50% de descuento por lanzamiento. Primeros 3 meses.',
    discountPercent: 50,
    isPermanent: false,
    durationCycles: 3,
    maxRedemptions: 100,
    expiresAt: null,
    restrictedToPlans: null,
    newUserOnly: true,
    isActive: true
};

export const BIENVENIDO_30_CODE: PromoCodeDefinition = {
    code: 'BIENVENIDO30',
    description: '30% de descuento para nuevos usuarios. Primer mes.',
    discountPercent: 30,
    isPermanent: false,
    durationCycles: 1,
    maxRedemptions: 500,
    expiresAt: null,
    restrictedToPlans: null,
    newUserOnly: true,
    isActive: true
};

/** All default promo codes to seed */
export const DEFAULT_PROMO_CODES: PromoCodeDefinition[] = [
    HOSPEDA_FREE_CODE,
    LANZAMIENTO_50_CODE,
    BIENVENIDO_30_CODE
];
