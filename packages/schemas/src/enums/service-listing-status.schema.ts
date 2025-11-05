import { z } from 'zod';
import { ServiceListingStatusEnum } from './service-listing-status.enum.js';

export const ServiceListingStatusSchema = z.nativeEnum(ServiceListingStatusEnum, {
    message: 'zodError.enums.serviceListingStatus.invalid'
});
