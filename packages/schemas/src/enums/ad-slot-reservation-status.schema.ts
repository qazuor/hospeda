import { z } from 'zod';
import { AdSlotReservationStatusEnum } from './ad-slot-reservation-status.enum';

export const AdSlotReservationStatusSchema = z.nativeEnum(AdSlotReservationStatusEnum, {
    message: 'zodError.enums.adSlotReservationStatus.invalid'
});
