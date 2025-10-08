import type { DestinationListItem } from '@repo/schemas';
import {
    DestinationListItemSchema as BaseDestinationListItemSchema,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for destination list items in admin
 * Extends the base DestinationListItemSchema with admin-specific fields
 */
export const DestinationListItemSchema = BaseDestinationListItemSchema.extend({
    // Admin-specific fields for list management
    city: z.string().optional(),
    country: z.string().optional(),
    attractions: z.array(z.string()).optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
    moderationState: z.nativeEnum(ModerationStatusEnum).optional()
});

export type Destination = DestinationListItem & {
    city?: string;
    country?: string;
    attractions?: string[];
    visibility?: VisibilityEnum;
    lifecycleState?: LifecycleStatusEnum;
    moderationState?: ModerationStatusEnum;
};
