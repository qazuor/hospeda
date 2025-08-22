import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PriceCurrencyEnum,
    VisibilityEnum
} from '@repo/types';
import { z } from 'zod';

export const EventListItemSchema = z
    .object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        description: z.string().optional(),
        destinationId: z.string().nullable().optional(),
        destinationName: z.string().optional(),
        organizerId: z.string().nullable().optional(),
        organizerName: z.string().optional(),
        locationId: z.string().nullable().optional(),
        locationName: z.string().optional(),
        eventType: z.nativeEnum(EventCategoryEnum).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        capacity: z.number().optional(),
        attendeesCount: z.number().optional(),
        ticketPrice: z.number().optional(),
        currency: z.nativeEnum(PriceCurrencyEnum).optional(),
        isFeatured: z.boolean().optional(),
        visibility: z.nativeEnum(VisibilityEnum).optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        moderationState: z.nativeEnum(ModerationStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        tags: z.array(z.string()).optional(),
        media: z
            .object({
                featuredImage: z
                    .object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        description: z.string().optional()
                    })
                    .optional(),
                gallery: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            description: z.string().optional()
                        })
                    )
                    .optional()
            })
            .optional()
    })
    .passthrough();

export type Event = z.infer<typeof EventListItemSchema>;
