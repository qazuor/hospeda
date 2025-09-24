import { LifecycleStatusEnum } from '@repo/schemas';
import { z } from 'zod';

/**
 * Event Organizer list item schema for admin interface
 */
export const EventOrganizerListItemSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        logo: z.string().url().optional(),
        contactInfo: z
            .object({
                email: z.string().email().nullable().optional(),
                phone: z.string().nullable().optional(),
                website: z.string().url().nullable().optional()
            })
            .nullable()
            .optional(),
        social: z
            .object({
                facebook: z.string().url().nullable().optional(),
                twitter: z.string().url().nullable().optional(),
                instagram: z.string().url().nullable().optional(),
                linkedin: z.string().url().nullable().optional(),
                youtube: z.string().url().nullable().optional()
            })
            .nullable()
            .optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough();

export const EventOrganizerListItemClientSchema = EventOrganizerListItemSchema;

export type EventOrganizer = z.infer<typeof EventOrganizerListItemSchema>;
