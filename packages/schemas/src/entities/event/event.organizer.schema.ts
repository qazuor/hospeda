import { z } from 'zod';
import { ContactInfoSchema } from '../../common/contact.schema';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSoftDeleteSchema
} from '../../common/helpers.schema';
import { SocialNetworkSchema } from '../../common/social.schema';

/**
 * Event Organizer schema definition using Zod for validation.
 * Represents the organizer details for an event.
 */
export const EventOrganizerSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithSoftDeleteSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        name: z
            .string()
            .min(3, { message: 'zodError.event.organizer.name.min' })
            .max(100, { message: 'zodError.event.organizer.name.max' }),
        logo: z.string().url({ message: 'zodError.event.organizer.logo.url' }).optional(),
        contactInfo: ContactInfoSchema.optional(),
        social: SocialNetworkSchema.optional()
    });
