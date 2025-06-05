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

/**
 * Zod schema for getBySlug input.
 * @example { slug: 'event-slug' }
 */
export const getBySlugInputSchema = z.object({
    slug: z.string().min(1, 'Slug is required')
});

/**
 * Type for getBySlug input (RO-RO pattern).
 * @property slug - The unique event slug.
 */
export type GetBySlugInput = z.infer<typeof getBySlugInputSchema>;

/**
 * Type for getBySlug output (RO-RO pattern).
 * @property event - The event object if found, or null otherwise.
 */
export type GetBySlugOutput = {
    event: EventType | null;
};
