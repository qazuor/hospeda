import { AccommodationSchema } from '@repo/schemas';
import type { AccommodationType } from '@repo/types';
import type { AccommodationId } from '@repo/types/common/id.types';
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
