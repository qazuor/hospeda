import { z } from 'zod';
import { AdSlotReservationStatusSchema } from '../../enums/ad-slot-reservation-status.schema.js';

/**
 * Search Ad Slot Reservation Schema
 * Schema for filtering and searching ad slot reservations
 */
export const SearchAdSlotReservationSchema = z.object({
    campaignId: z.string().uuid().optional(),
    adSlotId: z.string().uuid().optional(),
    status: AdSlotReservationStatusSchema.optional(),
    fromDateStart: z.date().optional(),
    fromDateEnd: z.date().optional(),
    toDateStart: z.date().optional(),
    toDateEnd: z.date().optional()
});

export type SearchAdSlotReservation = z.infer<typeof SearchAdSlotReservationSchema>;
