import type { EventType } from '@repo/types';
import { EventCategoryEnum, VisibilityEnum } from '@repo/types';
import { z } from 'zod';

import { ContactInfoSchema, MediaSchema, SeoSchema } from '../common.schema';

import { EventDateSchema } from './event_date.schema';
import { EventLocationSchema } from './event_location.schema';
import { EventOrganizerSchema } from './event_organizer.schema';
import { EventPriceSchema } from './event_price.schema';

/**
 * Zod schema for creating a new event.
 */
export const EventCreateSchema: z.ZodType<
    Omit<
        EventType,
        | 'id'
        | 'createdAt'
        | 'createdById'
        | 'updatedAt'
        | 'updatedById'
        | 'deletedAt'
        | 'deletedById'
    >
> = z.object({
    name: z.string({ required_error: 'error:event.nameRequired' }),
    displayName: z.string({ required_error: 'error:event.displayNameRequired' }),
    slug: z.string({ required_error: 'error:event.slugRequired' }),
    summary: z.string({ required_error: 'error:event.summaryRequired' }),
    description: z.string().optional(),
    media: MediaSchema.optional(),

    category: z.nativeEnum(EventCategoryEnum, {
        required_error: 'error:event.categoryRequired',
        invalid_type_error: 'error:event.categoryInvalid'
    }),

    date: EventDateSchema,

    authorId: z.string().uuid({ message: 'error:event.authorIdInvalid' }),

    locationId: z.string().uuid({ message: 'error:event.locationIdInvalid' }).optional(),
    location: EventLocationSchema.optional(),

    organizerId: z.string().uuid({ message: 'error:event.organizerIdInvalid' }).optional(),
    organizer: EventOrganizerSchema.optional(),

    pricing: EventPriceSchema.optional(),
    contact: ContactInfoSchema.optional(),

    visibility: z.nativeEnum(VisibilityEnum, {
        required_error: 'error:event.visibilityRequired',
        invalid_type_error: 'error:event.visibilityInvalid'
    }),

    seo: SeoSchema.optional(),
    isFeatured: z.boolean().optional(),

    state: z.nativeEnum(VisibilityEnum, {
        required_error: 'error:event.stateRequired',
        invalid_type_error: 'error:event.stateInvalid'
    })
});
