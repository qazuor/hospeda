import { z } from 'zod';
import { EventSchema } from './event.schema.js';

const OrganizerSummarySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    website: z.string().optional(),
    logo: z.string().optional()
});

const LocationSummarySchema = z.object({
    id: z.string().uuid(),
    city: z.string(),
    placeName: z.string().optional()
});

export const EventWithOrganizerSchema = EventSchema.extend({
    organizer: OrganizerSummarySchema.optional()
});

export const EventWithLocationSchema = EventSchema.extend({
    eventLocation: LocationSummarySchema.optional()
});

export const EventWithBasicRelationsSchema = EventSchema.extend({
    organizer: OrganizerSummarySchema.optional(),
    eventLocation: LocationSummarySchema.optional()
});

export type EventWithOrganizer = z.infer<typeof EventWithOrganizerSchema>;
export type EventWithLocation = z.infer<typeof EventWithLocationSchema>;
export type EventWithBasicRelations = z.infer<typeof EventWithBasicRelationsSchema>;
