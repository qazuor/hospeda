import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import {
    EventIdSchema,
    EventLocationIdSchema,
    EventOrganizerIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { EventCategoryEnumSchema } from '../../enums/index.js';
import { TagSchema } from '../tag/tag.schema.js';
import { EventDateSchema } from './event.date.schema.js';
import { EventPriceSchema } from './event.price.schema.js';

/**
 * Event Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an Event entity
 * using base field objects for consistency and maintainability.
 */
export const EventSchema = z.object({
    // Base fields
    id: EventIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    ...BaseModerationFields,
    ...BaseSeoFields,
    ...BaseVisibilityFields,
    // Tags
    tags: z.array(TagSchema).optional(),

    // Event-specific core fields
    slug: z
        .string({
            message: 'zodError.event.slug.required'
        })
        .min(1, { message: 'zodError.event.slug.min' }),

    name: z
        .string({
            message: 'zodError.event.name.required'
        })
        .min(3, { message: 'zodError.event.name.min' })
        .max(100, { message: 'zodError.event.name.max' }),

    summary: z
        .string({
            message: 'zodError.event.summary.required'
        })
        .min(10, { message: 'zodError.event.summary.min' })
        .max(300, { message: 'zodError.event.summary.max' }),

    description: z
        .string({
            message: 'zodError.event.description.required'
        })
        .min(50, { message: 'zodError.event.description.min' })
        .max(5000, { message: 'zodError.event.description.max' })
        .optional(),

    category: EventCategoryEnumSchema,

    // Event dates and pricing
    date: EventDateSchema,
    pricing: EventPriceSchema.optional(),

    isFeatured: z.boolean().default(false),

    // Author
    authorId: UserIdSchema,

    // Contact info
    ...BaseContactFields,

    // Media
    ...BaseMediaFields,

    // Location references
    locationId: EventLocationIdSchema.optional(),
    organizerId: EventOrganizerIdSchema.optional()
});

/**
 * Type export for the main Event entity
 */
export type Event = z.infer<typeof EventSchema>;
