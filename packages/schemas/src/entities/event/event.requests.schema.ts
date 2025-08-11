import type { z } from 'zod';
import {
    CreateEventServiceSchema,
    EventFilterInputSchema,
    UpdateEventServiceSchema
} from './event.service.schema.js';

/**
 * API request schemas for Event entity.
 * Aligned with Accommodation/Destination modular structure.
 */

export const EventCreateSchema = CreateEventServiceSchema;
export type EventCreateRequest = z.infer<typeof EventCreateSchema>;

export const EventUpdateSchema = UpdateEventServiceSchema;
export type EventUpdateRequest = z.infer<typeof EventUpdateSchema>;

export const EventFilterSchema = EventFilterInputSchema;
export type EventFilterRequest = z.infer<typeof EventFilterSchema>;
