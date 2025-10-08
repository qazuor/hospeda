import type { EventOrganizerListItem } from '@repo/schemas';
import { EventOrganizerListItemSchema as BaseEventOrganizerListItemSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for event organizer list items in admin
 * Extends the base EventOrganizerListItemSchema with admin-specific fields
 */
export const EventOrganizerListItemSchema = BaseEventOrganizerListItemSchema.extend({
    // Admin-specific social media structure (differs from base socialNetworks)
    social: z
        .object({
            facebook: z.string().url().nullable().optional(),
            twitter: z.string().url().nullable().optional(),
            instagram: z.string().url().nullable().optional(),
            linkedin: z.string().url().nullable().optional(),
            youtube: z.string().url().nullable().optional()
        })
        .nullable()
        .optional()
});

export const EventOrganizerListItemClientSchema = EventOrganizerListItemSchema;

export type EventOrganizer = EventOrganizerListItem & {
    social?: {
        facebook?: string | null;
        twitter?: string | null;
        instagram?: string | null;
        linkedin?: string | null;
        youtube?: string | null;
    } | null;
};
