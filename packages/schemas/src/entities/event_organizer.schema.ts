import type { EventOrganizerType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema, ContactInfoSchema, SocialNetworkSchema } from '../common.schema';

/**
 * Zod schema for event organizer or host.
 */
export const EventOrganizerSchema: z.ZodType<EventOrganizerType> = BaseEntitySchema.extend({
    logo: z.string().url({ message: 'error:event.organizer.logoInvalid' }).optional(),
    contactInfo: ContactInfoSchema.optional(),
    social: SocialNetworkSchema.optional()
});
