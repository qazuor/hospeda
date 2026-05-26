import { z } from 'zod';
import { SuccessSchema } from '../../../api/result.schema.js';
import {
    BaseFaqSchema,
    FaqCreatePayloadSchema,
    FaqUpdatePayloadSchema
} from '../../../common/faq.schema.js';
import { DestinationFaqIdSchema, DestinationIdSchema } from '../../../common/id.schema.js';

/**
 * Destination FAQ Schema - FAQ Entity belonging to a Destination
 *
 * This schema represents a FAQ entry that belongs to a specific destination.
 * The FAQ contains all its data plus the destination_id it belongs to.
 * Relationship: 1 Destination -> N FAQs (1-to-N, not N-to-N)
 */
export const DestinationFaqSchema = BaseFaqSchema.extend({
    // Entity-specific ID
    id: DestinationFaqIdSchema,

    // Owner relationship - this FAQ belongs to this destination
    destinationId: DestinationIdSchema
});

/**
 * Type exports for the DestinationFaq entity
 */
export type DestinationFaq = z.infer<typeof DestinationFaqSchema>;

// ----------------------------------------------------------------------------
// Command Input Schemas
// ----------------------------------------------------------------------------

export const DestinationFaqAddInputSchema = z.object({
    destinationId: DestinationIdSchema,
    faq: FaqCreatePayloadSchema
});
export type DestinationFaqAddInput = z.infer<typeof DestinationFaqAddInputSchema>;

export const DestinationFaqUpdateInputSchema = z.object({
    destinationId: DestinationIdSchema,
    faqId: DestinationFaqIdSchema,
    faq: FaqUpdatePayloadSchema
});
export type DestinationFaqUpdateInput = z.infer<typeof DestinationFaqUpdateInputSchema>;

export const DestinationFaqRemoveInputSchema = z.object({
    destinationId: DestinationIdSchema,
    faqId: DestinationFaqIdSchema
});
export type DestinationFaqRemoveInput = z.infer<typeof DestinationFaqRemoveInputSchema>;

export const DestinationFaqListInputSchema = z.object({
    destinationId: DestinationIdSchema
});
export type DestinationFaqListInput = z.infer<typeof DestinationFaqListInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

export const DestinationFaqSingleOutputSchema = z.object({
    faq: DestinationFaqSchema
});
export type DestinationFaqSingleOutput = z.infer<typeof DestinationFaqSingleOutputSchema>;

export const DestinationFaqListOutputSchema = z.object({
    faqs: z.array(DestinationFaqSchema)
});
export type DestinationFaqListOutput = z.infer<typeof DestinationFaqListOutputSchema>;

export const DestinationFaqRemoveOutputSchema = SuccessSchema;
