import { z } from 'zod';
import { SuccessSchema } from '../../../api/result.schema.js';
import {
    BaseIaDataSchema,
    IaDataCreatePayloadSchema,
    IaDataUpdatePayloadSchema
} from '../../../common/ia.schema.js';
import { AccommodationIaDataIdSchema, AccommodationIdSchema } from '../../../common/id.schema.js';

/**
 * Accommodation IA Data Schema - IA Data Entity belonging to an Accommodation
 *
 * This schema represents an IA data entry that belongs to a specific accommodation.
 * The IA Data contains all its data plus the accommodation_id it belongs to.
 * Relationship: 1 Accommodation -> N IA Data (1-to-N, not N-to-N)
 */
export const AccommodationIaDataSchema = BaseIaDataSchema.extend({
    // Entity-specific ID
    id: AccommodationIaDataIdSchema,

    // Owner relationship - this IA Data belongs to this accommodation
    accommodationId: AccommodationIdSchema
});

/**
 * Type exports for the AccommodationIaData entity
 */
export type AccommodationIaData = z.infer<typeof AccommodationIaDataSchema>;

// ----------------------------------------------------------------------------
// Command Input Schemas
// ----------------------------------------------------------------------------

export const AccommodationIaDataAddInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    iaData: IaDataCreatePayloadSchema
});
export type AccommodationIaDataAddInput = z.infer<typeof AccommodationIaDataAddInputSchema>;

export const AccommodationIaDataUpdateInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    iaDataId: AccommodationIaDataIdSchema,
    iaData: IaDataUpdatePayloadSchema
});
export type AccommodationIaDataUpdateInput = z.infer<typeof AccommodationIaDataUpdateInputSchema>;

export const AccommodationIaDataRemoveInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    iaDataId: AccommodationIaDataIdSchema
});
export type AccommodationIaDataRemoveInput = z.infer<typeof AccommodationIaDataRemoveInputSchema>;

export const AccommodationIaDataListInputSchema = z.object({
    accommodationId: AccommodationIdSchema
});
export type AccommodationIaDataListInput = z.infer<typeof AccommodationIaDataListInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

export const AccommodationIaDataSingleOutputSchema = z.object({
    iaData: AccommodationIaDataSchema
});
export type AccommodationIaDataSingleOutput = z.infer<typeof AccommodationIaDataSingleOutputSchema>;

export const AccommodationIaDataListOutputSchema = z.object({
    iaData: z.array(AccommodationIaDataSchema)
});
export type AccommodationIaDataListOutput = z.infer<typeof AccommodationIaDataListOutputSchema>;

export const AccommodationIaDataRemoveOutputSchema = SuccessSchema;
