import { z } from 'zod';
import { I18nTextSchema, TranslationMetaSchema } from './i18n.schema.js';

// ============================================================================
// CommerceIdentityFields — spread const for commerce listing identity fields.
//
// Mirrors the name/slug/summary/description/richDescription + *I18n + translationMeta
// pattern used in the accommodation entity schema (SPEC-239).
// ============================================================================

/**
 * Spread const containing the core identity fields for a commerce listing.
 *
 * Includes:
 * - `name` / `slug` / `summary` / `description` — required string fields.
 * - `richDescription` — optional markdown/rich-text description (nullable).
 * - `nameI18n`, `summaryI18n`, `descriptionI18n`, `richDescriptionI18n` —
 *   optional localized variants (JSONB, populated by AI translation service).
 * - `translationMeta` — per-field per-locale translation curation metadata.
 *
 * Use by spreading into a `z.object({})` declaration:
 *
 * @example
 * ```ts
 * const GastronomySchema = z.object({
 *   id: z.string().uuid(),
 *   ...CommerceIdentityFields,
 *   // ... other fields
 * });
 * ```
 */
export const CommerceIdentityFields = {
    /**
     * Display name of the commerce listing.
     * Required; between 2 and 100 characters.
     */
    name: z
        .string({ message: 'zodError.commerce.name.required' })
        .min(2, { message: 'zodError.commerce.name.min' })
        .max(100, { message: 'zodError.commerce.name.max' }),

    /**
     * URL-safe identifier for the commerce listing.
     * Required; between 2 and 100 characters; must follow slug format.
     */
    slug: z
        .string({ message: 'zodError.commerce.slug.required' })
        .min(2, { message: 'zodError.commerce.slug.min' })
        .max(100, { message: 'zodError.commerce.slug.max' }),

    /**
     * Short marketing summary of the commerce listing.
     * Required; between 10 and 300 characters.
     */
    summary: z
        .string({ message: 'zodError.commerce.summary.required' })
        .min(10, { message: 'zodError.commerce.summary.min' })
        .max(300, { message: 'zodError.commerce.summary.max' }),

    /**
     * Full description of the commerce listing.
     * Required; between 20 and 2000 characters.
     */
    description: z
        .string({ message: 'zodError.commerce.description.required' })
        .min(20, { message: 'zodError.commerce.description.min' })
        .max(2000, { message: 'zodError.commerce.description.max' }),

    /**
     * Rich-text (markdown) variant of the description.
     * Optional; only available when the owning COMMERCE_OWNER has the
     * `CAN_USE_RICH_DESCRIPTION` entitlement. Nullable because existing rows
     * pre-feature will be NULL.
     */
    richDescription: z
        .string()
        .max(5000, { message: 'zodError.commerce.richDescription.max' })
        .nullish(),

    // -----------------------------------------------------------------------
    // SPEC-212 multi-language field variants (populated by AI translation).
    // All are optional/nullish — absent means the translation has not yet been
    // generated or is not applicable.
    // -----------------------------------------------------------------------

    /** Localized name in Spanish, English, and Portuguese. */
    nameI18n: I18nTextSchema.nullish(),

    /** Localized summary in Spanish, English, and Portuguese. */
    summaryI18n: I18nTextSchema.nullish(),

    /** Localized description in Spanish, English, and Portuguese. */
    descriptionI18n: I18nTextSchema.nullish(),

    /** Localized rich-text description in Spanish, English, and Portuguese. */
    richDescriptionI18n: I18nTextSchema.nullish(),

    /**
     * Per-field, per-locale translation curation metadata (SPEC-212).
     * Internal: exposed on admin responses only, never on public payloads.
     */
    translationMeta: TranslationMetaSchema.nullish()
} as const;
