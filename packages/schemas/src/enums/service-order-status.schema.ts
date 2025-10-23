import { z } from 'zod';
import { ServiceOrderStatusEnum } from './service-order-status.enum';

export const ServiceOrderStatusSchema = z.nativeEnum(ServiceOrderStatusEnum, {
    message: 'zodError.enums.serviceOrderStatus.invalid'
});
