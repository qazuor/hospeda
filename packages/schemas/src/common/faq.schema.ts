import { z } from 'zod';
import { BaseAuditFields } from './audit.schema.js';
import { i18nText } from './i18n.schema.js';
import { IdSchema } from './id.schema.js';
import { BaseLifecycleFields } from './lifecycle.schema.js';

/**
 * Base FAQ Schema - Common structure for FAQ entries
 *
 * This schema can be extended by specific entities (accommodation, destination, etc.)
 * to create their own FAQ schemas with the appropriate ID field.
 */
export const BaseFaqSchema = z.object({
    // Base fields
    ...BaseAuditFields,
    ...BaseLifecycleFields,

    // FAQ-specific fields
    question: z
        .string({
            message: 'zodError.common.faq.question.required'
        })
        .min(10, { message: 'zodError.common.faq.question.min' })
        .max(300, { message: 'zodError.common.faq.question.max' }),

    answer: z
        .string({
            message: 'zodError.common.faq.answer.required'
        })
        .min(10, { message: 'zodError.common.faq.answer.min' })
        .max(2000, { message: 'zodError.common.faq.answer.max' }),

    /**
     * Localized question ({es,en,pt}). Additive/nullable (HOS-117): the legacy `question`
     * field remains the `es` fallback source. Read paths resolve this via resolveI18nText
     * with `question` as the fallback. Same length bounds as the legacy field.
     */
    questionI18n: i18nText({ min: 10, max: 300 }).nullish(),

    /**
     * Localized answer ({es,en,pt}). Additive/nullable (HOS-117): the legacy `answer`
     * field remains the `es` fallback source. Read paths resolve this via resolveI18nText
     * with `answer` as the fallback. Same length bounds as the legacy field.
     */
    answerI18n: i18nText({ min: 10, max: 2000 }).nullish(),

    // Use .nullish() (not .optional()) because Drizzle returns `null` for unset columns.
    category: z
        .string({
            message: 'zodError.common.faq.category.required'
        })
        .min(2, { message: 'zodError.common.faq.category.min' })
        .max(100, { message: 'zodError.common.faq.category.max' })
        .nullish(),

    /**
     * Display order for this FAQ within its parent entity. Nullable because the column
     * was added additively (SPEC-177); existing rows are backfilled by migration.
     * Non-negative integer; lower values appear first.
     */
    displayOrder: z.number().int().nonnegative().nullish()
});
export type BaseFaqType = z.infer<typeof BaseFaqSchema>;

/**
 * Channel-visibility fields (HOS-393).
 *
 * Deliberately NOT part of {@link BaseFaqSchema}. All four FAQ tables
 * (`accommodation_faqs`, `destination_faqs`, `gastronomy_faqs`,
 * `experience_faqs`) extend that base, but only accommodation FAQs carry these
 * flags today: `isUsableByAi` is inert where there is no AI chat, and the chat
 * currently exists only on accommodations.
 *
 * Kept as a shared fragment from day one so HOS-400 (AI chat for gastronomy and
 * experiences) can adopt it by spreading it into those schemas, rather than
 * copy-pasting the field definitions.
 *
 * Both default to `true`: a FAQ created without saying otherwise behaves exactly
 * as every FAQ did before these flags existed.
 */
export const FaqChannelVisibilityFields = {
    /**
     * Whether the FAQ appears on the entity's public page (accordion, FAQ
     * sections and `FAQPage` JSON-LD). Enforced server-side — a FAQ with this
     * off never leaves the API in a public payload.
     */
    isVisibleOnListing: z.boolean().default(true),

    /**
     * Whether the FAQ may be used by the AI chat to answer questions. Enforced
     * where the prompt is assembled, before the context cap is applied.
     *
     * Note this is not confidentiality: a FAQ that is AI-usable but not public
     * will still be spoken aloud by the assistant to anyone who asks.
     */
    isUsableByAi: z.boolean().default(true)
} as const;
export type FaqChannelVisibilityFieldsType = typeof FaqChannelVisibilityFields;

/**
 * FAQ creation payload schema: only the core FAQ fields without audit/lifecycle fields
 */
export const FaqCreatePayloadSchema = BaseFaqSchema.pick({
    question: true,
    answer: true,
    category: true
});
export type FaqCreatePayloadType = z.infer<typeof FaqCreatePayloadSchema>;

/**
 * FAQ update payload schema: partial of the create payload
 */
