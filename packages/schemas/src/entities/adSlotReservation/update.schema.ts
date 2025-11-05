import type { z } from 'zod';
import { AdSlotReservationSchema } from './adSlotReservation.schema.js';

/**
 * Update Ad Slot Reservation Schema
 * Schema for updating an existing ad slot reservation
 */
export const UpdateAdSlotReservationSchema = AdSlotReservationSchema.omit({
    id: true,
    createdAt: true,
    createdById: true
}).partial();

export type UpdateAdSlotReservation = z.infer<typeof UpdateAdSlotReservationSchema>;
