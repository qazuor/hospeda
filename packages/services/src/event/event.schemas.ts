import {
    ContactInfoSchema,
    EventCategoryEnumSchema,
    EventDateSchema,
    EventPriceSchema,
    MediaSchema,
    TagsArraySchema,
    VisibilityEnumSchema,
    WithSeoSchema
} from '@repo/schemas';
import type { EventType, UserId } from '@repo/types';
import { EventCategoryEnum, LifecycleStatusEnum, VisibilityEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for getById input.
 * @example { id: 'event-123' }
 */
export const EventGetByIdInputSchema = z.object({
    id: z
        .string({
            required_error: 'serviceInputError.event.id.required',
            invalid_type_error: 'serviceInputError.event.id.invalidType'
        })
        .min(1, 'serviceInputError.event.id.required')
        .uuid('serviceInputError.event.id.invalidUuid')
});

/**
 * Type for getById input (RO-RO pattern).
 * @property id - The unique event ID (EventId branded type).
 */
export type EventGetByIdInput = z.infer<typeof EventGetByIdInputSchema>;

/**
 * Type for getById output (RO-RO pattern).
 * @property event - The event object if found, or null otherwise.
 */
export type EventGetByIdOutput = {
    event: EventType | null;
};

/**
 * Zod schema for getBySlug input.
 * @example { slug: 'event-slug' }
 */
export const EventGetBySlugInputSchema = z.object({
    slug: z
        .string({
            required_error: 'serviceInputError.event.slug.required',
            invalid_type_error: 'serviceInputError.event.slug.invalidType'
        })
        .min(1, 'serviceInputError.event.slug.required')
});

/**
 * Type for getBySlug input (RO-RO pattern).
 * @property slug - The unique event slug.
 */
export type EventGetBySlugInput = z.infer<typeof EventGetBySlugInputSchema>;

/**
 * Type for getBySlug output (RO-RO pattern).
 * @property event - The event object if found, or null otherwise.
 */
export type EventGetBySlugOutput = {
    event: EventType | null;
};

/**
 * Zod schema for create input.
 * Omits auto-generated fields (id, audit, etc.).
 */
export const EventCreateInputSchema = z.object({
    slug: z
        .string({
            required_error: 'serviceInputError.event.slug.required',
            invalid_type_error: 'serviceInputError.event.slug.invalidType'
        })
        .min(1, 'serviceInputError.event.slug.required'),
    summary: z
        .string({
            required_error: 'serviceInputError.event.summary.required',
            invalid_type_error: 'serviceInputError.event.summary.invalidType'
        })
        .min(1, 'serviceInputError.event.summary.required'),
    description: z
        .string({
            invalid_type_error: 'serviceInputError.event.description.invalidType'
        })
        .optional(),
    media: MediaSchema.optional(),
    category: EventCategoryEnumSchema,
    date: EventDateSchema,
    authorId: z
        .string({
            required_error: 'serviceInputError.event.authorId.required',
            invalid_type_error: 'serviceInputError.event.authorId.invalidType'
        })
        .min(1, 'serviceInputError.event.authorId.required')
        .uuid('serviceInputError.event.authorId.invalidUuid'),
    locationId: z
        .string({
            invalid_type_error: 'serviceInputError.event.locationId.invalidType'
        })
        .uuid('serviceInputError.event.locationId.invalidUuid')
        .optional(),
    organizerId: z
        .string({
            invalid_type_error: 'serviceInputError.event.organizerId.invalidType'
        })
        .uuid('serviceInputError.event.organizerId.invalidUuid')
        .optional(),
    pricing: EventPriceSchema.optional(),
    contact: ContactInfoSchema.optional(),
    visibility: VisibilityEnumSchema,
    isFeatured: z
        .boolean({
            invalid_type_error: 'serviceInputError.event.isFeatured.invalidType'
        })
        .optional(),
    tags: TagsArraySchema.optional(),
    seo: WithSeoSchema.shape.seo.optional()
});

/**
 * Type for create input (RO-RO pattern).
 */
export type EventCreateInput = z.infer<typeof EventCreateInputSchema>;

/**
 * Type for create output (RO-RO pattern).
 */
export type EventCreateOutput = {
    event: EventType;
};

/**
 * Zod schema for update input (EventService)
 * Requires id, all other fields optional.
 * @example
 * const input = { id: 'event-1', summary: 'Updated summary' };
 */
export const EventUpdateInputSchema = z.object({
    id: z
        .string({
            required_error: 'serviceInputError.event.id.required',
            invalid_type_error: 'serviceInputError.event.id.invalidType'
        })
        .min(1, 'serviceInputError.event.id.required')
        .uuid('serviceInputError.event.id.invalidUuid'),
    slug: z
        .string({
            invalid_type_error: 'serviceInputError.event.slug.invalidType'
        })
        .min(1, 'serviceInputError.event.slug.required')
        .optional(),
    summary: z
        .string({
            invalid_type_error: 'serviceInputError.event.summary.invalidType'
        })
        .min(1, 'serviceInputError.event.summary.required')
        .optional(),
    description: z
        .string({
            invalid_type_error: 'serviceInputError.event.description.invalidType'
        })
        .optional(),
    media: MediaSchema.optional(),
    category: EventCategoryEnumSchema.optional(),
    date: EventDateSchema.optional(),
    authorId: z
        .string({
            invalid_type_error: 'serviceInputError.event.authorId.invalidType'
        })
        .uuid('serviceInputError.event.authorId.invalidUuid')
        .optional(),
    locationId: z
        .string({
            invalid_type_error: 'serviceInputError.event.locationId.invalidType'
        })
        .uuid('serviceInputError.event.locationId.invalidUuid')
        .optional(),
    organizerId: z
        .string({
            invalid_type_error: 'serviceInputError.event.organizerId.invalidType'
        })
        .uuid('serviceInputError.event.organizerId.invalidUuid')
        .optional(),
    pricing: EventPriceSchema.optional(),
    contact: ContactInfoSchema.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z
        .boolean({
            invalid_type_error: 'serviceInputError.event.isFeatured.invalidType'
        })
        .optional(),
    tags: TagsArraySchema.optional(),
    seo: WithSeoSchema.shape.seo.optional(),
    lifecycleState: z
        .nativeEnum(LifecycleStatusEnum, {
            invalid_type_error: 'serviceInputError.event.lifecycleState.invalidType'
        })
        .optional(),
    moderationState: z
        .string({
            invalid_type_error: 'serviceInputError.event.moderationState.invalidType'
        })
        .optional()
});

/**
 * Input type for update (RO-RO pattern).
 * @example
 * const input: EventUpdateInput = { id: 'event-1', summary: 'Updated summary' };
 */
export type EventUpdateInput = z.infer<typeof EventUpdateInputSchema>;

/**
 * Output type for update (RO-RO pattern).
 * @example
 * const output: EventUpdateOutput = { event: mockEvent };
 */
export type EventUpdateOutput = { event: EventType };

/**
 * Zod schema for getByLocationId input.
 * @example { locationId: 'location-123' }
 */
export const EventGetByLocationIdInputSchema = z.object({
    locationId: z
        .string({
            required_error: 'serviceInputError.event.locationId.required',
            invalid_type_error: 'serviceInputError.event.locationId.invalidType'
        })
        .min(1, 'serviceInputError.event.locationId.required')
        .uuid('serviceInputError.event.locationId.invalidUuid')
});

/**
 * Type for getByLocationId input (RO-RO pattern).
 * @property locationId - The unique location ID (LocationId branded type).
 */
export type EventGetByLocationIdInput = z.infer<typeof EventGetByLocationIdInputSchema>;

/**
 * Type for getByLocationId output (RO-RO pattern).
 * @property events - Array of events for the given location.
 */
export type EventGetByLocationIdOutput = {
    events: EventType[];
};

/**
 * Input type for listing events (RO-RO pattern).
 * @property limit - Maximum number of events to return (default: 20, max: 100).
 * @property offset - Number of events to skip (for pagination).
 * @property filters - Optional filters: visibility, lifecycleState, authorId.
 */
export type EventListInput = {
    limit?: number;
    offset?: number;
    filters?: {
        visibility?: VisibilityEnum;
        lifecycleState?: LifecycleStatusEnum;
        authorId?: UserId;
    };
    /**
     * If set, only events whose date.start is greater than or equal to this value will be returned.
     */
    minDate?: Date;
    /**
     * If set, only events whose date.start is less than or equal to this value will be returned.
     */
    maxDate?: Date;
};

/**
 * Output type for listing events (RO-RO pattern).
 * @property events - Array of events matching the filters and permissions.
 */
export type EventListOutput = { events: EventType[] };

/**
 * Zod schema for list events input validation.
 * @example { limit: 10, offset: 0, filters: { visibility: 'PUBLIC' } }
 */
export const EventListInputSchema = z.object({
    limit: z
        .number({
            invalid_type_error: 'serviceInputError.event.limit.invalidType'
        })
        .int()
        .min(1, 'serviceInputError.event.limit.min')
        .max(100, 'serviceInputError.event.limit.max')
        .optional(),
    offset: z
        .number({
            invalid_type_error: 'serviceInputError.event.offset.invalidType'
        })
        .int()
        .min(0, 'serviceInputError.event.offset.min')
        .optional(),
    filters: z
        .object({
            visibility: z
                .nativeEnum(VisibilityEnum, {
                    invalid_type_error: 'serviceInputError.event.visibility.invalidType'
                })
                .optional(),
            lifecycleState: z
                .nativeEnum(LifecycleStatusEnum, {
                    invalid_type_error: 'serviceInputError.event.lifecycleState.invalidType'
                })
                .optional(),
            authorId: z
                .string({
                    invalid_type_error: 'serviceInputError.event.authorId.invalidType'
                })
                .optional()
        })
        .optional(),
    minDate: z.coerce
        .date({
            invalid_type_error: 'serviceInputError.event.minDate.invalidType'
        })
        .optional(),
    maxDate: z.coerce
        .date({
            invalid_type_error: 'serviceInputError.event.maxDate.invalidType'
        })
        .optional()
});

/**
 * Zod schema for getByOrganizerId input.
 * @example { organizerId: 'org-123', limit: 10, offset: 0 }
 */
export const getByOrganizerIdInputSchema = z.object({
    organizerId: z
        .string({
            required_error: 'serviceInputError.event.organizerId.required',
            invalid_type_error: 'serviceInputError.event.organizerId.invalidType'
        })
        .min(1, 'serviceInputError.event.organizerId.required')
        .uuid('serviceInputError.event.organizerId.invalidUuid'),
    limit: z
        .number({
            invalid_type_error: 'serviceInputError.event.limit.invalidType'
        })
        .int()
        .min(1, 'serviceInputError.event.limit.min')
        .max(100, 'serviceInputError.event.limit.max')
        .optional(),
    offset: z
        .number({
            invalid_type_error: 'serviceInputError.event.offset.invalidType'
        })
        .int()
        .min(0, 'serviceInputError.event.offset.min')
        .optional(),
    minDate: z.coerce
        .date({
            invalid_type_error: 'serviceInputError.event.minDate.invalidType'
        })
        .optional(),
    maxDate: z.coerce
        .date({
            invalid_type_error: 'serviceInputError.event.maxDate.invalidType'
        })
        .optional()
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

/**
 * Zod schema for getByCategory input.
 * @example { category: 'FESTIVAL', limit: 10, offset: 0 }
 */
export const getByCategoryInputSchema = z.object({
    category: z.nativeEnum(EventCategoryEnum, {
        required_error: 'serviceInputError.event.category.required',
        invalid_type_error: 'serviceInputError.event.category.invalidType'
    }),
    limit: z
        .number({
            invalid_type_error: 'serviceInputError.event.limit.invalidType'
        })
        .int()
        .min(1, 'serviceInputError.event.limit.min')
        .max(100, 'serviceInputError.event.limit.max')
        .optional(),
    offset: z
        .number({
            invalid_type_error: 'serviceInputError.event.offset.invalidType'
        })
        .int()
        .min(0, 'serviceInputError.event.offset.min')
        .optional(),
    minDate: z.coerce
        .date({
            invalid_type_error: 'serviceInputError.event.minDate.invalidType'
        })
        .optional(),
    maxDate: z.coerce
        .date({
            invalid_type_error: 'serviceInputError.event.maxDate.invalidType'
        })
        .optional()
});

/**
 * Type for getByCategory input (RO-RO pattern).
 * @property category - The event category (enum).
 * @property limit - Max number of events to return.
 * @property offset - Number of events to skip.
 */
export type GetByCategoryInput = z.infer<typeof getByCategoryInputSchema>;

/**
 * Type for getByCategory output (RO-RO pattern).
 * @property events - Array of events for the given category.
 */
export type GetByCategoryOutput = { events: EventType[] };

/**
 * Zod schema for getFeatured input.
 * @example { limit: 10, offset: 0 }
 */
export const getFeaturedInputSchema = z.object({
    limit: z
        .number({
            invalid_type_error: 'serviceInputError.event.limit.invalidType'
        })
        .int()
        .min(1, 'serviceInputError.event.limit.min')
        .max(100, 'serviceInputError.event.limit.max')
        .optional(),
    offset: z
        .number({
            invalid_type_error: 'serviceInputError.event.offset.invalidType'
        })
        .int()
        .min(0, 'serviceInputError.event.offset.min')
        .optional()
});

/**
 * Type for getFeatured input (RO-RO pattern).
 * @property limit - Max number of events to return.
 * @property offset - Number of events to skip.
 */
export type GetFeaturedInput = z.infer<typeof getFeaturedInputSchema>;

/**
 * Type for getFeatured output (RO-RO pattern).
 * @property events - Array of featured events.
 */
export type GetFeaturedOutput = { events: EventType[] };

/**
 * Zod schema for getUpcoming input.
 * @example { limit: 10, offset: 0 }
 */
export const getUpcomingInputSchema = z.object({
    limit: z
        .number({
            invalid_type_error: 'serviceInputError.event.limit.invalidType'
        })
        .int()
        .min(1, 'serviceInputError.event.limit.min')
        .max(100, 'serviceInputError.event.limit.max')
        .optional(),
    offset: z
        .number({
            invalid_type_error: 'serviceInputError.event.offset.invalidType'
        })
        .int()
        .min(0, 'serviceInputError.event.offset.min')
        .optional(),
    minDate: z.coerce
        .date({
            invalid_type_error: 'serviceInputError.event.minDate.invalidType'
        })
        .optional(),
    maxDate: z.coerce
        .date({
            invalid_type_error: 'serviceInputError.event.maxDate.invalidType'
        })
        .optional()
});

/**
 * Type for getUpcoming input (RO-RO pattern).
 * @property limit - Max number of events to return.
 * @property offset - Number of events to skip.
 * @property minDate - If set, only events whose date.start is >= minDate will be returned.
 * @property maxDate - If set, only events whose date.start is <= maxDate will be returned.
 */
export type GetUpcomingInput = z.infer<typeof getUpcomingInputSchema>;

/**
 * Type for getUpcoming output (RO-RO pattern).
 * @property events - Array of upcoming events.
 */
export type GetUpcomingOutput = { events: EventType[] };

/**
 * Zod schema for getByDateRange input.
 * @example { minDate: '2024-07-01', maxDate: '2024-08-01', limit: 10, offset: 0 }
 */
export const getByDateRangeInputSchema = z.object({
    minDate: z.coerce.date({
        required_error: 'serviceInputError.event.minDate.required',
        invalid_type_error: 'serviceInputError.event.minDate.invalidType'
    }),
    maxDate: z.coerce.date({
        required_error: 'serviceInputError.event.maxDate.required',
        invalid_type_error: 'serviceInputError.event.maxDate.invalidType'
    }),
    limit: z
        .number({
            invalid_type_error: 'serviceInputError.event.limit.invalidType'
        })
        .int()
        .min(1, 'serviceInputError.event.limit.min')
        .max(100, 'serviceInputError.event.limit.max')
        .optional(),
    offset: z
        .number({
            invalid_type_error: 'serviceInputError.event.offset.invalidType'
        })
        .int()
        .min(0, 'serviceInputError.event.offset.min')
        .optional()
});

/**
 * Type for getByDateRange input (RO-RO pattern).
 * @property minDate - Start of the date range (inclusive).
 * @property maxDate - End of the date range (inclusive).
 * @property limit - Max number of events to return.
 * @property offset - Number of events to skip.
 */
export type GetByDateRangeInput = z.infer<typeof getByDateRangeInputSchema>;

/**
 * Type for getByDateRange output (RO-RO pattern).
 * @property events - Array of events within the date range.
 */
export type GetByDateRangeOutput = { events: EventType[] };

/**
 * Zod schema for getByOrganizerId input.
 * @example { organizerId: 'org-123', limit: 10, offset: 0 }
 */
export const EventGetByOrganizerIdInputSchema = getByOrganizerIdInputSchema;
export type EventGetByOrganizerIdInput = GetByOrganizerIdInput;
export type EventGetByOrganizerIdOutput = GetByOrganizerIdOutput;

/**
 * Zod schema for getByCategory input.
 * @example { category: 'FESTIVAL', limit: 10, offset: 0 }
 */
export const EventGetByCategoryInputSchema = getByCategoryInputSchema;
export type EventGetByCategoryInput = GetByCategoryInput;
export type EventGetByCategoryOutput = GetByCategoryOutput;

/**
 * Zod schema for getFeatured input.
 * @example { limit: 10, offset: 0 }
 */
export const EventGetFeaturedInputSchema = getFeaturedInputSchema;
export type EventGetFeaturedInput = GetFeaturedInput;
export type EventGetFeaturedOutput = GetFeaturedOutput;

/**
 * Zod schema for getUpcoming input.
 * @example { limit: 10, offset: 0 }
 */
export const EventGetUpcomingInputSchema = getUpcomingInputSchema;
export type EventGetUpcomingInput = GetUpcomingInput;
export type EventGetUpcomingOutput = GetUpcomingOutput;

/**
 * Zod schema for getByDateRange input.
 * @example { minDate: '2024-07-01', maxDate: '2024-08-01', limit: 10, offset: 0 }
 */
export const EventGetByDateRangeInputSchema = getByDateRangeInputSchema;
export type EventGetByDateRangeInput = GetByDateRangeInput;
export type EventGetByDateRangeOutput = GetByDateRangeOutput;
