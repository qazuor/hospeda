import { z } from 'zod';
import { NewsletterChannelEnum } from './newsletter-channel.enum.js';

export const NewsletterChannelEnumSchema = z.nativeEnum(NewsletterChannelEnum, {
    error: () => ({ message: 'zodError.enums.newsletterChannel.invalid' })
});
