import { ContactInfoSchema } from '@repo/schemas/common/contact.schema';
import { MediaSchema } from '@repo/schemas/common/media.schema';
import { EventDateSchema } from '@repo/schemas/entities/event/event.date.schema';
import { EventPriceSchema } from '@repo/schemas/entities/event/event.price.schema';
import { EventCategoryEnumSchema } from '@repo/schemas/enums/event-category.enum.schema';
import { VisibilityEnumSchema } from '@repo/schemas/enums/visibility.enum.schema';
import type { EventType, UserId } from '@repo/types';
import { LifecycleStatusEnum, VisibilityEnum } from '@repo/types';
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

/**
 * Zod schema for create input.
 * Omits auto-generated fields (id, audit, etc.).
 */
export const createEventInputSchema = z.object({
    slug: z.string().min(1, 'Slug is required'),
    summary: z.string().min(1, 'Summary is required'),
    description: z.string().optional(),
    media: MediaSchema.optional(),
    category: EventCategoryEnumSchema,
    date: EventDateSchema,
    authorId: z.string().min(1, 'AuthorId is required'),
    locationId: z.string().optional(),
    organizerId: z.string().optional(),
    pricing: EventPriceSchema.optional(),
    contact: ContactInfoSchema.optional(),
    visibility: VisibilityEnumSchema,
    isFeatured: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    seo: z.any().optional()
});

/**
 * Type for create input (RO-RO pattern).
 */
export type CreateEventInput = z.infer<typeof createEventInputSchema>;

/**
 * Type for create output (RO-RO pattern).
 */
export type CreateEventOutput = {
    event: EventType;
};

/**
 * Zod schema for update input (EventService)
 * Requires id, all other fields optional.
 * @example
 * const input = { id: 'event-1', summary: 'Updated summary' };
 */
export const updateInputSchema = z.object({
    id: z.string().min(1, 'Event ID is required'),
    slug: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    description: z.string().optional(),
    media: z.any().optional(),
    category: z.string().optional(),
    date: z.any().optional(),
    authorId: z.string().optional(),
    locationId: z.string().optional(),
    organizerId: z.string().optional(),
    pricing: z.any().optional(),
    contact: z.any().optional(),
    visibility: z.string().optional(),
    isFeatured: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    seo: z.any().optional(),
    lifecycleState: z.string().optional(),
    moderationState: z.string().optional()
});

/**
 * Input type for update (RO-RO pattern).
 * @example
 * const input: UpdateInput = { id: 'event-1', summary: 'Updated summary' };
 */
export type UpdateInput = z.infer<typeof updateInputSchema>;

/**
 * Output type for update (RO-RO pattern).
 * @example
 * const output: UpdateOutput = { event: mockEvent };
 */
export type UpdateOutput = { event: EventType };

/**
 * Zod schema for getByLocationId input.
 * @example { locationId: 'location-123' }
 */
export const getByLocationIdInputSchema = z.object({
    locationId: z.string().min(1, 'LocationId is required')
});

/**
 * Type for getByLocationId input (RO-RO pattern).
 * @property locationId - The unique location ID (LocationId branded type).
 */
export type GetByLocationIdInput = z.infer<typeof getByLocationIdInputSchema>;

/**
 * Type for getByLocationId output (RO-RO pattern).
 * @property events - Array of events for the given location.
 */
export type GetByLocationIdOutput = {
    events: EventType[];
};

/**
 * Input type for listing events (RO-RO pattern).
 * @property limit - Maximum number of events to return (default: 20, max: 100).
 * @property offset - Number of events to skip (for pagination).
 * @property filters - Optional filters: visibility, lifecycleState, authorId.
 */
export type ListEventsInput = {
    limit?: number;
    offset?: number;
    filters?: {
        visibility?: VisibilityEnum;
        lifecycleState?: LifecycleStatusEnum;
        authorId?: UserId;
    };
};

/**
 * Output type for listing events (RO-RO pattern).
 * @property events - Array of events matching the filters and permissions.
 */
export type ListEventsOutput = { events: EventType[] };

/**
 * Zod schema for list events input validation.
 * @example { limit: 10, offset: 0, filters: { visibility: 'PUBLIC' } }
 */
export const listEventsInputSchema = z.object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    filters: z
        .object({
            visibility: z.nativeEnum(VisibilityEnum).optional(),
            lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
            authorId: z.string().optional()
        })
        .optional()
});

/**
 * Zod schema for getByOrganizerId input.
 * @example { organizerId: 'org-123', limit: 10, offset: 0 }
 */
export const getByOrganizerIdInputSchema = z.object({
    organizerId: z.string().min(1, 'OrganizerId is required'),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional()
});

/**
 * Type for getByOrganizerId input (RO-RO pattern).
 * @property organizerId - The unique organizer ID.
 * @property limit - Max number of events to return.
 * @property offset - Number of events to skip.
 */
export type GetByOrganizerIdInput = z.infer<typeof getByOrganizerIdInputSchema>;

/**
 * Type for getByOrganizerId output (RO-RO pattern).
 * @property events - Array of events for the given organizer.
 */
export type GetByOrganizerIdOutput = { events: EventType[] };
