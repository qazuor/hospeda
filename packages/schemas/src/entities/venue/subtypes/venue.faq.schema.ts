import { z } from 'zod';
import { SuccessSchema } from '../../../api/result.schema.js';
import {
    BaseFaqPublicSchema,
    BaseFaqSchema,
    FaqChannelVisibilityFields,
    FaqReorderPayloadSchema,
    FaqWithChannelVisibilityCreatePayloadSchema,
    FaqWithChannelVisibilityUpdatePayloadSchema
} from '../../../common/faq.schema.js';

/**
 * Gastronomy FAQ Schema — FAQ entity belonging to a gastronomy listing.
 *
 * Mirrors `AccommodationFaqSchema`: extends the shared `BaseFaqSchema` with a
 * gastronomy-specific `id` and `gastronomyId` foreign key.
 * Relationship: 1 Gastronomy → N FAQs (1-to-N, not N-to-N).
 */
export const VenueFaqSchema = BaseFaqSchema.extend({
    /** FAQ entity ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The gastronomy listing this FAQ belongs to. */
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // HOS-400: channel visibility, adopting the HOS-393 fragment. Required-with-default
    // on read — the DB columns are NOT NULL DEFAULT true, so a row always has a value.
    ...FaqChannelVisibilityFields
});

/** TypeScript type for {@link VenueFaqSchema}. */
export type VenueFaq = z.infer<typeof VenueFaqSchema>;

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
export const VenueFaqPublicSchema = BaseFaqPublicSchema.extend({
    /** FAQ entity ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The gastronomy listing this FAQ belongs to. */
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type for {@link VenueFaqPublicSchema}. */
export type VenueFaqPublic = z.infer<typeof VenueFaqPublicSchema>;

/**
 * Output schema for listing gastronomy FAQs — public variant (SPEC-210).
 * Replaces GastronomyFaqListOutputSchema on the public endpoint.
 */
export const VenueFaqPublicListOutputSchema = z.object({
    faqs: z.array(VenueFaqPublicSchema)
});
export type VenueFaqPublicListOutput = z.infer<typeof VenueFaqPublicListOutputSchema>;

// ----------------------------------------------------------------------------
// Command Input Schemas
// ----------------------------------------------------------------------------

/**
 * Input schema for adding a FAQ to a gastronomy listing.
 */
export const VenueFaqAddInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faq: FaqWithChannelVisibilityCreatePayloadSchema
});
export type VenueFaqAddInput = z.infer<typeof VenueFaqAddInputSchema>;

/**
 * Input schema for updating a FAQ on a gastronomy listing.
 */
export const VenueFaqUpdateInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faq: FaqWithChannelVisibilityUpdatePayloadSchema
});
export type VenueFaqUpdateInput = z.infer<typeof VenueFaqUpdateInputSchema>;

/**
 * Input schema for removing a FAQ from a gastronomy listing.
 */
export const VenueFaqRemoveInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type VenueFaqRemoveInput = z.infer<typeof VenueFaqRemoveInputSchema>;

/**
 * Input schema for listing FAQs on a gastronomy listing.
 */
export const VenueFaqListInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type VenueFaqListInput = z.infer<typeof VenueFaqListInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

/**
 * Output schema for a single gastronomy FAQ operation (add / update).
 */
export const VenueFaqSingleOutputSchema = z.object({
    faq: VenueFaqSchema
});
export type VenueFaqSingleOutput = z.infer<typeof VenueFaqSingleOutputSchema>;

/**
 * Output schema for listing gastronomy FAQs.
 */
export const VenueFaqListOutputSchema = z.object({
    faqs: z.array(VenueFaqSchema)
});
export type VenueFaqListOutput = z.infer<typeof VenueFaqListOutputSchema>;

/**
 * Output schema for removing a gastronomy FAQ.
 */
export const VenueFaqRemoveOutputSchema = SuccessSchema;

// ----------------------------------------------------------------------------
// Reorder Input Schema (mirrors SPEC-177 pattern)
// ----------------------------------------------------------------------------

/**
 * Service input schema for reordering FAQs on a gastronomy listing.
 * The service validates that all faqId values belong to the given gastronomy.
 */
export const VenueFaqReorderInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    order: FaqReorderPayloadSchema.shape.order
});
export type VenueFaqReorderInput = z.infer<typeof VenueFaqReorderInputSchema>;
