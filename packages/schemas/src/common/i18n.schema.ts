import { z } from 'zod';

// ============================================================================
// SHARED I18N TEXT SCHEMA
// Single source of truth for localized text fields across the platform.
// Supported locales: es (Spanish), en (English), pt (Portuguese).
// ============================================================================

/**
 * Input contract for the i18nText factory.
 * Callers set their own per-field string length bounds.
 */
export interface I18nTextOptions {
    /** Minimum string length applied to each locale field. */
    readonly min: number;
    /** Maximum string length applied to each locale field. */
    readonly max: number;
}

/**
 * Base localized-text schema with no length constraints.
 *
 * Use this type reference when you only need the shape (`{ es, en, pt }`)
 * without additional length validation — for example in DB-layer `$type<>`
 * annotations or when writing generic helpers that accept any I18nText.
 *
 * For validated input schemas prefer the `i18nText({ min, max })` factory.
 *
 * @example
 * // DB column type annotation
 * name: jsonb('name').$type<I18nText>().notNull()
 *
 * @example
 * // Zod schema usage
 * const schema = z.object({ label: I18nTextSchema });
 */
export const I18nTextSchema = z.object({
    /** Spanish locale text. */
    es: z.string(),
    /** English locale text. */
    en: z.string(),
    /** Portuguese locale text. */
    pt: z.string()
});

/**
 * TypeScript type inferred from {@link I18nTextSchema}.
 * Represents a required localized-text value with all three locales.
 */
export type I18nText = z.infer<typeof I18nTextSchema>;

/**
 * Factory that returns a localized-text Zod schema with per-field string
 * length bounds applied to every locale (`es`, `en`, `pt`).
 *
 * This is the preferred way to define i18n text fields in entity schemas,
 * because it lets each entity declare the appropriate length constraints
 * without duplicating the `z.object({ es, en, pt })` boilerplate.
 *
 * @param options - RO-RO input with `min` and `max` string lengths.
 * @returns A Zod object schema `{ es: z.string().min(min).max(max), ... }`
 *
 * @example
 * // Entity schema field — required localized name
 * name: i18nText({ min: 2, max: 100 })
 *
 * @example
 * // Entity schema field — nullable localized description
 * description: i18nText({ min: 10, max: 500 }).nullish()
 */
export const i18nText = ({ min, max }: I18nTextOptions) =>
    z.object({
        /** Spanish locale text. */
        es: z.string().min(min).max(max),
        /** English locale text. */
        en: z.string().min(min).max(max),
        /** Portuguese locale text. */
        pt: z.string().min(min).max(max)
    });
