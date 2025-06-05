import type { EventType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for getById input.
 * @example { id: 'event-123' }
 */
export const getByIdInputSchema = z.object({
    id: z.string() // EventId as string
});

/**
 * Type for getById input (RO-RO pattern).
 * @property id - The unique event ID (EventId branded type).
 */
export type GetByIdInput = z.infer<typeof getByIdInputSchema>;

/**
 * Type for getById output (RO-RO pattern).
 * @property event - The event object if found, or null otherwise.
 */
export type GetByIdOutput = {
    event: EventType | null;
};
