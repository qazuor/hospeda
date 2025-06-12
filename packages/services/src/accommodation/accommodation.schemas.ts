import { ACCOMMODATION_ORDERABLE_COLUMNS, type AccommodationOrderByColumn } from '@repo/db';
import { AccommodationSchema } from '@repo/schemas';
import type { AccommodationId, AccommodationType, DestinationId } from '@repo/types';
import { AccommodationTypeEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Input schema for getById.
 *
 * @example
 * const input = { id: 'acc-1' as AccommodationId };
 */
export const AccommodationGetByIdInputSchema = z.object({
    id: z.string().min(1, 'Accommodation ID is required') as unknown as z.ZodType<AccommodationId>
});

/**
 * Input type for getById.
 * @example
 * const input: AccommodationGetByIdInput = { id: 'acc-1' as AccommodationId };
 */
export type AccommodationGetByIdInput = z.infer<typeof AccommodationGetByIdInputSchema>;

/**
 * Output type for getById.
 * @example
 * const output: AccommodationGetByIdOutput = { accommodation: mockAccommodation };
 */
export type AccommodationGetByIdOutput = { accommodation: AccommodationType | null };

/**
 * Input schema for getByName.
 *
 * @example
 * const input = { name: 'Hotel Uruguay' };
 */
export const AccommodationGetByNameInputSchema = z.object({
    name: z.string().min(1, 'Accommodation name is required')
});

/**
 * Input type for getByName.
 * @example
 * const input: AccommodationGetByNameInput = { name: 'Hotel Uruguay' };
 */
export type AccommodationGetByNameInput = z.infer<typeof AccommodationGetByNameInputSchema>;

/**
 * Output type for getByName.
 * @example
 * const output: AccommodationGetByNameOutput = { accommodation: mockAccommodation };
 */
export type AccommodationGetByNameOutput = { accommodation: AccommodationType | null };

/**
 * Input schema for list.
 *
 * @example
 * const input = { limit: 10, offset: 0 };
 */
export const AccommodationListInputSchema = z.object({
    q: z.string().optional(),
    type: z.string().optional(),
    visibility: z.enum(['PUBLIC', 'DRAFT', 'PRIVATE']).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z
        .enum([...ACCOMMODATION_ORDERABLE_COLUMNS] as [
            AccommodationOrderByColumn,
            ...AccommodationOrderByColumn[]
        ])
        .optional()
});

/**
 * Input type for list.
 * @example
 * const input: AccommodationListInput = { limit: 10, offset: 0 };
 */
export type AccommodationListInput = z.infer<typeof AccommodationListInputSchema>;

/**
 * Output type for list.
 * @example
 * const output: AccommodationListOutput = { accommodations: [mockAccommodation] };
 */
export type AccommodationListOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for create.
 *
 * @example
 * const input = { ... };
 */
export const AccommodationCreateInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
});

/**
 * Input type for create.
 * @example
 * const input: AccommodationCreateInput = { ... };
 */
export type AccommodationCreateInput = z.infer<typeof AccommodationCreateInputSchema>;

/**
 * Output type for create.
 * @example
 * const output: AccommodationCreateOutput = { accommodation: mockAccommodation };
 */
export type AccommodationCreateOutput = { accommodation: AccommodationType };

/**
 * Input schema for update.
 * Allows updating all writable fields (all except id, createdAt, createdById, deletedAt, deletedById).
 *
 * @example
 * const input = { id: 'acc-1', name: 'Updated Name', summary: 'Updated summary' };
 */
export const AccommodationUpdateInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    createdById: true,
    updatedAt: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    id: z.string().min(1, 'Accommodation ID is required') as unknown as z.ZodType<AccommodationId>
});

/**
 * Input type for update.
 * @example
 * const input: AccommodationUpdateInput = { id: 'acc-1', name: 'Updated Name' };
 */
