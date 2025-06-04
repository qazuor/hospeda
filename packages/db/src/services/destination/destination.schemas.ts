import type { DestinationId } from '@repo/types/common/id.types';
import type { DestinationType } from '@repo/types/entities/destination/destination.types';
import { z } from 'zod';

/**
 * Input type for getById (DestinationService)
 */
export type GetByIdInput = {
    id: DestinationId;
};

/**
 * Output type for getById (DestinationService)
 */
export type GetByIdOutput = {
    destination: DestinationType | null;
};

/**
 * Zod schema for getById input
 */
export const getByIdInputSchema = z.object({
    id: z.string() as unknown as z.ZodType<DestinationId>
});

/**
 * Input type for getBySlug (DestinationService)
 */
export type GetBySlugInput = {
    slug: string;
};

/**
 * Output type for getBySlug (DestinationService)
 */
export type GetBySlugOutput = {
    destination: DestinationType | null;
};

/**
 * Zod schema for getBySlug input
 */
export const getBySlugInputSchema = z.object({
    slug: z.string().min(1)
});
