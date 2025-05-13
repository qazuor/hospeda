import { z } from 'zod';
import { BaseEntitySchema, ContactInfoSchema, SocialNetworkSchema } from '../../common.schema';

/**
 * Zod schema for a event organizer entity.
 */
export const EventOrganizerSchema = BaseEntitySchema.extend({
    // TODO: ver como mejorar esto. usamos Url o un image upload?
    logo: z.string().min(1, 'error:event.organizer.logo.min_lenght').optional(),
    contactInfo: ContactInfoSchema.optional(),
    social: SocialNetworkSchema.optional()
});

export type EventOrganizerInput = z.infer<typeof EventOrganizerSchema>;
