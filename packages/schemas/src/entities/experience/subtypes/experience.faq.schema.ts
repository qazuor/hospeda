import { z } from 'zod';
import { SuccessSchema } from '../../../api/result.schema.js';
import {
    BaseFaqSchema,
    FaqCreatePayloadSchema,
    FaqReorderPayloadSchema,
    FaqUpdatePayloadSchema
} from '../../../common/faq.schema.js';

/**
 * Experience FAQ Schema — FAQ entity belonging to an experience listing.
 *
 * Mirrors `GastronomyFaqSchema`: extends the shared `BaseFaqSchema` with an
 * experience-specific `id` and `experienceId` foreign key.
 * Relationship: 1 Experience → N FAQs (1-to-N, not N-to-N).
 */
export const ExperienceFaqSchema = BaseFaqSchema.extend({
    /** FAQ entity ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The experience listing this FAQ belongs to. */
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type for {@link ExperienceFaqSchema}. */
export type ExperienceFaq = z.infer<typeof ExperienceFaqSchema>;

// ----------------------------------------------------------------------------
// Command Input Schemas
// ----------------------------------------------------------------------------

/**
 * Input schema for adding a FAQ to an experience listing.
 */
export const ExperienceFaqAddInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faq: FaqCreatePayloadSchema
});
export type ExperienceFaqAddInput = z.infer<typeof ExperienceFaqAddInputSchema>;

/**
 * Input schema for updating a FAQ on an experience listing.
 */
export const ExperienceFaqUpdateInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faq: FaqUpdatePayloadSchema
});
export type ExperienceFaqUpdateInput = z.infer<typeof ExperienceFaqUpdateInputSchema>;

/**
 * Input schema for removing a FAQ from an experience listing.
 */
export const ExperienceFaqRemoveInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type ExperienceFaqRemoveInput = z.infer<typeof ExperienceFaqRemoveInputSchema>;

/**
 * Input schema for listing FAQs on an experience listing.
 */
export const ExperienceFaqListInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type ExperienceFaqListInput = z.infer<typeof ExperienceFaqListInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

/**
 * Output schema for a single experience FAQ operation (add / update).
 */
export const ExperienceFaqSingleOutputSchema = z.object({
    faq: ExperienceFaqSchema
});
export type ExperienceFaqSingleOutput = z.infer<typeof ExperienceFaqSingleOutputSchema>;

/**
 * Output schema for listing experience FAQs.
 */
export const ExperienceFaqListOutputSchema = z.object({
    faqs: z.array(ExperienceFaqSchema)
});
export type ExperienceFaqListOutput = z.infer<typeof ExperienceFaqListOutputSchema>;

/**
 * Output schema for removing an experience FAQ.
 */
export const ExperienceFaqRemoveOutputSchema = SuccessSchema;

// ----------------------------------------------------------------------------
// Reorder Input Schema (mirrors SPEC-177 pattern)
// ----------------------------------------------------------------------------

/**
 * Service input schema for reordering FAQs on an experience listing.
 * The service validates that all faqId values belong to the given experience.
 */
export const ExperienceFaqReorderInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    order: FaqReorderPayloadSchema.shape.order
});
export type ExperienceFaqReorderInput = z.infer<typeof ExperienceFaqReorderInputSchema>;
