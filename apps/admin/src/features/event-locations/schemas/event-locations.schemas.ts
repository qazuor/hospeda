import { EventLocationListItemSchema as BaseEventLocationListItemSchema } from '@repo/schemas';
import type { z } from 'zod';

/**
 * Admin Event Location Schemas
 *
 * All fields available from base EventLocationSchema:
 * - Location details: floor, apartment, neighborhood, department
 * - Coordinates: coordinates.lat, coordinates.long
 * - Lifecycle: lifecycleState from base schema
 */
export const EventLocationListItemSchema = BaseEventLocationListItemSchema;

export const EventLocationListItemClientSchema = EventLocationListItemSchema;

/**
 * Type for event location list items
 */
export type EventLocation = z.infer<typeof EventLocationListItemSchema>;
