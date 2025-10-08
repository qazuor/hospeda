import type { EventListItem } from '@repo/schemas';
import {
    EventListItemSchema as BaseEventListItemSchema,
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PriceCurrencyEnum,
    VisibilityEnum
} from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for event list items in admin
 * Extends the base EventListItemSchema with admin-specific fields
 */
export const EventListItemSchema = BaseEventListItemSchema.extend({
    // Admin-specific fields for list management
    destinationId: z.string().nullable().optional(),
    destinationName: z.string().optional(),
    organizerName: z.string().optional(),
    locationName: z.string().optional(),
    eventType: z.nativeEnum(EventCategoryEnum).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    capacity: z.number().optional(),
    attendeesCount: z.number().optional(),
    ticketPrice: z.number().optional(),
    currency: z.nativeEnum(PriceCurrencyEnum).optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
    moderationState: z.nativeEnum(ModerationStatusEnum).optional(),
    tags: z.array(z.string()).optional()
});

export type Event = EventListItem & {
    destinationId?: string | null;
    destinationName?: string;
    organizerName?: string;
    locationName?: string;
    eventType?: EventCategoryEnum;
    startDate?: string;
    endDate?: string;
    capacity?: number;
    attendeesCount?: number;
    ticketPrice?: number;
    currency?: PriceCurrencyEnum;
    visibility?: VisibilityEnum;
    lifecycleState?: LifecycleStatusEnum;
    moderationState?: ModerationStatusEnum;
    tags?: string[];
};
