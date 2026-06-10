import { z } from 'zod';
import { NewsletterContentTypeEnum } from './newsletter-content-type.enum.js';

/**
 * Zod schema mirroring {@link NewsletterContentTypeEnum}. Used to validate
 * campaign `contentType` filters and the per-key updates accepted by the
 * preferences endpoint.
 */
export const NewsletterContentTypeEnumSchema = z.nativeEnum(NewsletterContentTypeEnum, {
    error: () => ({ message: 'zodError.enums.newsletterContentType.invalid' })
});
