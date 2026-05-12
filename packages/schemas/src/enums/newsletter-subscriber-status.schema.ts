import { z } from 'zod';
import { NewsletterSubscriberStatusEnum } from './newsletter-subscriber-status.enum.js';

export const NewsletterSubscriberStatusEnumSchema = z.nativeEnum(NewsletterSubscriberStatusEnum, {
    error: () => ({ message: 'zodError.enums.newsletterSubscriberStatus.invalid' })
});
