import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSoftDeleteSchema
} from '../../common/helpers.schema';
import { EventDateSchema } from './event.date.schema';
import { EventExtrasSchema } from './event.extras.schema';
import { EventLocationSchema } from './event.location.schema';
import { EventOrganizerSchema } from './event.organizer.schema';
import { EventPriceSchema } from './event.price.schema';

/**
 * Event schema definition using Zod for validation.
 * Includes date, location, organizer, and optional price and extras.
 */
export const EventSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithSoftDeleteSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        /** Event title, 3-100 characters */
        title: z
            .string()
            .min(3, { message: 'zodError.event.title.min' })
            .max(100, { message: 'zodError.event.title.max' }),
        /** Event description, 10-1000 characters */
        description: z
            .string()
            .min(10, { message: 'zodError.event.description.min' })
            .max(1000, { message: 'zodError.event.description.max' }),
        /** Event date object */
        date: EventDateSchema,
        /** Event location object */
        location: EventLocationSchema,
        /** Event organizer object */
        organizer: EventOrganizerSchema,
        /** Event price, optional */
        price: EventPriceSchema.optional(),
        /** Additional event extras, optional */
        extras: EventExtrasSchema.optional()
    });
