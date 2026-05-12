/**
 * @module entities/newsletter/newsletter-subscriber.query.schema
 *
 * Query parameter schemas for the protected newsletter subscriber endpoints (SPEC-101).
 */

import { z } from 'zod';
import { NewsletterChannelEnum } from '../../enums/newsletter-channel.enum.js';

/**
 * Query parameters for `GET /api/v1/protected/newsletter/status`.
 *
 * Allows the authenticated user to check their subscription status for a
 * given channel. Defaults to `'email'` when the `channel` param is omitted.
 *
 * @example
 * ```ts
 * const query = NewsletterSubscriberQuerySchema.parse({ channel: 'email' });
 * ```
 */
export const NewsletterSubscriberQuerySchema = z.object({
    /**
     * Delivery channel to check subscription status for.
     * Defaults to `'email'` (the only channel shipped in MVP).
     */
    channel: z.nativeEnum(NewsletterChannelEnum).optional().default(NewsletterChannelEnum.EMAIL)
});

/** TypeScript type inferred from {@link NewsletterSubscriberQuerySchema}. */
export type NewsletterSubscriberQuery = z.infer<typeof NewsletterSubscriberQuerySchema>;
