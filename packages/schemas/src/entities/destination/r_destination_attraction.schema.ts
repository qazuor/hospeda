import { z } from 'zod';

/**
 * Zod schema destionation/attraction relationship.
 */
export const DestinationAttractionRelationSchema = z.object({
    destionationId: z
        .string()
        .uuid({ message: 'error:destination_attraction.destionationId.invalid' }),
    attractionId: z.string().uuid({ message: 'error:destination_attraction.attractionId.invalid' })
});

export type DestinationAttractionRelationInput = z.infer<
    typeof DestinationAttractionRelationSchema
>;
