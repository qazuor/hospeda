import { z } from 'zod';
import { AdSlotReservationStatusSchema } from '../../enums/ad-slot-reservation-status.schema.js';

/**
 * Ad Slot Reservation Schema
 * Represents a reservation of an advertising slot by a campaign for a specific period
 */
export const AdSlotReservationSchema = z.object({
    id: z.string().uuid(),
    adSlotId: z.string().uuid(),
    campaignId: z.string().uuid(),
    fromDate: z.date(),
    toDate: z.date(),
    status: AdSlotReservationStatusSchema,
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
    createdById: z.string().uuid(),
    updatedById: z.string().uuid(),
    deletedById: z.string().uuid().nullable()
});

export type AdSlotReservation = z.infer<typeof AdSlotReservationSchema>;
