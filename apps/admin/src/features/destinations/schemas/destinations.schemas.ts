import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for destination list items
 */
export const DestinationListItemSchema = z
    .object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        city: z.string().optional(),
        country: z.string().optional(),
        averageRating: z.string().optional(),
        reviewsCount: z.number().optional(),
        accommodationsCount: z.number().optional(),
        featuredImage: z.string().url().optional(),
        attractions: z.array(z.string()).optional(),
        isFeatured: z.boolean().optional(),
        visibility: z.nativeEnum(VisibilityEnum).optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        moderationState: z.nativeEnum(ModerationStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
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

export type Destination = z.infer<typeof DestinationListItemSchema>;
