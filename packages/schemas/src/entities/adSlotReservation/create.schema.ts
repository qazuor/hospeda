import type { z } from 'zod';
import { AdSlotReservationSchema } from './adSlotReservation.schema.js';

/**
 * Create Ad Slot Reservation Schema
 * Schema for creating a new ad slot reservation
 */
export const CreateAdSlotReservationSchema = AdSlotReservationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).refine((data) => data.toDate > data.fromDate, {
    message: 'End date must be after start date',
    path: ['toDate']
});

export type CreateAdSlotReservation = z.infer<typeof CreateAdSlotReservationSchema>;