export type AccommodationUpdateInput = z.infer<typeof AccommodationUpdateInputSchema>;

/**
 * Output type for update.
 * @example
 * const output: AccommodationUpdateOutput = { accommodation: mockAccommodation };
 */
export type AccommodationUpdateOutput = { accommodation: AccommodationType };

/**
 * Input schema for getByDestination.
 *
 * @example
 * const input = { destinationId: 'dest-1' as DestinationId };
 */
export const AccommodationGetByDestinationInputSchema = z.object({
    destinationId: z
        .string()
        .min(1, 'Destination ID is required') as unknown as z.ZodType<DestinationId>
});

/**
 * Input type for getByDestination.
 * @example
 * const input: AccommodationGetByDestinationInput = { destinationId: 'dest-1' as DestinationId };
 */
export type AccommodationGetByDestinationInput = z.infer<
    typeof AccommodationGetByDestinationInputSchema
>;

/**
 * Output type for getByDestination.
 * @example
 * const output: AccommodationGetByDestinationOutput = { accommodations: [mockAccommodation] };
 */
export type AccommodationGetByDestinationOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for getByOwner.
 *
 * @example
 * const input = { ownerId: 'user-1' as UserId };
 */
export const AccommodationGetByOwnerInputSchema = z.object({
    ownerId: z.string().min(1, 'Owner ID is required')
});

/**
 * Input type for getByOwner.
 * @example
 * const input: AccommodationGetByOwnerInput = { ownerId: 'user-1' as UserId };
 */
export type AccommodationGetByOwnerInput = z.infer<typeof AccommodationGetByOwnerInputSchema>;

/**
 * Output type for getByOwner.
 * @example
 * const output: AccommodationGetByOwnerOutput = { accommodations: [mockAccommodation] };
 */
export type AccommodationGetByOwnerOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for getTopRatedByDestination.
 *
 * @example
 * const input = { destinationId: 'dest-1', limit: 5 };
 */
export const AccommodationGetTopRatedByDestinationInputSchema = z.object({
    destinationId: z.string().min(1, 'Destination ID is required'),
    limit: z.number().int().min(1).max(100).default(5)
});

/**
 * Input type for getTopRatedByDestination.
 * @example
 * const input: AccommodationGetTopRatedByDestinationInput = { destinationId: 'dest-1', limit: 5 };
 */
export type AccommodationGetTopRatedByDestinationInput = z.infer<
    typeof AccommodationGetTopRatedByDestinationInputSchema
>;

/**
 * Output type for getTopRatedByDestination.
 * @example
 * const output: AccommodationGetTopRatedByDestinationOutput = { accommodations: [mockAccommodation] };
 */
export type AccommodationGetTopRatedByDestinationOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for search (advanced search).
 *
 * Filters applied in the model (DB):
 * - destinationId
 * - types
 * - isFeatured
 * - minRating
 * - withContactInfo
 *
 * Filters applied in the service (in-memory):
 * - includeWithoutPrice
 * - amenities
 * - features
 * - advanced ordering (isFeatured first, then multiple fields)
 *
 * When the data volume grows, migrate amenities/features filters to SQL (see service doc).
 */
export const AccommodationSearchInputSchema = z.object({
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    includeWithoutPrice: z.boolean().optional(),
    types: z.array(z.nativeEnum(AccommodationTypeEnum)).optional(),
    minRating: z.number().min(0).max(5).optional(),
    amenities: z.array(z.string()).optional(), // AmenityId[]
    features: z.array(z.string()).optional(), // FeatureId[]
    text: z.string().optional(),
    withContactInfo: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    destinationId: z.string().optional(), // string
    orderBy: z.array(z.enum(['price', 'destination', 'type', 'rating'])).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0)
});

export type AccommodationSearchInput = z.infer<typeof AccommodationSearchInputSchema>;

export type AccommodationSearchOutput = {
    accommodations: AccommodationType[];
    total: number;
};
