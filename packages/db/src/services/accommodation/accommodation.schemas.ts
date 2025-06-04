import { AccommodationSchema } from '@repo/schemas';
import type { AccommodationType } from '@repo/types';
import type { AccommodationId, DestinationId } from '@repo/types/common/id.types';
import { z } from 'zod';
import {
    ACCOMMODATION_ORDERABLE_COLUMNS,
    type AccommodationOrderByColumn
} from '../../models/accommodation/accommodation.model';

/**
 * Input schema for getById.
 *
 * @example
 * const input = { id: 'acc-1' as AccommodationId };
 */
export const getByIdInputSchema = z.object({
    id: z.string().min(1, 'Accommodation ID is required') as unknown as z.ZodType<AccommodationId>
});

/**
 * Input type for getById.
 * @example
 * const input: GetByIdInput = { id: 'acc-1' as AccommodationId };
 */
export type GetByIdInput = z.infer<typeof getByIdInputSchema>;

/**
 * Output type for getById.
 * @example
 * const output: GetByIdOutput = { accommodation: mockAccommodation };
 */
export type GetByIdOutput = { accommodation: AccommodationType | null };

/**
 * Input schema for getByName.
 *
 * @example
 * const input = { name: 'Hotel Uruguay' };
 */
export const getByNameInputSchema = z.object({
    name: z.string().min(1, 'Accommodation name is required')
});

/**
 * Input type for getByName.
 * @example
 * const input: GetByNameInput = { name: 'Hotel Uruguay' };
 */
export type GetByNameInput = z.infer<typeof getByNameInputSchema>;

/**
 * Output type for getByName.
 * @example
 * const output: GetByNameOutput = { accommodation: mockAccommodation };
 */
export type GetByNameOutput = { accommodation: AccommodationType | null };

/**
 * Input schema for list.
 *
 * @example
 * const input = { limit: 10, offset: 0 };
 */
export const listInputSchema = z.object({
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
 * const input: ListInput = { limit: 10, offset: 0 };
 */
export type ListInput = z.infer<typeof listInputSchema>;

/**
 * Output type for list.
 * @example
 * const output: ListOutput = { accommodations: [mockAccommodation] };
 */
export type ListOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for create.
 *
 * @example
 * const input = { ... };
 */
export const createInputSchema = AccommodationSchema.omit({
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
 * const input: CreateInput = { ... };
 */
export type CreateInput = z.infer<typeof createInputSchema>;

/**
 * Output type for create.
 * @example
 * const output: CreateOutput = { accommodation: mockAccommodation };
 */
export type CreateOutput = { accommodation: AccommodationType };

/**
 * Input schema for update.
 * Allows updating all writable fields (all except id, createdAt, createdById, deletedAt, deletedById).
 *
 * @example
 * const input = { id: 'acc-1', name: 'Updated Name', summary: 'Updated summary' };
 */
export const updateInputSchema = AccommodationSchema.omit({
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
 * const input: UpdateInput = { id: 'acc-1', name: 'Updated Name' };
 */
export type UpdateInput = z.infer<typeof updateInputSchema>;

/**
 * Output type for update.
 * @example
 * const output: UpdateOutput = { accommodation: mockAccommodation };
 */
export type UpdateOutput = { accommodation: AccommodationType };

/**
 * Input schema for getByDestination.
 *
 * @example
 * const input = { destinationId: 'dest-1' as DestinationId };
 */
export const getByDestinationInputSchema = z.object({
    destinationId: z
        .string()
        .min(1, 'Destination ID is required') as unknown as z.ZodType<DestinationId>
});

/**
 * Input type for getByDestination.
 * @example
 * const input: GetByDestinationInput = { destinationId: 'dest-1' as DestinationId };
 */
export type GetByDestinationInput = z.infer<typeof getByDestinationInputSchema>;

/**
 * Output type for getByDestination.
 * @example
 * const output: GetByDestinationOutput = { accommodations: [mockAccommodation] };
 */
export type GetByDestinationOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for getByOwner.
 *
 * @example
 * const input = { ownerId: 'user-1' as UserId };
 */
export const getByOwnerInputSchema = z.object({
    ownerId: z.string().min(1, 'Owner ID is required')
});

/**
 * Input type for getByOwner.
 * @example
 * const input: GetByOwnerInput = { ownerId: 'user-1' as UserId };
 */
export type GetByOwnerInput = z.infer<typeof getByOwnerInputSchema>;

/**
 * Output type for getByOwner.
 * @example
 * const output: GetByOwnerOutput = { accommodations: [mockAccommodation] };
 */
export type GetByOwnerOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for getTopRatedByDestination.
 *
 * @example
 * const input = { destinationId: 'dest-1', limit: 5 };
 */
export const getTopRatedByDestinationInputSchema = z.object({
    destinationId: z.string().min(1, 'Destination ID is required'),
    limit: z.number().int().min(1).max(100).default(5)
});

/**
 * Input type for getTopRatedByDestination.
 * @example
 * const input: GetTopRatedByDestinationInput = { destinationId: 'dest-1', limit: 5 };
 */
export type GetTopRatedByDestinationInput = z.infer<typeof getTopRatedByDestinationInputSchema>;

/**
 * Output type for getTopRatedByDestination.
 * @example
 * const output: GetTopRatedByDestinationOutput = { accommodations: [mockAccommodation] };
 */
export type GetTopRatedByDestinationOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for getForHome.
 *
 * @example
 * const input = { destinationIds: ['dest-1', 'dest-2'], limitAccommodationByDestination: 3 };
 */
export const getForHomeInputSchema = z.object({
    destinationIds: z.array(z.string()).optional(),
    limitAccommodationByDestination: z.number().int().min(1).max(10).default(2)
});

/**
 * Input type for getForHome.
 * @example
 * const input: GetForHomeInput = { destinationIds: ['dest-1'], limitAccommodationByDestination: 2 };
 */
export type GetForHomeInput = z.infer<typeof getForHomeInputSchema>;

/**
 * Output type for getForHome.
 * @example
 * const output: GetForHomeOutput = { accommodationsByDestination: { 'dest-1': [mockAccommodation] } };
 */
export type GetForHomeOutput = { accommodationsByDestination: Record<string, AccommodationType[]> };
