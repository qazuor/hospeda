import { z } from 'zod';
import { SuccessSchema } from '../../../api/result.schema.js';
import {
    BaseFaqSchema,
    FaqCreatePayloadSchema,
    FaqReorderPayloadSchema,
    FaqUpdatePayloadSchema
} from '../../../common/faq.schema.js';
import { AccommodationFaqIdSchema, AccommodationIdSchema } from '../../../common/id.schema.js';

/**
 * Accommodation FAQ Schema - FAQ Entity belonging to an Accommodation
 *
 * This schema represents a FAQ entry that belongs to a specific accommodation.
 * The FAQ contains all its data plus the accommodation_id it belongs to.
 * Relationship: 1 Accommodation -> N FAQs (1-to-N, not N-to-N)
 */
export const AccommodationFaqSchema = BaseFaqSchema.extend({
    // Entity-specific ID
    id: AccommodationFaqIdSchema,

    // Owner relationship - this FAQ belongs to this accommodation
    accommodationId: AccommodationIdSchema
});

/**
 * Type exports for the AccommodationFaq entity
 */
export type AccommodationFaq = z.infer<typeof AccommodationFaqSchema>;

// ----------------------------------------------------------------------------
// Command Input Schemas
// ----------------------------------------------------------------------------

export const AccommodationFaqAddInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    faq: FaqCreatePayloadSchema
});
export type AccommodationFaqAddInput = z.infer<typeof AccommodationFaqAddInputSchema>;

export const AccommodationFaqUpdateInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    faqId: AccommodationFaqIdSchema,
    faq: FaqUpdatePayloadSchema
});
export type AccommodationFaqUpdateInput = z.infer<typeof AccommodationFaqUpdateInputSchema>;

export const AccommodationFaqRemoveInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    faqId: AccommodationFaqIdSchema
});
export type AccommodationFaqRemoveInput = z.infer<typeof AccommodationFaqRemoveInputSchema>;

export const AccommodationFaqListInputSchema = z.object({
    accommodationId: AccommodationIdSchema
});
export type AccommodationFaqListInput = z.infer<typeof AccommodationFaqListInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

export const AccommodationFaqSingleOutputSchema = z.object({
    faq: AccommodationFaqSchema
});
export type AccommodationFaqSingleOutput = z.infer<typeof AccommodationFaqSingleOutputSchema>;

export const AccommodationFaqListOutputSchema = z.object({
    faqs: z.array(AccommodationFaqSchema)
});
export type AccommodationFaqListOutput = z.infer<typeof AccommodationFaqListOutputSchema>;

export const AccommodationFaqRemoveOutputSchema = SuccessSchema;

// ----------------------------------------------------------------------------
// Reorder Input Schema (SPEC-177)
// ----------------------------------------------------------------------------

/**
 * Service input schema for reordering FAQs on an accommodation (SPEC-177).
 * Mirrors the shape of AccommodationFaqAddInputSchema — parent id + payload.
 * The service validates that all faqId values belong to the given accommodation.
 */
export const AccommodationFaqReorderInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    order: FaqReorderPayloadSchema.shape.order
});
export type AccommodationFaqReorderInput = z.infer<typeof AccommodationFaqReorderInputSchema>;