export const FaqUpdatePayloadSchema = FaqCreatePayloadSchema.partial();
export type FaqUpdatePayloadType = z.infer<typeof FaqUpdatePayloadSchema>;

/**
 * Create payload for a FAQ that carries channel-visibility flags (HOS-393).
 *
 * Both flags are optional on the wire and default to `true`, so an existing
 * client that does not know about them keeps producing valid payloads.
 */
export const FaqWithChannelVisibilityCreatePayloadSchema = FaqCreatePayloadSchema.extend({
    isVisibleOnListing: FaqChannelVisibilityFields.isVisibleOnListing.optional(),
    isUsableByAi: FaqChannelVisibilityFields.isUsableByAi.optional()
});
export type FaqWithChannelVisibilityCreatePayloadType = z.infer<
    typeof FaqWithChannelVisibilityCreatePayloadSchema
>;

/**
 * Update payload counterpart of {@link FaqWithChannelVisibilityCreatePayloadSchema}.
 *
 * Built from {@link FaqUpdatePayloadSchema} (the plain `.partial()` of the base
 * create payload, with NO defaults) rather than
 * `FaqWithChannelVisibilityCreatePayloadSchema.partial()`. That would look
 * equivalent but is not: Zod's `.default()` fires whenever a field is absent
 * from the input, REGARDLESS of how many `.optional()`/`.partial()` wrappers
 * surround it — so `.partial()` on the create schema would silently inject
 * `isVisibleOnListing: true, isUsableByAi: true` into every update payload
 * that does not explicitly resend them, resetting a FAQ's flags to their
 * defaults on any partial edit (e.g. editing only the question text). Both
 * flags here are `.optional()` with NO `.default()`, so omitting them on
 * update means "leave unchanged," matching true partial-update semantics.
 */
export const FaqWithChannelVisibilityUpdatePayloadSchema = FaqUpdatePayloadSchema.extend({
    isVisibleOnListing: z.boolean().optional(),
    isUsableByAi: z.boolean().optional()
});
export type FaqWithChannelVisibilityUpdatePayloadType = z.infer<
    typeof FaqWithChannelVisibilityUpdatePayloadSchema
>;

/**
 * Base FAQ Public Schema — safe subset for public API responses (SPEC-210).
 *
 * Picks ONLY the display fields from BaseFaqSchema.
 * Intentionally EXCLUDES all audit fields (createdAt, updatedAt, createdById,
 * updatedById, deletedAt, deletedById), lifecycle state, and any internal metadata.
 * Consumers should NEVER rely on the excluded fields being present.
 *
 * Per-entity public schemas (ExperienceFaqPublicSchema, GastronomyFaqPublicSchema)
 * extend this with their own `id` and parent FK field.
 */
export const BaseFaqPublicSchema = BaseFaqSchema.pick({
    question: true,
    answer: true,
    questionI18n: true,
    answerI18n: true,
    category: true,
    displayOrder: true
});
export type BaseFaqPublic = z.infer<typeof BaseFaqPublicSchema>;

/**
 * FAQ fields (using BaseFaqSchema structure)
 */
export const FaqFields = {
    faq: BaseFaqSchema.optional()
} as const;
export type FaqFieldsType = typeof FaqFields;

/**
 * Single item within a reorder payload: pairs a FAQ id with its new display order.
 */
export const FaqReorderItemSchema = z.object({
    faqId: IdSchema,
    displayOrder: z.number().int().nonnegative()
});
export type FaqReorderItem = z.infer<typeof FaqReorderItemSchema>;

/**
 * Payload for the PATCH .../faqs/reorder endpoint (SPEC-177).
 * Carries the new desired display order for a set of FAQs belonging to a parent entity.
 * Must contain at least one item; the service validates that all faqId values belong to
 * the requested parent.
 */
export const FaqReorderPayloadSchema = z.object({
    order: z.array(FaqReorderItemSchema).min(1)
});
export type FaqReorderPayload = z.infer<typeof FaqReorderPayloadSchema>;

/**
 * Baseline FAQ category suggestions seeded into the admin category combobox (SPEC-158 baseline).
 * These cover the four canonical destination FAQ topics; free-text custom categories are still
 * allowed — this const only pre-populates the combobox suggestions.
 */
export const FAQ_BASELINE_CATEGORIES = [
    'Cómo llegar',
    'Qué hacer',
    'Cuándo visitar',
    'Servicios'
] as const;
export type FaqBaselineCategory = (typeof FAQ_BASELINE_CATEGORIES)[number];
