import { z } from 'zod';
import { NewsletterSourceEnum } from './newsletter-source.enum.js';

export const NewsletterSourceEnumSchema = z.nativeEnum(NewsletterSourceEnum, {
    error: () => ({ message: 'zodError.enums.newsletterSource.invalid' })
});
