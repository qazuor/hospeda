import { z } from 'zod';
import { ListingStatusEnum } from './listing-status.enum';

export const ListingStatusSchema = z.nativeEnum(ListingStatusEnum, {
    message: 'zodError.enums.listingStatus.invalid'
});
