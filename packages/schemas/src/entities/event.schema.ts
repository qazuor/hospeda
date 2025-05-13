import { z } from 'zod';
import {
    BaseEntitySchema,
    ContactInfoSchema,
    MediaSchema,
    SeoSchema,
    TagSchema
} from '../common.schema';
import { EventCategoryEnumSchema, VisibilityEnumSchema } from '../enums.schema';
import { SlugRegex, omittedBaseEntityFieldsForActions } from '../utils/utils';
import { EventDateSchema } from './event/date.schema';
import { EventPriceSchema } from './event/price.schema';

/**
 * Zod schema for a event entity.
 */
export const EventSchema = BaseEntitySchema.extend({
    slug: z
        .string()
        .min(3, 'error:event.slug.min_lenght')
        .max(30, 'error:event.slug.max_lenght')
        .regex(SlugRegex, {
            message: 'error:event.slug.pattern'
        }),
    summary: z
        .string()
        .min(50, 'error:event.summary.min_lenght')
        .max(200, 'error:event.summary.max_lenght'),
    description: z
        .string()
        .min(50, 'error:event.description.min_lenght')
        .max(1000, 'error:event.description.max_lenght'),
    media: MediaSchema.optional(),
    category: EventCategoryEnumSchema,
    date: EventDateSchema,
    locationId: z.string().uuid({
        message: 'error:event.locationId.invalid'
    }),
    organizerId: z.string().uuid({
        message: 'error:event.organizerId.invalid'
    }),
    pricing: EventPriceSchema.optional(),
    contact: ContactInfoSchema.optional(),
    visibility: VisibilityEnumSchema,
    seo: SeoSchema.optional(),
    isFeatured: z
        .boolean({
            required_error: 'error:event.isFeatured.required',
            invalid_type_error: 'error:event.isFeatured.invalid_type'
        })
        .optional(),
    tags: z.array(TagSchema).optional()
});

export type EventInput = z.infer<typeof EventSchema>;

export const EventCreateSchema = EventSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof EventSchema.shape,
        true
    >
);

export const EventUpdateSchema = EventSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof EventSchema.shape,
        true
    >
).partial();
