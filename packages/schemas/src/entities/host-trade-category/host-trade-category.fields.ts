import { z } from 'zod';
import { I18nTextSchema } from '../../common/i18n.schema.js';

/**
 * Shared field definitions for the provider trade category catalog (HOS-919).
 *
 * Both catalog tables (`host_trade_category_groups` and `host_trade_categories`)
 * use the same slug, display-name and ordering rules, so they live here once.
 */

/** Maximum related words per locale on one category. */
export const HOST_TRADE_CATEGORY_MAX_KEYWORDS_PER_LOCALE = 30;

/** Maximum length of one related word. */
export const HOST_TRADE_CATEGORY_MAX_KEYWORD_LENGTH = 40;

/**
 * Catalog slug: kebab-case machine identifier (`destapaciones-desagotes`).
 * Immutable once created (spec D8) because alliance leads store slugs.
 */
export const HostTradeCatalogSlugSchema = z
    .string({ message: 'zodError.hostTradeCategory.slug.required' })
    .min(3, { message: 'zodError.hostTradeCategory.slug.min' })
    .max(100, { message: 'zodError.hostTradeCategory.slug.max' })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'zodError.hostTradeCategory.slug.pattern'
    });

/**
 * Display name in the three locales. Spanish must be non-blank: it is the
 * fallback every consumer uses when a locale is empty.
 */
export const HostTradeCatalogNameSchema = I18nTextSchema.refine(
    (value) => value.es.trim().length > 0,
    { message: 'zodError.hostTradeCategory.nameI18n.esRequired', path: ['es'] }
);

/** Ordering weight: lower renders first. */
export const HostTradeCatalogDisplayWeightSchema = z
    .number({ message: 'zodError.hostTradeCategory.displayWeight.required' })
    .int({ message: 'zodError.hostTradeCategory.displayWeight.int' })
    .min(1, { message: 'zodError.hostTradeCategory.displayWeight.min' })
    .max(1000, { message: 'zodError.hostTradeCategory.displayWeight.max' })
    .default(50);

/** One related word: lowercase, 1..40 chars. */
const KeywordSchema = z
    .string({ message: 'zodError.hostTradeCategory.keywordsI18n.required' })
    .trim()
    .min(1, { message: 'zodError.hostTradeCategory.keywordsI18n.min' })
    .max(HOST_TRADE_CATEGORY_MAX_KEYWORD_LENGTH, {
        message: 'zodError.hostTradeCategory.keywordsI18n.max'
    })
    .refine((value) => value === value.toLowerCase(), {
        message: 'zodError.hostTradeCategory.keywordsI18n.lowercase'
    });

const KeywordListSchema = z
    .array(KeywordSchema)
    .max(HOST_TRADE_CATEGORY_MAX_KEYWORDS_PER_LOCALE, {
        message: 'zodError.hostTradeCategory.keywordsI18n.tooMany'
    })
    .optional();

/**
 * Related words per locale, used by the selector search to match a category
 * by something other than its name (e.g. «pozo» finds the drain category).
 * Unknown locales are rejected.
 */
export const HostTradeCategoryKeywordsSchema = z
    .object({
        es: KeywordListSchema,
        en: KeywordListSchema,
        pt: KeywordListSchema
    })
    .strict();

export type HostTradeCategoryKeywords = z.infer<typeof HostTradeCategoryKeywordsSchema>;
