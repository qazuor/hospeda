import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { EventOrganizerIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseSocialFields } from '../../common/social.schema.js';

/**
 * Event Organizer Schema - using Base Field Objects
 *
 * This schema represents the organizer details for an event.
 * Migrated from legacy WithXXXSchema pattern to use base field objects.
 */
export const EventOrganizerSchema = z.object({
    // Base fields
    id: EventOrganizerIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Organizer-specific fields
    name: z
        .string()
        .min(3, { message: 'zodError.event.organizer.name.min' })
        .max(100, { message: 'zodError.event.organizer.name.max' }),

    description: z
        .string()
        .min(10, { message: 'zodError.event.organizer.description.min' })
        .max(500, { message: 'zodError.event.organizer.description.max' })
        .optional(),

    logo: z.string().url({ message: 'zodError.event.organizer.logo.url' }).optional(),

    // Contact and social (using base objects)
    ...BaseContactFields,
    ...BaseSocialFields
});

/**
 * Type export
 */
export type EventOrganizer = z.infer<typeof EventOrganizerSchema>;
