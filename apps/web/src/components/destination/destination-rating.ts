/**
 * @file destination-rating.ts
 * @description Shared constants and types for the destination review rating
 * form: the 18 rating dimensions, their default (es) labels, and the
 * collapsible category grouping used by the review dialog.
 *
 * The category grouping is UI-only — the API payload is always the flat
 * 18-dimension `rating` object (see DestinationReviewCreateBodySchema).
 */

export const RATING_KEYS = [
    'landscape',
    'attractions',
    'accessibility',
    'safety',
    'cleanliness',
    'hospitality',
    'culturalOffer',
    'gastronomy',
    'affordability',
    'nightlife',
    'infrastructure',
    'environmentalCare',
    'wifiAvailability',
    'shopping',
    'beaches',
    'greenSpaces',
    'localEvents',
    'weatherSatisfaction'
] as const;

export type RatingKey = (typeof RATING_KEYS)[number];
export type RatingState = Readonly<Record<RatingKey, number>>;

export const INITIAL_RATINGS: RatingState = {
    landscape: 0,
    attractions: 0,
    accessibility: 0,
    safety: 0,
    cleanliness: 0,
    hospitality: 0,
    culturalOffer: 0,
    gastronomy: 0,
    affordability: 0,
    nightlife: 0,
    infrastructure: 0,
    environmentalCare: 0,
    wifiAvailability: 0,
    shopping: 0,
    beaches: 0,
    greenSpaces: 0,
    localEvents: 0,
    weatherSatisfaction: 0
};

/** Fallback (es) labels for each dimension, mirroring the i18n keys
 *  `destination.rating.dimensions.*`. */
export const DEFAULT_LABELS: Record<RatingKey, string> = {
    landscape: 'Paisaje',
    attractions: 'Atracciones',
    accessibility: 'Accesibilidad',
    safety: 'Seguridad',
    cleanliness: 'Limpieza',
    hospitality: 'Hospitalidad',
    culturalOffer: 'Oferta cultural',
    gastronomy: 'Gastronomía',
    affordability: 'Relación precio-calidad',
    nightlife: 'Vida nocturna',
    infrastructure: 'Infraestructura',
    environmentalCare: 'Cuidado del entorno',
    wifiAvailability: 'Conectividad wifi',
    shopping: 'Compras',
    beaches: 'Playas',
    greenSpaces: 'Espacios verdes',
    localEvents: 'Eventos locales',
    weatherSatisfaction: 'Satisfacción climática'
};

export interface RatingCategory {
    /** i18n suffix under `destination.rating.categories.*`. */
    readonly key: string;
    /** Dimensions grouped under this category (covers all 18, no overlap). */
    readonly dims: readonly RatingKey[];
}

/** Collapsible category grouping for the review form (covers all 18 dims). */
export const RATING_CATEGORIES: readonly RatingCategory[] = [
    {
        key: 'nature',
        dims: ['landscape', 'beaches', 'greenSpaces', 'environmentalCare', 'weatherSatisfaction']
    },
    {
        key: 'cultureAttractions',
        dims: ['attractions', 'culturalOffer', 'localEvents', 'nightlife']
    },
    {
        key: 'foodShopping',
        dims: ['gastronomy', 'shopping']
    },
    {
        key: 'services',
        dims: ['infrastructure', 'accessibility', 'wifiAvailability']
    },
    {
        key: 'experienceSafety',
        dims: ['safety', 'cleanliness', 'hospitality', 'affordability']
    }
] as const;

/** Fallback (es) labels for each category, mirroring the i18n keys
 *  `destination.rating.categories.*`. */
export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
    nature: 'Naturaleza y paisaje',
    cultureAttractions: 'Atracciones y cultura',
    foodShopping: 'Gastronomía y compras',
    services: 'Servicios e infraestructura',
    experienceSafety: 'Experiencia y seguridad'
};
