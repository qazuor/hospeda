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
