import { z } from 'zod';
import { SuccessSchema } from '../../../api/result.schema.js';
import {
    BaseFaqPublicSchema,
    BaseFaqSchema,
    FaqCreatePayloadSchema,
    FaqReorderPayloadSchema,
    FaqUpdatePayloadSchema
} from '../../../common/faq.schema.js';

/**
 * Gastronomy FAQ Schema — FAQ entity belonging to a gastronomy listing.
 *
 * Mirrors `AccommodationFaqSchema`: extends the shared `BaseFaqSchema` with a
 * gastronomy-specific `id` and `gastronomyId` foreign key.
 * Relationship: 1 Gastronomy → N FAQs (1-to-N, not N-to-N).
 */
export const GastronomyFaqSchema = BaseFaqSchema.extend({
    /** FAQ entity ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The gastronomy listing this FAQ belongs to. */
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type for {@link GastronomyFaqSchema}. */
export type GastronomyFaq = z.infer<typeof GastronomyFaqSchema>;

// ----------------------------------------------------------------------------
// Public Access Schema (SPEC-210)
// ----------------------------------------------------------------------------

/**
 * Gastronomy FAQ Public Schema — safe subset for public API responses (SPEC-210).
 *
 * Field set: id, gastronomyId, question, answer, category, displayOrder.
 * Deliberately EXCLUDES audit fields (createdAt, updatedAt, createdById, updatedById,
 * deletedAt, deletedById), lifecycleState, and all internal metadata.
 * Used as the responseSchema for GET /api/v1/public/gastronomies/:gastronomyId/faqs.
 */
export const GastronomyFaqPublicSchema = BaseFaqPublicSchema.extend({
    /** FAQ entity ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The gastronomy listing this FAQ belongs to. */
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type for {@link GastronomyFaqPublicSchema}. */
export type GastronomyFaqPublic = z.infer<typeof GastronomyFaqPublicSchema>;

/**
 * Output schema for listing gastronomy FAQs — public variant (SPEC-210).
 * Replaces GastronomyFaqListOutputSchema on the public endpoint.
 */
export const GastronomyFaqPublicListOutputSchema = z.object({
    faqs: z.array(GastronomyFaqPublicSchema)
});
export type GastronomyFaqPublicListOutput = z.infer<typeof GastronomyFaqPublicListOutputSchema>;

// ----------------------------------------------------------------------------
// Command Input Schemas
// ----------------------------------------------------------------------------

/**
 * Input schema for adding a FAQ to a gastronomy listing.
 */
export const GastronomyFaqAddInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faq: FaqCreatePayloadSchema
});
export type GastronomyFaqAddInput = z.infer<typeof GastronomyFaqAddInputSchema>;

/**
 * Input schema for updating a FAQ on a gastronomy listing.
 */
export const GastronomyFaqUpdateInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faq: FaqUpdatePayloadSchema
});
export type GastronomyFaqUpdateInput = z.infer<typeof GastronomyFaqUpdateInputSchema>;

/**
 * Input schema for removing a FAQ from a gastronomy listing.
 */
export const GastronomyFaqRemoveInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type GastronomyFaqRemoveInput = z.infer<typeof GastronomyFaqRemoveInputSchema>;

/**
 * Input schema for listing FAQs on a gastronomy listing.
 */
export const GastronomyFaqListInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type GastronomyFaqListInput = z.infer<typeof GastronomyFaqListInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

/**
 * Output schema for a single gastronomy FAQ operation (add / update).
 */
export const GastronomyFaqSingleOutputSchema = z.object({
    faq: GastronomyFaqSchema
});
export type GastronomyFaqSingleOutput = z.infer<typeof GastronomyFaqSingleOutputSchema>;

/**
 * Output schema for listing gastronomy FAQs.
 */
export const GastronomyFaqListOutputSchema = z.object({
    faqs: z.array(GastronomyFaqSchema)
});
export type GastronomyFaqListOutput = z.infer<typeof GastronomyFaqListOutputSchema>;

/**
 * Output schema for removing a gastronomy FAQ.
 */
export const GastronomyFaqRemoveOutputSchema = SuccessSchema;

// ----------------------------------------------------------------------------
// Reorder Input Schema (mirrors SPEC-177 pattern)
// ----------------------------------------------------------------------------

/**
 * Service input schema for reordering FAQs on a gastronomy listing.
 * The service validates that all faqId values belong to the given gastronomy.
 */
export const GastronomyFaqReorderInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    order: FaqReorderPayloadSchema.shape.order
});
export type GastronomyFaqReorderInput = z.infer<typeof GastronomyFaqReorderInputSchema>;
