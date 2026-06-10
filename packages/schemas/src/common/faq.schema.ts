import { z } from 'zod';
import { BaseAuditFields } from './audit.schema.js';
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
