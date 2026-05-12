import { z } from 'zod';
import { NewsletterDeliveryStatusEnum } from './newsletter-delivery-status.enum.js';

export const NewsletterDeliveryStatusEnumSchema = z.nativeEnum(NewsletterDeliveryStatusEnum, {
    error: () => ({ message: 'zodError.enums.newsletterDeliveryStatus.invalid' })
});
