import { z } from 'zod';
import {
    BaseFaqSchema,
    FaqCreatePayloadSchema,
    FaqUpdatePayloadSchema
} from '../../common/faq.schema.js';
import { AccommodationFaqIdSchema, AccommodationIdSchema } from '../../common/id.schema.js';
import { SuccessSchema } from '../../common/result.schema.js';

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

export const AccommodationFaqUpdateInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    faqId: AccommodationFaqIdSchema,
    faq: FaqUpdatePayloadSchema
});

export const AccommodationFaqRemoveInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    faqId: AccommodationFaqIdSchema
});

export const AccommodationFaqListInputSchema = z.object({
    accommodationId: AccommodationIdSchema
});

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

export const AccommodationFaqSingleOutputSchema = z.object({
    faq: AccommodationFaqSchema
});

export const AccommodationFaqListOutputSchema = z.object({
    faqs: z.array(AccommodationFaqSchema)
});

export const AccommodationFaqRemoveOutputSchema = SuccessSchema;

export type AccommodationFaqAddInput = z.infer<typeof AccommodationFaqAddInputSchema>;
export type AccommodationFaqUpdateInput = z.infer<typeof AccommodationFaqUpdateInputSchema>;
export type AccommodationFaqRemoveInput = z.infer<typeof AccommodationFaqRemoveInputSchema>;
export type AccommodationFaqListInput = z.infer<typeof AccommodationFaqListInputSchema>;
export type AccommodationFaqSingleOutput = z.infer<typeof AccommodationFaqSingleOutputSchema>;
export type AccommodationFaqListOutput = z.infer<typeof AccommodationFaqListOutputSchema>;
